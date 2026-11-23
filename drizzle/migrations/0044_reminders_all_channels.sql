-- Each person's own choice of how and about what they are reminded.
create table public.notification_preferences (
  user_id uuid primary key,
  push boolean not null default true,
  email boolean not null default true,
  whatsapp boolean not null default false,
  sms boolean not null default false,
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  availability boolean not null default true,
  fees boolean not null default true,
  umpire_jobs boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint notification_preferences_phone_needed check (not (whatsapp or sms) or phone is not null)
);
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;
alter table public.notification_preferences enable row level security;
create policy notification_preferences_self on public.notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Phones/browsers a signed-in person turned reminder alerts on for.
create table public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 80 and 100),
  auth text not null check (char_length(auth) between 16 and 30),
  failures smallint not null default 0,
  created_at timestamptz not null default now()
);
create index user_push_subscriptions_user on public.user_push_subscriptions (user_id);
grant select, delete on public.user_push_subscriptions to authenticated;
grant all on public.user_push_subscriptions to service_role;
alter table public.user_push_subscriptions enable row level security;
create policy user_push_subscriptions_self_select on public.user_push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_push_subscriptions_self_delete on public.user_push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Saving a device moves it to whoever is signed in on it now; at most 10 devices per person.
create or replace function public.save_push_device(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path to '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'sign in first' using errcode = '42501'; end if;
  insert into public.user_push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_user, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, failures = 0;
  delete from public.user_push_subscriptions
  where user_id = v_user and id not in (
    select id from public.user_push_subscriptions where user_id = v_user order by created_at desc limit 10);
end $$;
revoke all on function public.save_push_device(text, text, text) from public, anon;
grant execute on function public.save_push_device(text, text, text) to authenticated;

-- Per-club reminder switches.
create table public.reminder_settings (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  availability boolean not null default true,
  fees boolean not null default true,
  umpire_jobs boolean not null default true,
  availability_hours smallint not null default 24 check (availability_hours between 1 and 168),
  fee_days smallint not null default 3 check (fee_days between 0 and 30),
  texts boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.reminder_settings to authenticated;
grant all on public.reminder_settings to service_role;
alter table public.reminder_settings enable row level security;
create policy reminder_settings_member_read on public.reminder_settings
  for select to authenticated using (public.is_org_member(organisation_id));
create policy reminder_settings_admin_insert on public.reminder_settings
  for insert to authenticated
  with check (public.has_org_role(organisation_id, array['owner','club_admin','league_admin']::public.platform_role[]));
create policy reminder_settings_admin_update on public.reminder_settings
  for update to authenticated
  using (public.has_org_role(organisation_id, array['owner','club_admin','league_admin']::public.platform_role[]))
  with check (public.has_org_role(organisation_id, array['owner','club_admin','league_admin']::public.platform_role[]));

-- Notifications: reminder bookkeeping. People read their own and may only change read_at.
alter table public.notifications
  add column kind text,
  add column link text check (link is null or (link like '/%' and char_length(link) <= 200)),
  add column dedupe_key text,
  add column deliveries jsonb not null default '{}'::jsonb;
create unique index notifications_dedupe_key on public.notifications (dedupe_key) where dedupe_key is not null;
create index notifications_undelivered on public.notifications (scheduled_for) where delivered_at is null and failed_at is null;
create index notifications_user_recent on public.notifications (user_id, created_at desc);
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- Whether a club is on a paid plan (leagues count as paid). WhatsApp/texts need this.
create or replace function public.org_on_paid_plan(p_org uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select (select kind from public.organisations where id = p_org) = 'league'
    or exists (select 1 from public.subscriptions s
               where s.organisation_id = p_org and s.plan in ('club','league') and s.status in ('active','trialing'));
$$;
revoke all on function public.org_on_paid_plan(uuid) from public, anon;
grant execute on function public.org_on_paid_plan(uuid) to authenticated, service_role;

-- Builds reminder rows. p_manual = a manager pressed "Send now" (one nudge per person per hour).
create or replace function public.queue_reminders_internal(p_org uuid, p_kind text, p_target uuid, p_manual boolean)
returns integer language plpgsql security definer set search_path to '' as $$
declare
  v_total integer := 0;
  v_n integer;
  v_suffix text := case when p_manual then ':m' || to_char(now() at time zone 'utc', 'YYYYMMDDHH24') else '' end;
begin
  if p_kind in ('all', 'availability') then
    with ev as (
      select e.* from public.club_events e
      left join public.reminder_settings rs on rs.organisation_id = e.organisation_id
      where (p_org is null or e.organisation_id = p_org)
        and (p_target is null or e.id = p_target)
        and e.cancelled_at is null and e.availability_open and e.starts_at > now()
        and coalesce(e.reply_by, e.starts_at) > now()
        and (p_manual or (coalesce(rs.availability, true)
             and coalesce(e.reply_by, e.starts_at) - make_interval(hours => coalesce(rs.availability_hours, 24)::int) <= now()))
    ), squad as (
      select ev.id event_id, ev.organisation_id, ev.title, ev.starts_at, ev.reply_by, p.id player_id, p.display_name, p.linked_user_id
      from ev join public.players p on p.organisation_id = ev.organisation_id
      where (ev.team_id is null
             or not exists (select 1 from public.team_players tp where tp.team_id = ev.team_id
                            and tp.valid_from <= current_date and (tp.valid_until is null or tp.valid_until >= current_date))
             or exists (select 1 from public.team_players tp where tp.team_id = ev.team_id and tp.player_id = p.id
                        and tp.valid_from <= current_date and (tp.valid_until is null or tp.valid_until >= current_date)))
        and not exists (select 1 from public.event_availability a where a.event_id = ev.id and a.player_id = p.id)
    ), recipients as (
      select event_id, organisation_id, title, starts_at, reply_by, player_id, display_name, linked_user_id user_id from squad where linked_user_id is not null
      union
      select s.event_id, s.organisation_id, s.title, s.starts_at, s.reply_by, s.player_id, s.display_name, g.user_id
      from squad s join public.player_guardians g on g.player_id = s.player_id
    )
    insert into public.notifications (organisation_id, user_id, channel, template, kind, payload, link, dedupe_key)
    select r.organisation_id, r.user_id, 'in_app', 'reminder.availability', 'availability',
      jsonb_build_object('event_title', r.title, 'starts_at', r.starts_at, 'reply_by', r.reply_by,
                         'player_name', r.display_name, 'self', r.user_id = (select linked_user_id from public.players where id = r.player_id),
                         'club_name', o.name),
      '/platform?section=office',
      'avail:' || r.event_id || ':' || r.player_id || ':' || r.user_id || v_suffix
    from recipients r
    join public.organisations o on o.id = r.organisation_id
    left join public.notification_preferences np on np.user_id = r.user_id
    where coalesce(np.availability, true)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics v_n = row_count; v_total := v_total + v_n;
  end if;

  if p_kind in ('all', 'fees') then
    with ch as (
      select c.*, p.display_name, p.linked_user_id,
        case when p_manual then 'fee:' || c.id || v_suffix
             when c.due_on is null or current_date <= c.due_on then 'fee:' || c.id || ':due'
             else 'fee:' || c.id || ':late' || ((current_date - c.due_on - 1) / 7) end key_base
      from public.fee_charges c
      join public.players p on p.id = c.player_id
      left join public.reminder_settings rs on rs.organisation_id = c.organisation_id
      where (p_org is null or c.organisation_id = p_org)
        and (p_target is null or c.id = p_target)
        and c.status in ('due', 'part_paid') and c.amount_minor > c.paid_minor
        and (p_manual or (coalesce(rs.fees, true) and c.due_on is not null
             and c.due_on <= current_date + coalesce(rs.fee_days, 3)::int and current_date - c.due_on <= 56))
    ), recipients as (
      select ch.*, ch.linked_user_id user_id from ch where ch.linked_user_id is not null
      union all
      select ch.*, g.user_id from ch join public.player_guardians g on g.player_id = ch.player_id
        where g.user_id is distinct from ch.linked_user_id
    )
    insert into public.notifications (organisation_id, user_id, channel, template, kind, payload, link, dedupe_key)
    select r.organisation_id, r.user_id, 'in_app', 'reminder.fee', 'fees',
      jsonb_build_object('description', r.description, 'owed_minor', r.amount_minor - r.paid_minor, 'currency', r.currency,
                         'due_on', r.due_on, 'player_name', r.display_name, 'self', r.user_id = r.linked_user_id, 'club_name', o.name),
      '/platform?section=office',
      r.key_base || ':' || r.user_id
    from recipients r
    join public.organisations o on o.id = r.organisation_id
    left join public.notification_preferences np on np.user_id = r.user_id
    where coalesce(np.fees, true)
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics v_n = row_count; v_total := v_total + v_n;
  end if;

  if p_kind in ('all', 'umpires') then
    insert into public.notifications (organisation_id, user_id, channel, template, kind, payload, link, dedupe_key)
    select a.organisation_id, u.user_id, 'in_app', 'reminder.umpire', 'umpire_jobs',
      jsonb_build_object('title', a.title, 'starts_at', a.starts_at, 'venue', a.venue, 'status', a.status,
                         'report_at', a.report_at, 'meet_point', a.meet_point, 'club_name', o.name),
      '/umpire',
      'ump:' || a.id || case when p_manual then v_suffix
                             when a.status = 'offered' then ':offer' || to_char(now() at time zone 'utc', 'YYYYMMDD')
                             else ':eve' end
    from public.umpire_appointments a
    join public.umpires u on u.id = a.umpire_id
    join public.organisations o on o.id = a.organisation_id
    left join public.reminder_settings rs on rs.organisation_id = a.organisation_id
    left join public.notification_preferences np on np.user_id = u.user_id
    where u.user_id is not null and a.starts_at > now()
      and (p_org is null or a.organisation_id = p_org)
      and (p_target is null or a.id = p_target)
      and coalesce(np.umpire_jobs, true)
      and (
        (a.status = 'offered' and (p_manual or (coalesce(rs.umpire_jobs, true) and a.created_at <= now() - interval '12 hours')))
        or (a.status = 'accepted' and (
              (p_manual and (p_target is not null or a.starts_at <= now() + interval '7 days'))
              or (not p_manual and coalesce(rs.umpire_jobs, true) and a.starts_at <= now() + interval '24 hours')))
      )
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics v_n = row_count; v_total := v_total + v_n;
  end if;
  return v_total;
end $$;
revoke all on function public.queue_reminders_internal(uuid, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.queue_reminders_internal(uuid, text, uuid, boolean) to service_role;

-- Hourly job: every club's due reminders.
create or replace function public.queue_due_reminders()
returns integer language sql security definer set search_path to '' as $$
  select public.queue_reminders_internal(null, 'all', null, false);
$$;
revoke all on function public.queue_due_reminders() from public, anon, authenticated;
grant execute on function public.queue_due_reminders() to service_role;

-- "Send now" for managers. Each kind is limited to the role that runs it.
create or replace function public.send_reminders_now(p_organisation_id uuid, p_kind text, p_target uuid default null)
returns integer language plpgsql security definer set search_path to '' as $$
begin
  if p_kind = 'availability' and not public.is_event_manager(p_organisation_id) then
    raise exception 'only event managers can send availability reminders' using errcode = '42501';
  elsif p_kind = 'fees' and not public.is_finance_manager(p_organisation_id) then
    raise exception 'only the treasurer can send fee reminders' using errcode = '42501';
  elsif p_kind = 'umpires' and not public.is_umpire_manager(p_organisation_id) then
    raise exception 'only umpire managers can send umpire reminders' using errcode = '42501';
  elsif p_kind not in ('availability', 'fees', 'umpires') then
    raise exception 'unknown reminder' using errcode = '22023';
  end if;
  return public.queue_reminders_internal(p_organisation_id, p_kind, p_target, true);
end $$;
revoke all on function public.send_reminders_now(uuid, text, uuid) from public, anon;
grant execute on function public.send_reminders_now(uuid, text, uuid) to authenticated;

-- Confirmed email addresses for delivery (server only).
create or replace function public.reminder_contacts(p_user_ids uuid[])
returns table (user_id uuid, email text) language sql stable security definer set search_path to '' as $$
  select u.id, u.email::text from auth.users u
  where u.id = any(p_user_ids) and u.email is not null and u.email_confirmed_at is not null;
$$;
revoke all on function public.reminder_contacts(uuid[]) from public, anon, authenticated;
grant execute on function public.reminder_contacts(uuid[]) to service_role;