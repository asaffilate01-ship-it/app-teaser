create extension if not exists btree_gist with schema extensions;

-- ---------- Role helpers ----------
create or replace function public.can_assign_role(p_actor public.platform_role, p_target public.platform_role)
 returns boolean language sql immutable set search_path to '' as $$
  select case
    when p_actor = 'owner' then true
    when p_actor in ('club_admin', 'league_admin') then
      p_target in ('treasurer', 'team_manager', 'scorer', 'coach', 'player', 'viewer')
    else false
  end;
$$;

create or replace function public.is_finance_manager(p_org uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select public.has_org_role(p_org, array['owner','club_admin','treasurer']::public.platform_role[]);
$$;
create or replace function public.is_booking_manager(p_org uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select public.has_org_role(p_org, array['owner','club_admin','league_admin']::public.platform_role[]);
$$;
create or replace function public.can_request_booking(p_org uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select public.has_org_role(p_org, array['owner','club_admin','league_admin','coach','team_manager']::public.platform_role[]);
$$;
create or replace function public.is_event_manager(p_org uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select public.has_org_role(p_org, array['owner','club_admin','league_admin','coach','team_manager']::public.platform_role[]);
$$;
create or replace function public.is_travel_manager(p_org uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select public.has_org_role(p_org, array['owner','club_admin','team_manager','safeguarding_officer']::public.platform_role[]);
$$;
create or replace function public.is_store_manager(p_org uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select public.has_org_role(p_org, array['owner','club_admin','treasurer','team_manager']::public.platform_role[]);
$$;
create or replace function public.is_guardian_manager(p_org uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select public.has_org_role(p_org, array['owner','club_admin','safeguarding_officer']::public.platform_role[]);
$$;
create or replace function public.can_approve_drivers(p_org uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select public.has_org_role(p_org, array['owner','safeguarding_officer']::public.platform_role[]);
$$;

-- ---------- Membership guard: no self-promotion, no touching higher roles, always one owner ----------
create or replace function public.guard_membership_change()
 returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_actor public.platform_role;
  v_org uuid := coalesce(new.organisation_id, old.organisation_id);
begin
  if v_uid is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' and new.role = 'owner' and new.user_id = v_uid
     and not exists (select 1 from public.organisation_members m where m.organisation_id = new.organisation_id) then
    return new;
  end if;
  select m.role into v_actor from public.organisation_members m
   where m.organisation_id = v_org and m.user_id = v_uid and m.status = 'active';

  if tg_op = 'UPDATE' and old.user_id = v_uid then
    if new.role is distinct from old.role or new.organisation_id <> old.organisation_id or new.user_id <> old.user_id
       or new.status not in (old.status, 'left') then
      raise exception 'you cannot change your own role' using errcode = '42501';
    end if;
  elsif tg_op = 'INSERT' then
    if v_actor is null or not public.can_assign_role(v_actor, new.role) then
      raise exception 'you cannot give that role' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if v_actor is null or not public.can_assign_role(v_actor, old.role) or not public.can_assign_role(v_actor, new.role) then
      raise exception 'you cannot change that member' using errcode = '42501';
    end if;
  elsif tg_op = 'DELETE' then
    if v_actor is null or not public.can_assign_role(v_actor, old.role) then
      raise exception 'you cannot remove that member' using errcode = '42501';
    end if;
  end if;

  if old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active')
     and not exists (
       select 1 from public.organisation_members m
        where m.organisation_id = old.organisation_id and m.role = 'owner' and m.status = 'active' and m.user_id <> old.user_id
     ) then
    raise exception 'a club must always keep one owner' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists guard_membership_change on public.organisation_members;
create trigger guard_membership_change before insert or update or delete on public.organisation_members
  for each row execute function public.guard_membership_change();

create or replace function public.find_user_id_by_email(p_email text)
 returns uuid language sql stable security definer set search_path to '' as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;

-- ---------- Parents / guardians ----------
create table public.player_guardians (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  user_id uuid not null,
  relationship text not null default 'parent' check (char_length(relationship) between 1 and 40),
  added_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (player_id, user_id)
);
grant select, insert, update, delete on public.player_guardians to authenticated;
grant all on public.player_guardians to service_role;
alter table public.player_guardians enable row level security;

create or replace function public.can_act_for_player(p_player_id uuid)
 returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.players p
     where p.id = p_player_id
       and public.is_org_member(p.organisation_id)
       and (p.linked_user_id = (select auth.uid())
            or exists (select 1 from public.player_guardians g where g.player_id = p.id and g.user_id = (select auth.uid())))
  );
$$;

create policy guardians_select on public.player_guardians for select to authenticated
  using (user_id = (select auth.uid()) or public.is_guardian_manager(organisation_id) or public.is_event_manager(organisation_id));
create policy guardians_insert on public.player_guardians for insert to authenticated
  with check (public.is_guardian_manager(organisation_id));
create policy guardians_delete on public.player_guardians for delete to authenticated
  using (public.is_guardian_manager(organisation_id));

create or replace function public.check_player_in_org()
 returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.player_id is not null and not exists (
    select 1 from public.players p where p.id = new.player_id and p.organisation_id = new.organisation_id
  ) then
    raise exception 'that player is not in this club' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger player_guardians_org before insert or update on public.player_guardians
  for each row execute function public.check_player_in_org();
create or replace function public.check_guardian_is_member()
 returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if not exists (select 1 from public.organisation_members m where m.organisation_id = new.organisation_id and m.user_id = new.user_id) then
    raise exception 'that person is not a member of this club yet — invite them first' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger player_guardians_member before insert or update on public.player_guardians
  for each row execute function public.check_guardian_is_member();

-- ---------- Fees ----------
create table public.fee_schedules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  frequency text not null default 'season' check (frequency in ('one_off','monthly','quarterly','season','annual','match')),
  due_on date,
  team_id uuid references public.teams(id) on delete set null,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.fee_schedules to authenticated;
grant all on public.fee_schedules to service_role;
alter table public.fee_schedules enable row level security;
create policy fee_schedules_select on public.fee_schedules for select to authenticated using (public.is_org_member(organisation_id));
create policy fee_schedules_insert on public.fee_schedules for insert to authenticated with check (public.is_finance_manager(organisation_id));
create policy fee_schedules_update on public.fee_schedules for update to authenticated using (public.is_finance_manager(organisation_id)) with check (public.is_finance_manager(organisation_id));
create policy fee_schedules_delete on public.fee_schedules for delete to authenticated using (public.is_finance_manager(organisation_id));
create trigger fee_schedules_updated before update on public.fee_schedules for each row execute function public.set_updated_at();

create table public.fee_charges (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  schedule_id uuid references public.fee_schedules(id) on delete set null,
  player_id uuid not null references public.players(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 160),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  due_on date,
  status text not null default 'due' check (status in ('due','part_paid','paid','waived')),
  paid_minor bigint not null default 0 check (paid_minor >= 0),
  waived_reason text check (waived_reason is null or char_length(waived_reason) <= 200),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index fee_charges_once on public.fee_charges (schedule_id, player_id, coalesce(due_on, '1900-01-01'::date)) where schedule_id is not null;
create index fee_charges_org on public.fee_charges (organisation_id, status);
create index fee_charges_player on public.fee_charges (player_id);
grant select, insert, update, delete on public.fee_charges to authenticated;
grant all on public.fee_charges to service_role;
alter table public.fee_charges enable row level security;
create policy fee_charges_select on public.fee_charges for select to authenticated
  using (public.is_finance_manager(organisation_id) or public.can_act_for_player(player_id));
create policy fee_charges_insert on public.fee_charges for insert to authenticated with check (public.is_finance_manager(organisation_id));
create policy fee_charges_update on public.fee_charges for update to authenticated using (public.is_finance_manager(organisation_id)) with check (public.is_finance_manager(organisation_id));
create policy fee_charges_delete on public.fee_charges for delete to authenticated using (public.is_finance_manager(organisation_id));
create trigger fee_charges_player_org before insert or update on public.fee_charges for each row execute function public.check_player_in_org();
create trigger fee_charges_updated before update on public.fee_charges for each row execute function public.set_updated_at();
create trigger audit_fee_charges after insert or update or delete on public.fee_charges for each row execute function public.audit_row_change('organisation_id');

create table public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  charge_id uuid not null references public.fee_charges(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  method text not null check (method in ('cash','bank_transfer','card','jazzcash','easypaisa','mpesa','upi','bkash','other')),
  paid_on date not null default current_date,
  reference text check (reference is null or char_length(reference) <= 120),
  recorded_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index fee_payments_charge on public.fee_payments (charge_id);
grant select, insert, delete on public.fee_payments to authenticated;
grant all on public.fee_payments to service_role;
alter table public.fee_payments enable row level security;
create or replace function public.can_view_fee_charge(p_charge_id uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.fee_charges c where c.id = p_charge_id
    and (public.is_finance_manager(c.organisation_id) or public.can_act_for_player(c.player_id)));
$$;
create policy fee_payments_select on public.fee_payments for select to authenticated using (public.can_view_fee_charge(charge_id));
create policy fee_payments_insert on public.fee_payments for insert to authenticated with check (public.is_finance_manager(organisation_id));
create policy fee_payments_delete on public.fee_payments for delete to authenticated using (public.has_org_role(organisation_id, array['owner','treasurer']::public.platform_role[]));

create or replace function public.fee_payment_before()
 returns trigger language plpgsql security definer set search_path to '' as $$
declare v_charge public.fee_charges;
begin
  select * into v_charge from public.fee_charges where id = new.charge_id for update;
  if not found or v_charge.organisation_id <> new.organisation_id then
    raise exception 'that charge is not in this club' using errcode = '22023';
  end if;
  if v_charge.status = 'waived' then
    raise exception 'this charge was waived' using errcode = '22023';
  end if;
  if new.amount_minor > v_charge.amount_minor - v_charge.paid_minor then
    raise exception 'payment is more than what is owed' using errcode = '22023';
  end if;
  new.recorded_by := coalesce((select auth.uid()), new.recorded_by);
  return new;
end;
$$;
create trigger fee_payment_before before insert on public.fee_payments for each row execute function public.fee_payment_before();

create or replace function public.fee_payment_after()
 returns trigger language plpgsql security definer set search_path to '' as $$
declare v_charge_id uuid := coalesce(new.charge_id, old.charge_id); v_paid bigint;
begin
  select coalesce(sum(amount_minor), 0) into v_paid from public.fee_payments where charge_id = v_charge_id;
  update public.fee_charges c set paid_minor = v_paid,
    status = case when c.status = 'waived' then 'waived'
                  when v_paid >= c.amount_minor then 'paid'
                  when v_paid > 0 then 'part_paid' else 'due' end
   where c.id = v_charge_id;
  return coalesce(new, old);
end;
$$;
create trigger fee_payment_after after insert or delete on public.fee_payments for each row execute function public.fee_payment_after();
create trigger audit_fee_payments after insert or delete on public.fee_payments for each row execute function public.audit_row_change('organisation_id');

-- ---------- Ground and nets bookings ----------
alter table public.grounds add column if not exists bookable boolean not null default false;
alter table public.grounds add column if not exists booking_note text check (booking_note is null or char_length(booking_note) <= 300);

create table public.ground_bookings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  ground_id uuid not null references public.grounds(id) on delete cascade,
  requester_organisation_id uuid references public.organisations(id) on delete set null,
  requested_by uuid default auth.uid(),
  title text not null check (char_length(title) between 1 and 120),
  purpose text not null default 'match' check (purpose in ('match','nets','training','event','other')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'requested' check (status in ('requested','approved','declined','cancelled')),
  note text check (note is null or char_length(note) <= 500),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '24 hours'),
  constraint ground_bookings_no_double exclude using gist (ground_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'approved')
);
create index ground_bookings_org on public.ground_bookings (organisation_id, starts_at);
create index ground_bookings_requester on public.ground_bookings (requester_organisation_id);
grant select, insert, update, delete on public.ground_bookings to authenticated;
grant all on public.ground_bookings to service_role;
alter table public.ground_bookings enable row level security;
create policy ground_bookings_select on public.ground_bookings for select to authenticated
  using (public.is_org_member(organisation_id) or (requester_organisation_id is not null and public.is_org_member(requester_organisation_id)));
create policy ground_bookings_insert on public.ground_bookings for insert to authenticated
  with check (public.is_booking_manager(organisation_id) or (public.can_request_booking(organisation_id) and status = 'requested'));
create policy ground_bookings_update on public.ground_bookings for update to authenticated
  using (public.is_booking_manager(organisation_id)) with check (public.is_booking_manager(organisation_id));
create policy ground_bookings_delete on public.ground_bookings for delete to authenticated using (public.is_booking_manager(organisation_id));
create trigger ground_bookings_updated before update on public.ground_bookings for each row execute function public.set_updated_at();

create or replace function public.ground_booking_before()
 returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if not exists (select 1 from public.grounds g where g.id = new.ground_id and g.organisation_id = new.organisation_id) then
    raise exception 'that ground is not in this club' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' then new.requested_by := coalesce((select auth.uid()), new.requested_by); end if;
  if new.status in ('approved','declined') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.decided_by := (select auth.uid());
    new.decided_at := now();
  end if;
  return new;
end;
$$;
create trigger ground_booking_before before insert or update on public.ground_bookings for each row execute function public.ground_booking_before();

create or replace function public.list_bookable_grounds()
 returns table (ground_id uuid, ground_name text, organisation_id uuid, organisation_name text, booking_note text, timezone text)
 language sql stable security definer set search_path to '' as $$
  select g.id, g.name, o.id, o.name, g.booking_note, g.timezone
    from public.grounds g join public.organisations o on o.id = g.organisation_id
   where g.bookable and (select auth.uid()) is not null
   order by o.name, g.name;
$$;
revoke all on function public.list_bookable_grounds() from public, anon;
grant execute on function public.list_bookable_grounds() to authenticated;

create or replace function public.ground_busy_slots(p_ground_id uuid, p_from timestamptz, p_to timestamptz)
 returns table (starts_at timestamptz, ends_at timestamptz)
 language sql stable security definer set search_path to '' as $$
  select b.starts_at, b.ends_at from public.ground_bookings b join public.grounds g on g.id = b.ground_id
   where b.ground_id = p_ground_id and b.status = 'approved' and (g.bookable or public.is_org_member(g.organisation_id))
     and (select auth.uid()) is not null
     and b.ends_at > p_from and b.starts_at < p_to and p_to - p_from <= interval '120 days'
   order by b.starts_at;
$$;
revoke all on function public.ground_busy_slots(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.ground_busy_slots(uuid, timestamptz, timestamptz) to authenticated;

create or replace function public.request_ground_booking(p_ground_id uuid, p_requester_org uuid, p_title text, p_purpose text, p_starts_at timestamptz, p_ends_at timestamptz, p_note text)
 returns uuid language plpgsql security definer set search_path to '' as $$
declare v_ground public.grounds; v_id uuid;
begin
  if not public.can_request_booking(p_requester_org) then
    raise exception 'you cannot book for that club' using errcode = '42501';
  end if;
  select * into v_ground from public.grounds where id = p_ground_id;
  if not found or not v_ground.bookable or v_ground.organisation_id = p_requester_org then
    raise exception 'that ground is not open for booking requests' using errcode = '22023';
  end if;
  if (select count(*) from public.ground_bookings b where b.requester_organisation_id = p_requester_org and b.ground_id = p_ground_id and b.status = 'requested') >= 20 then
    raise exception 'too many open requests for this ground' using errcode = '53400';
  end if;
  insert into public.ground_bookings (organisation_id, ground_id, requester_organisation_id, requested_by, title, purpose, starts_at, ends_at, status, note)
  values (v_ground.organisation_id, p_ground_id, p_requester_org, (select auth.uid()), left(p_title, 120), p_purpose, p_starts_at, p_ends_at, 'requested', left(p_note, 500))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.request_ground_booking(uuid, uuid, text, text, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.request_ground_booking(uuid, uuid, text, text, timestamptz, timestamptz, text) to authenticated;

create or replace function public.cancel_ground_booking(p_booking_id uuid)
 returns void language plpgsql security definer set search_path to '' as $$
declare v public.ground_bookings;
begin
  select * into v from public.ground_bookings where id = p_booking_id for update;
  if not found then raise exception 'booking not found' using errcode = '22023'; end if;
  if not (public.is_booking_manager(v.organisation_id) or v.requested_by = (select auth.uid())
          or (v.requester_organisation_id is not null and public.can_request_booking(v.requester_organisation_id))) then
    raise exception 'you cannot cancel this booking' using errcode = '42501';
  end if;
  update public.ground_bookings set status = 'cancelled' where id = p_booking_id;
end;
$$;
revoke all on function public.cancel_ground_booking(uuid) from public, anon;
grant execute on function public.cancel_ground_booking(uuid) to authenticated;

-- ---------- Events, availability, selection ----------
create table public.club_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  kind text not null default 'match' check (kind in ('match','training','tournament','social','meeting','other')),
  title text not null check (char_length(title) between 1 and 140),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text check (location is null or char_length(location) <= 200),
  notes text check (notes is null or char_length(notes) <= 1000),
  availability_open boolean not null default true,
  selection_published_at timestamptz,
  travel_meet_point text check (travel_meet_point is null or char_length(travel_meet_point) <= 200),
  travel_meet_at timestamptz,
  travel_notes text check (travel_notes is null or char_length(travel_notes) <= 600),
  cancelled_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index club_events_org on public.club_events (organisation_id, starts_at);
grant select, insert, update, delete on public.club_events to authenticated;
grant all on public.club_events to service_role;
alter table public.club_events enable row level security;
create policy club_events_select on public.club_events for select to authenticated using (public.is_org_member(organisation_id));
create policy club_events_insert on public.club_events for insert to authenticated with check (public.is_event_manager(organisation_id));
create policy club_events_update on public.club_events for update to authenticated using (public.is_event_manager(organisation_id)) with check (public.is_event_manager(organisation_id));
create policy club_events_delete on public.club_events for delete to authenticated using (public.is_event_manager(organisation_id));
create trigger club_events_updated before update on public.club_events for each row execute function public.set_updated_at();
create or replace function public.club_event_before()
 returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.team_id is not null and not exists (select 1 from public.teams t where t.id = new.team_id and t.organisation_id = new.organisation_id) then
    raise exception 'that team is not in this club' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger club_event_before before insert or update on public.club_events for each row execute function public.club_event_before();

create or replace function public.event_org(p_event_id uuid) returns uuid language sql stable security definer set search_path to '' as $$
  select organisation_id from public.club_events where id = p_event_id;
$$;
create or replace function public.event_selection_published(p_event_id uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.club_events e where e.id = p_event_id and e.selection_published_at is not null);
$$;

create table public.event_availability (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  event_id uuid not null references public.club_events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null check (status in ('available','unavailable','maybe')),
  note text check (note is null or char_length(note) <= 280),
  responded_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (event_id, player_id)
);
create index event_availability_org on public.event_availability (organisation_id);
grant select, insert, update, delete on public.event_availability to authenticated;
grant all on public.event_availability to service_role;
alter table public.event_availability enable row level security;
create policy availability_select on public.event_availability for select to authenticated
  using (public.is_event_manager(organisation_id) or public.can_act_for_player(player_id));
create policy availability_insert on public.event_availability for insert to authenticated
  with check (public.is_event_manager(organisation_id) or public.can_act_for_player(player_id));
create policy availability_update on public.event_availability for update to authenticated
  using (public.is_event_manager(organisation_id) or public.can_act_for_player(player_id))
  with check (public.is_event_manager(organisation_id) or public.can_act_for_player(player_id));
create policy availability_delete on public.event_availability for delete to authenticated using (public.is_event_manager(organisation_id));
create or replace function public.event_child_before()
 returns trigger language plpgsql security definer set search_path to '' as $$
declare v_event public.club_events;
begin
  select * into v_event from public.club_events where id = new.event_id;
  if not found then raise exception 'event not found' using errcode = '22023'; end if;
  new.organisation_id := v_event.organisation_id;
  if not exists (select 1 from public.players p where p.id = new.player_id and p.organisation_id = v_event.organisation_id) then
    raise exception 'that player is not in this club' using errcode = '22023';
  end if;
  if tg_table_name = 'event_availability' then
    if (not v_event.availability_open or v_event.cancelled_at is not null) and not public.is_event_manager(v_event.organisation_id) then
      raise exception 'availability for this event is closed' using errcode = '22023';
    end if;
    new.responded_by := coalesce((select auth.uid()), new.responded_by);
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger event_availability_before before insert or update on public.event_availability for each row execute function public.event_child_before();

create table public.event_selections (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  event_id uuid not null references public.club_events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  slot text not null default 'playing' check (slot in ('playing','twelfth','reserve')),
  batting_order integer check (batting_order is null or batting_order between 1 and 15),
  captain boolean not null default false,
  wicketkeeper boolean not null default false,
  selected_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (event_id, player_id)
);
create unique index event_selections_one_captain on public.event_selections (event_id) where captain;
create unique index event_selections_one_keeper on public.event_selections (event_id) where wicketkeeper;
grant select, insert, update, delete on public.event_selections to authenticated;
grant all on public.event_selections to service_role;
alter table public.event_selections enable row level security;
create policy selections_select on public.event_selections for select to authenticated
  using (public.is_event_manager(organisation_id) or (public.is_org_member(organisation_id) and public.event_selection_published(event_id)));
create policy selections_insert on public.event_selections for insert to authenticated with check (public.is_event_manager(organisation_id));
create policy selections_update on public.event_selections for update to authenticated using (public.is_event_manager(organisation_id)) with check (public.is_event_manager(organisation_id));
create policy selections_delete on public.event_selections for delete to authenticated using (public.is_event_manager(organisation_id));
create trigger event_selections_before before insert or update on public.event_selections for each row execute function public.event_child_before();

-- ---------- Travel and ride sharing ----------
create table public.travel_drivers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null,
  approved_by uuid default auth.uid(),
  approved_at timestamptz not null default now(),
  expires_on date,
  checks_note text check (checks_note is null or char_length(checks_note) <= 300),
  revoked_at timestamptz,
  unique (organisation_id, user_id)
);
grant select, insert, update, delete on public.travel_drivers to authenticated;
grant all on public.travel_drivers to service_role;
alter table public.travel_drivers enable row level security;
create policy drivers_select on public.travel_drivers for select to authenticated
  using (user_id = (select auth.uid()) or public.is_travel_manager(organisation_id));
create policy drivers_insert on public.travel_drivers for insert to authenticated with check (public.can_approve_drivers(organisation_id));
create policy drivers_update on public.travel_drivers for update to authenticated using (public.can_approve_drivers(organisation_id)) with check (public.can_approve_drivers(organisation_id));
create policy drivers_delete on public.travel_drivers for delete to authenticated using (public.can_approve_drivers(organisation_id));
create trigger travel_drivers_member before insert or update on public.travel_drivers for each row execute function public.check_guardian_is_member();

create or replace function public.is_approved_driver(p_org uuid, p_user uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.travel_drivers d where d.organisation_id = p_org and d.user_id = p_user
    and d.revoked_at is null and (d.expires_on is null or d.expires_on >= current_date));
$$;
create or replace function public.approved_driver_ids(p_org uuid) returns setof uuid language sql stable security definer set search_path to '' as $$
  select d.user_id from public.travel_drivers d where d.organisation_id = p_org and public.is_org_member(p_org)
    and d.revoked_at is null and (d.expires_on is null or d.expires_on >= current_date);
$$;
revoke all on function public.approved_driver_ids(uuid) from public, anon;
grant execute on function public.approved_driver_ids(uuid) to authenticated;

create table public.ride_offers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  event_id uuid not null references public.club_events(id) on delete cascade,
  driver_user_id uuid not null default auth.uid(),
  direction text not null default 'both' check (direction in ('to','from','both')),
  seats integer not null check (seats between 1 and 8),
  meet_point text not null check (char_length(meet_point) between 1 and 160),
  departs_at timestamptz,
  note text check (note is null or char_length(note) <= 300),
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index ride_offers_event on public.ride_offers (event_id);
grant select, insert, update, delete on public.ride_offers to authenticated;
grant all on public.ride_offers to service_role;
alter table public.ride_offers enable row level security;
create policy rides_select on public.ride_offers for select to authenticated using (public.is_org_member(organisation_id));
create policy rides_insert on public.ride_offers for insert to authenticated
  with check (public.is_org_member(organisation_id) and driver_user_id = (select auth.uid()));
create policy rides_update on public.ride_offers for update to authenticated
  using (driver_user_id = (select auth.uid()) or public.is_travel_manager(organisation_id))
  with check (driver_user_id = (select auth.uid()) or public.is_travel_manager(organisation_id));
create policy rides_delete on public.ride_offers for delete to authenticated
  using (driver_user_id = (select auth.uid()) or public.is_travel_manager(organisation_id));

create table public.ride_bookings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  ride_id uuid not null references public.ride_offers(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  booked_by uuid default auth.uid(),
  status text not null default 'requested' check (status in ('requested','confirmed','declined','cancelled')),
  guardian_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ride_id, player_id)
);
grant select, insert, update, delete on public.ride_bookings to authenticated;
grant all on public.ride_bookings to service_role;
alter table public.ride_bookings enable row level security;

create or replace function public.ride_offer_before()
 returns trigger language plpgsql security definer set search_path to '' as $$
begin
  new.organisation_id := public.event_org(new.event_id);
  if new.organisation_id is null then raise exception 'event not found' using errcode = '22023'; end if;
  if tg_op = 'UPDATE' and new.driver_user_id <> old.driver_user_id then
    raise exception 'a ride cannot change driver' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.seats < (select count(*) from public.ride_bookings b where b.ride_id = new.id and b.status in ('requested','confirmed')) then
    raise exception 'more children are booked than seats' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger ride_offer_before before insert or update on public.ride_offers for each row execute function public.ride_offer_before();

create or replace function public.is_ride_driver(p_ride_id uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.ride_offers r where r.id = p_ride_id and r.driver_user_id = (select auth.uid()));
$$;
create policy ride_bookings_select on public.ride_bookings for select to authenticated
  using (public.can_act_for_player(player_id) or public.is_ride_driver(ride_id) or public.is_travel_manager(organisation_id));
create policy ride_bookings_insert on public.ride_bookings for insert to authenticated
  with check (public.can_act_for_player(player_id) or public.is_travel_manager(organisation_id));
create policy ride_bookings_update on public.ride_bookings for update to authenticated
  using (public.can_act_for_player(player_id) or public.is_ride_driver(ride_id) or public.is_travel_manager(organisation_id))
  with check (public.can_act_for_player(player_id) or public.is_ride_driver(ride_id) or public.is_travel_manager(organisation_id));
create policy ride_bookings_delete on public.ride_bookings for delete to authenticated using (public.is_travel_manager(organisation_id));
create trigger ride_bookings_updated before update on public.ride_bookings for each row execute function public.set_updated_at();

create or replace function public.ride_booking_before()
 returns trigger language plpgsql security definer set search_path to '' as $$
declare
  v_ride public.ride_offers;
  v_junior boolean;
  v_taken integer;
  v_uid uuid := (select auth.uid());
  v_manager boolean;
  v_driver boolean;
begin
  select * into v_ride from public.ride_offers where id = new.ride_id for update;
  if not found then raise exception 'ride not found' using errcode = '22023'; end if;
  new.organisation_id := v_ride.organisation_id;
  select p.is_junior into v_junior from public.players p where p.id = new.player_id and p.organisation_id = v_ride.organisation_id;
  if not found then raise exception 'that player is not in this club' using errcode = '22023'; end if;
  v_manager := public.is_travel_manager(v_ride.organisation_id);
  v_driver := v_ride.driver_user_id = v_uid;

  if tg_op = 'INSERT' then
    new.booked_by := coalesce(v_uid, new.booked_by);
    if new.status <> 'requested' and not v_manager then
      raise exception 'new seat requests start as requested' using errcode = '42501';
    end if;
  else
    if new.player_id <> old.player_id or new.ride_id <> old.ride_id then
      raise exception 'create a new booking instead' using errcode = '22023';
    end if;
    if new.status is distinct from old.status and new.status in ('confirmed','declined') and not (v_driver or v_manager) then
      raise exception 'only the driver or a team manager can confirm a seat' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and new.status = 'requested' and not v_manager and not public.can_act_for_player(new.player_id) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    if new.guardian_consent is distinct from old.guardian_consent and not public.can_act_for_player(new.player_id) and not v_manager then
      raise exception 'only the family can change consent' using errcode = '42501';
    end if;
  end if;

  if new.status in ('requested','confirmed') then
    if v_ride.cancelled_at is not null then
      raise exception 'this ride was cancelled' using errcode = '22023';
    end if;
    select count(*) into v_taken from public.ride_bookings b
     where b.ride_id = new.ride_id and b.status in ('requested','confirmed') and b.id <> new.id;
    if v_taken >= v_ride.seats then
      raise exception 'this car is full' using errcode = '53400';
    end if;
    if v_junior then
      if not public.is_approved_driver(v_ride.organisation_id, v_ride.driver_user_id) then
        raise exception 'junior players can only travel with a driver approved by the safeguarding officer' using errcode = '42501';
      end if;
      if not new.guardian_consent then
        raise exception 'a parent or guardian must agree before a junior travels' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger ride_booking_before before insert or update on public.ride_bookings for each row execute function public.ride_booking_before();
create trigger audit_ride_bookings after insert or update or delete on public.ride_bookings for each row execute function public.audit_row_change('organisation_id');

-- ---------- Merchandise and equipment ----------
create table public.club_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  kind text not null check (kind in ('merchandise','equipment')),
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  price_minor bigint check (price_minor is null or price_minor >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  sizes text[] not null default '{}',
  stock integer not null default 0 check (stock >= 0),
  loanable boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index club_items_org on public.club_items (organisation_id, kind);
grant select, insert, update, delete on public.club_items to authenticated;
grant all on public.club_items to service_role;
alter table public.club_items enable row level security;
create policy items_select on public.club_items for select to authenticated using (public.is_org_member(organisation_id));
create policy items_insert on public.club_items for insert to authenticated with check (public.is_store_manager(organisation_id));
create policy items_update on public.club_items for update to authenticated using (public.is_store_manager(organisation_id)) with check (public.is_store_manager(organisation_id));
create policy items_delete on public.club_items for delete to authenticated using (public.is_store_manager(organisation_id));
create trigger club_items_updated before update on public.club_items for each row execute function public.set_updated_at();

create table public.item_orders (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  item_id uuid not null references public.club_items(id) on delete cascade,
  ordered_by uuid not null default auth.uid(),
  player_id uuid references public.players(id) on delete set null,
  quantity integer not null default 1 check (quantity between 1 and 50),
  size text check (size is null or char_length(size) <= 20),
  status text not null default 'requested' check (status in ('requested','approved','paid','ready','collected','cancelled')),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index item_orders_org on public.item_orders (organisation_id, status);
grant select, insert, update, delete on public.item_orders to authenticated;
grant all on public.item_orders to service_role;
alter table public.item_orders enable row level security;
create policy orders_select on public.item_orders for select to authenticated
  using (ordered_by = (select auth.uid()) or (player_id is not null and public.can_act_for_player(player_id)) or public.is_store_manager(organisation_id));
create policy orders_insert on public.item_orders for insert to authenticated
  with check (public.is_org_member(organisation_id) and ordered_by = (select auth.uid()));
create policy orders_update on public.item_orders for update to authenticated
  using (ordered_by = (select auth.uid()) or public.is_store_manager(organisation_id))
  with check (ordered_by = (select auth.uid()) or public.is_store_manager(organisation_id));
create policy orders_delete on public.item_orders for delete to authenticated using (public.is_store_manager(organisation_id));
create trigger item_orders_updated before update on public.item_orders for each row execute function public.set_updated_at();
create or replace function public.item_order_before()
 returns trigger language plpgsql security definer set search_path to '' as $$
declare v_item public.club_items; v_manager boolean;
begin
  select * into v_item from public.club_items where id = new.item_id for update;
  if not found then raise exception 'item not found' using errcode = '22023'; end if;
  new.organisation_id := v_item.organisation_id;
  if new.player_id is not null and not exists (select 1 from public.players p where p.id = new.player_id and p.organisation_id = v_item.organisation_id) then
    raise exception 'that player is not in this club' using errcode = '22023';
  end if;
  v_manager := public.is_store_manager(v_item.organisation_id);
  if tg_op = 'INSERT' then
    if not v_manager and (new.status <> 'requested' or not v_item.active) then
      raise exception 'this item cannot be ordered' using errcode = '42501';
    end if;
  else
    if not v_manager and (old.status <> 'requested' or new.status <> 'cancelled' or new.item_id <> old.item_id or new.quantity <> old.quantity) then
      raise exception 'only the club can change this order now' using errcode = '42501';
    end if;
    if new.status = 'collected' and old.status <> 'collected' then
      if v_item.stock < new.quantity then
        raise exception 'not enough stock' using errcode = '53400';
      end if;
      update public.club_items set stock = stock - new.quantity where id = v_item.id;
    end if;
  end if;
  return new;
end;
$$;
create trigger item_order_before before insert or update on public.item_orders for each row execute function public.item_order_before();

create table public.equipment_loans (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  item_id uuid not null references public.club_items(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 20),
  issued_by uuid default auth.uid(),
  issued_at timestamptz not null default now(),
  due_back_on date,
  returned_at timestamptz,
  condition_note text check (condition_note is null or char_length(condition_note) <= 300),
  created_at timestamptz not null default now()
);
create index equipment_loans_org on public.equipment_loans (organisation_id, returned_at);
grant select, insert, update, delete on public.equipment_loans to authenticated;
grant all on public.equipment_loans to service_role;
alter table public.equipment_loans enable row level security;
create policy loans_select on public.equipment_loans for select to authenticated
  using (public.is_store_manager(organisation_id) or public.can_act_for_player(player_id));
create policy loans_insert on public.equipment_loans for insert to authenticated with check (public.is_store_manager(organisation_id));
create policy loans_update on public.equipment_loans for update to authenticated using (public.is_store_manager(organisation_id)) with check (public.is_store_manager(organisation_id));
create policy loans_delete on public.equipment_loans for delete to authenticated using (public.is_store_manager(organisation_id));
create or replace function public.equipment_loan_before()
 returns trigger language plpgsql security definer set search_path to '' as $$
declare v_item public.club_items; v_out integer;
begin
  select * into v_item from public.club_items where id = new.item_id for update;
  if not found or v_item.organisation_id <> new.organisation_id then
    raise exception 'that item is not in this club' using errcode = '22023';
  end if;
  if not exists (select 1 from public.players p where p.id = new.player_id and p.organisation_id = new.organisation_id) then
    raise exception 'that player is not in this club' using errcode = '22023';
  end if;
  if new.returned_at is null and (tg_op = 'INSERT' or old.returned_at is not null or new.quantity > old.quantity) then
    select coalesce(sum(l.quantity), 0) into v_out from public.equipment_loans l
     where l.item_id = new.item_id and l.returned_at is null and l.id <> new.id;
    if v_out + new.quantity > v_item.stock then
      raise exception 'not enough left to lend (% of % out)', v_out, v_item.stock using errcode = '53400';
    end if;
  end if;
  return new;
end;
$$;
create trigger equipment_loan_before before insert or update on public.equipment_loans for each row execute function public.equipment_loan_before();
create trigger audit_equipment_loans after insert or update or delete on public.equipment_loans for each row execute function public.audit_row_change('organisation_id');