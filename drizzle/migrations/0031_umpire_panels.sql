create or replace function public.is_umpire_manager(p_org uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select public.has_org_role(p_org, array['owner','club_admin','league_admin']::public.platform_role[]); $$;

create or replace function public.is_umpire_payer(p_org uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select public.has_org_role(p_org, array['owner','club_admin','league_admin','treasurer']::public.platform_role[]); $$;

-- Panel rules
create table public.umpire_panel_settings (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  requires_qualification boolean not null default false,
  requires_safeguarding boolean not null default true,
  requires_first_aid boolean not null default false,
  requires_kit boolean not null default false,
  default_pay_basis text not null default 'paid' check (default_pay_basis in ('paid','voluntary')),
  default_fee_minor integer not null default 0 check (default_fee_minor between 0 and 100000000),
  travel_rate_minor integer not null default 0 check (travel_rate_minor between 0 and 1000000),
  currency text not null default 'GBP' check (currency ~ '^[A-Z]{3}$'),
  guidance text check (guidance is null or char_length(guidance) <= 2000),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.umpire_panel_settings to authenticated;
grant all on public.umpire_panel_settings to service_role;
alter table public.umpire_panel_settings enable row level security;

-- Umpires on a panel
create table public.umpires (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid,
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 40),
  grade text not null default 'club' check (grade in ('trainee','club','league','senior','elite')),
  qualification text check (qualification is null or char_length(qualification) <= 160),
  qualification_expires date,
  safeguarding_expires date,
  first_aid_expires date,
  kit_ok boolean not null default false,
  pay_basis text not null default 'paid' check (pay_basis in ('paid','voluntary')),
  match_fee_minor integer check (match_fee_minor is null or match_fee_minor between 0 and 100000000),
  home_area text check (home_area is null or char_length(home_area) <= 120),
  max_travel_km integer check (max_travel_km is null or max_travel_km between 0 and 2000),
  status text not null default 'active' check (status in ('active','paused','left')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index umpires_org_user on public.umpires (organisation_id, user_id) where user_id is not null;
create unique index umpires_org_email on public.umpires (organisation_id, lower(email)) where email is not null;
create index umpires_user on public.umpires (user_id);
grant select, insert, update, delete on public.umpires to authenticated;
grant all on public.umpires to service_role;
alter table public.umpires enable row level security;

-- Appointments
create table public.umpire_appointments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  umpire_id uuid not null references public.umpires(id) on delete cascade,
  fixture_id uuid references public.fixtures(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  starts_at timestamptz not null,
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  venue text check (venue is null or char_length(venue) <= 200),
  position text not null default 'standing' check (position in ('standing','square_leg','third','fourth','referee','reserve')),
  status text not null default 'offered' check (status in ('offered','accepted','declined','withdrawn','completed')),
  pay_basis text not null default 'paid' check (pay_basis in ('paid','voluntary')),
  fee_minor integer not null default 0 check (fee_minor between 0 and 100000000),
  currency text not null default 'GBP' check (currency ~ '^[A-Z]{3}$'),
  travel_km integer check (travel_km is null or travel_km between 0 and 5000),
  expenses_minor integer not null default 0 check (expenses_minor between 0 and 100000000),
  expenses_note text check (expenses_note is null or char_length(expenses_note) <= 500),
  payment_status text not null default 'not_due' check (payment_status in ('not_due','due','approved','paid','not_applicable')),
  paid_on date,
  payment_reference text check (payment_reference is null or char_length(payment_reference) <= 120),
  report_at timestamptz,
  meet_point text check (meet_point is null or char_length(meet_point) <= 200),
  travel_notes text check (travel_notes is null or char_length(travel_notes) <= 1000),
  contact_name text check (contact_name is null or char_length(contact_name) <= 120),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40),
  response_note text check (response_note is null or char_length(response_note) <= 500),
  responded_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index umpire_appointments_org_time on public.umpire_appointments (organisation_id, starts_at);
create index umpire_appointments_umpire_time on public.umpire_appointments (umpire_id, starts_at);
create unique index umpire_appointments_one_per_fixture on public.umpire_appointments (umpire_id, fixture_id)
  where fixture_id is not null and status in ('offered','accepted','completed');
grant select, insert, update, delete on public.umpire_appointments to authenticated;
grant all on public.umpire_appointments to service_role;
alter table public.umpire_appointments enable row level security;

-- Availability (per person, shared across panels)
create table public.umpire_availability (
  user_id uuid not null default auth.uid(),
  day date not null,
  status text not null check (status in ('available','unavailable','maybe')),
  note text check (note is null or char_length(note) <= 200),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
grant select, insert, update, delete on public.umpire_availability to authenticated;
grant all on public.umpire_availability to service_role;
alter table public.umpire_availability enable row level security;

create or replace function public.is_my_umpire(p_umpire_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select exists (select 1 from public.umpires u where u.id = p_umpire_id and u.user_id = (select auth.uid())); $$;

create or replace function public.on_my_umpire_panel(p_org uuid)
returns boolean language sql stable security definer set search_path to ''
as $$ select exists (select 1 from public.umpires u where u.organisation_id = p_org and u.user_id = (select auth.uid()) and u.status <> 'left'); $$;

create or replace function public.can_view_umpire_availability(p_user uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
  select p_user = (select auth.uid()) or exists (
    select 1 from public.umpires u
    where u.user_id = p_user and u.status <> 'left'
      and (public.is_umpire_manager(u.organisation_id))
  );
$$;

-- Policies
create policy "Panel rules visible to managers, treasurers and panel umpires" on public.umpire_panel_settings
  for select to authenticated using (public.is_umpire_payer(organisation_id) or public.on_my_umpire_panel(organisation_id));
create policy "Managers add panel rules" on public.umpire_panel_settings
  for insert to authenticated with check (public.is_umpire_manager(organisation_id));
create policy "Managers change panel rules" on public.umpire_panel_settings
  for update to authenticated using (public.is_umpire_manager(organisation_id)) with check (public.is_umpire_manager(organisation_id));

create policy "Umpires visible to managers, treasurers and the umpire" on public.umpires
  for select to authenticated using (public.is_umpire_payer(organisation_id) or user_id = (select auth.uid()));
create policy "Managers add umpires" on public.umpires
  for insert to authenticated with check (public.is_umpire_manager(organisation_id));
create policy "Managers change umpires" on public.umpires
  for update to authenticated using (public.is_umpire_manager(organisation_id)) with check (public.is_umpire_manager(organisation_id));
create policy "Managers remove umpires" on public.umpires
  for delete to authenticated using (public.is_umpire_manager(organisation_id));

create policy "Appointments visible to managers, treasurers and the umpire" on public.umpire_appointments
  for select to authenticated using (public.is_umpire_payer(organisation_id) or public.is_my_umpire(umpire_id));
create policy "Managers appoint umpires" on public.umpire_appointments
  for insert to authenticated with check (public.is_umpire_manager(organisation_id));
create policy "Managers change appointments" on public.umpire_appointments
  for update to authenticated using (public.is_umpire_manager(organisation_id)) with check (public.is_umpire_manager(organisation_id));
create policy "Managers remove appointments" on public.umpire_appointments
  for delete to authenticated using (public.is_umpire_manager(organisation_id) and status in ('offered','declined','withdrawn'));

create policy "Umpires and their panel managers see availability" on public.umpire_availability
  for select to authenticated using (public.can_view_umpire_availability(user_id));
create policy "Umpires add their availability" on public.umpire_availability
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Umpires change their availability" on public.umpire_availability
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Umpires clear their availability" on public.umpire_availability
  for delete to authenticated using (user_id = (select auth.uid()));

-- Umpire row checks
create or replace function public.umpire_before()
returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.display_name := btrim(new.display_name);
  new.updated_at := now();
  if new.user_id is not null
     and (tg_op = 'INSERT' or new.user_id is distinct from old.user_id)
     and coalesce(current_setting('criclume.umpire_link', true), '') <> 'on'
     and not exists (
       select 1 from public.organisation_members m
       where m.organisation_id = new.organisation_id and m.user_id = new.user_id and m.status = 'active'
     ) then
    raise exception 'Only club members can be linked directly. Add the umpire by email instead — they link when they sign in.';
  end if;
  if tg_op = 'UPDATE' and new.organisation_id <> old.organisation_id then
    raise exception 'An umpire can''t move to another panel';
  end if;
  return new;
end;
$$;
create trigger umpires_before before insert or update on public.umpires
  for each row execute function public.umpire_before();

-- Appointment checks
create or replace function public.umpire_appointment_before()
returns trigger language plpgsql security definer set search_path to ''
as $$
declare
  v_ump public.umpires%rowtype;
  v_rules public.umpire_panel_settings%rowtype;
  v_day date;
  v_needs_check boolean;
begin
  new.updated_at := now();
  select * into v_ump from public.umpires where id = new.umpire_id;
  if not found or v_ump.organisation_id <> new.organisation_id then
    raise exception 'That umpire isn''t on this panel';
  end if;
  if tg_op = 'UPDATE' and (new.organisation_id <> old.organisation_id) then
    raise exception 'An appointment can''t move to another club';
  end if;
  begin
    v_day := (new.starts_at at time zone new.timezone)::date;
  exception when others then
    raise exception 'Unknown time zone %', new.timezone;
  end;

  if new.pay_basis = 'voluntary' then
    new.fee_minor := 0;
  end if;

  v_needs_check := tg_op = 'INSERT'
    or new.umpire_id <> old.umpire_id
    or new.starts_at <> old.starts_at
    or (new.status in ('offered','accepted') and old.status not in ('offered','accepted'));

  if v_needs_check and new.status in ('offered','accepted') then
    if v_ump.status <> 'active' then
      raise exception '% is not active on the panel', v_ump.display_name;
    end if;
    select * into v_rules from public.umpire_panel_settings where organisation_id = new.organisation_id;
    if found then
      if v_rules.requires_qualification and (v_ump.qualification is null or (v_ump.qualification_expires is not null and v_ump.qualification_expires < v_day)) then
        raise exception '% needs a current umpiring qualification for this match', v_ump.display_name;
      end if;
      if v_rules.requires_safeguarding and (v_ump.safeguarding_expires is null or v_ump.safeguarding_expires < v_day) then
        raise exception '% needs a safeguarding check that is valid on match day', v_ump.display_name;
      end if;
      if v_rules.requires_first_aid and (v_ump.first_aid_expires is null or v_ump.first_aid_expires < v_day) then
        raise exception '% needs first aid that is valid on match day', v_ump.display_name;
      end if;
      if v_rules.requires_kit and not v_ump.kit_ok then
        raise exception '% needs their kit checked first', v_ump.display_name;
      end if;
    end if;
    if exists (
      select 1 from public.umpire_appointments a
      join public.umpires u on u.id = a.umpire_id
      where a.id <> new.id
        and a.status in ('offered','accepted')
        and (a.umpire_id = new.umpire_id or (v_ump.user_id is not null and u.user_id = v_ump.user_id))
        and a.starts_at > new.starts_at - interval '8 hours'
        and a.starts_at < new.starts_at + interval '8 hours'
    ) then
      raise exception '% already has a match at that time', v_ump.display_name;
    end if;
    if v_ump.user_id is not null and exists (
      select 1 from public.umpire_availability av
      where av.user_id = v_ump.user_id and av.day = v_day and av.status = 'unavailable'
    ) then
      raise exception '% has said they are unavailable that day', v_ump.display_name;
    end if;
  end if;

  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then
    if new.starts_at > now() then
      raise exception 'Mark the appointment done once the match has started';
    end if;
    if new.payment_status in ('not_due','not_applicable') then
      new.payment_status := case when new.fee_minor + new.expenses_minor > 0 then 'due' else 'not_applicable' end;
    end if;
  end if;
  if new.status in ('declined','withdrawn') and new.payment_status in ('not_due','due') then
    new.payment_status := 'not_applicable';
  end if;
  if new.payment_status in ('approved','paid') and new.status <> 'completed' then
    raise exception 'Only completed appointments can be approved or paid';
  end if;
  if new.payment_status = 'paid' and new.paid_on is null then
    new.paid_on := current_date;
  end if;
  return new;
end;
$$;
create trigger umpire_appointments_before before insert or update on public.umpire_appointments
  for each row execute function public.umpire_appointment_before();

create or replace function public.umpire_touch()
returns trigger language plpgsql set search_path to ''
as $$ begin new.updated_at := now(); return new; end; $$;
create trigger umpire_panel_settings_touch before update on public.umpire_panel_settings
  for each row execute function public.umpire_touch();
create trigger umpire_availability_touch before update on public.umpire_availability
  for each row execute function public.umpire_touch();

create trigger umpires_audit after insert or update or delete on public.umpires
  for each row execute function public.audit_row_change('organisation_id');
create trigger umpire_appointments_audit after insert or update or delete on public.umpire_appointments
  for each row execute function public.audit_row_change('organisation_id');

-- Umpire actions
create or replace function public.link_my_umpire_profiles()
returns integer language plpgsql security definer set search_path to ''
as $$
declare v_email text; v_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  perform set_config('criclume.umpire_link', 'on', true);
  update public.umpires u set user_id = auth.uid()
  where u.user_id is null and u.email = v_email
    and not exists (select 1 from public.umpires o where o.organisation_id = u.organisation_id and o.user_id = auth.uid());
  get diagnostics v_count = row_count;
  perform set_config('criclume.umpire_link', '', true);
  return v_count;
end;
$$;

create or replace function public.my_umpire_panels()
returns jsonb language sql stable security definer set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'umpire', to_jsonb(u),
    'organisation', jsonb_build_object('id', o.id, 'name', o.name, 'kind', o.kind),
    'rules', to_jsonb(s)
  ) order by o.name), '[]'::jsonb)
  from public.umpires u
  join public.organisations o on o.id = u.organisation_id
  left join public.umpire_panel_settings s on s.organisation_id = u.organisation_id
  where u.user_id = (select auth.uid()) and u.status <> 'left';
$$;

create or replace function public.respond_umpire_appointment(p_id uuid, p_accept boolean, p_note text default null)
returns void language plpgsql security definer set search_path to ''
as $$
declare v public.umpire_appointments%rowtype;
begin
  select * into v from public.umpire_appointments where id = p_id for update;
  if not found or not public.is_my_umpire(v.umpire_id) then raise exception 'This appointment isn''t yours'; end if;
  if v.starts_at < now() then raise exception 'This match has already started'; end if;
  if p_accept then
    if v.status <> 'offered' then raise exception 'Only offered appointments can be accepted'; end if;
    update public.umpire_appointments set status = 'accepted', responded_at = now(), response_note = nullif(btrim(coalesce(p_note, '')), '') where id = p_id;
  else
    if v.status not in ('offered','accepted') then raise exception 'This appointment can''t be declined now'; end if;
    if v.status = 'accepted' and nullif(btrim(coalesce(p_note, '')), '') is null then
      raise exception 'Say why you''re pulling out so the appointments officer can find cover';
    end if;
    update public.umpire_appointments
      set status = case when v.status = 'accepted' then 'withdrawn' else 'declined' end,
          responded_at = now(), response_note = left(nullif(btrim(coalesce(p_note, '')), ''), 500)
      where id = p_id;
  end if;
end;
$$;

create or replace function public.claim_umpire_expenses(p_id uuid, p_km integer, p_amount_minor integer, p_note text default null)
returns void language plpgsql security definer set search_path to ''
as $$
declare v public.umpire_appointments%rowtype;
begin
  select * into v from public.umpire_appointments where id = p_id for update;
  if not found or not public.is_my_umpire(v.umpire_id) then raise exception 'This appointment isn''t yours'; end if;
  if v.status not in ('accepted','completed') or v.starts_at > now() then raise exception 'Claim travel after the match'; end if;
  if v.payment_status in ('approved','paid') then raise exception 'This payment is already approved — ask the treasurer to change it'; end if;
  if p_amount_minor < 0 or p_amount_minor > 100000000 or (p_km is not null and (p_km < 0 or p_km > 5000)) then raise exception 'Check the amount and distance'; end if;
  update public.umpire_appointments
    set travel_km = p_km, expenses_minor = p_amount_minor,
        expenses_note = left(nullif(btrim(coalesce(p_note, '')), ''), 500),
        payment_status = case when status = 'completed' and fee_minor + p_amount_minor > 0 then 'due'
                              when status = 'completed' then 'not_applicable' else payment_status end
    where id = p_id;
end;
$$;

create or replace function public.set_umpire_payment(p_id uuid, p_status text, p_reference text default null, p_paid_on date default null)
returns void language plpgsql security definer set search_path to ''
as $$
declare v public.umpire_appointments%rowtype;
begin
  select * into v from public.umpire_appointments where id = p_id for update;
  if not found or not public.is_umpire_payer(v.organisation_id) then raise exception 'Only treasurers and admins can record umpire payments'; end if;
  if p_status not in ('due','approved','paid') then raise exception 'Unknown payment step'; end if;
  if v.status <> 'completed' then raise exception 'Mark the match done before paying'; end if;
  if p_status = 'paid' and nullif(btrim(coalesce(p_reference, '')), '') is null and v.fee_minor + v.expenses_minor > 0 then
    raise exception 'Add the transfer reference';
  end if;
  update public.umpire_appointments
    set payment_status = p_status,
        payment_reference = case when p_status = 'paid' then left(nullif(btrim(coalesce(p_reference, '')), ''), 120) else null end,
        paid_on = case when p_status = 'paid' then coalesce(p_paid_on, current_date) else null end
    where id = p_id;
end;
$$;

create or replace function public.update_my_umpire_details(p_umpire_id uuid, p_phone text, p_home_area text, p_max_travel_km integer)
returns void language plpgsql security definer set search_path to ''
as $$
begin
  if not public.is_my_umpire(p_umpire_id) then raise exception 'This isn''t your umpire record'; end if;
  update public.umpires
    set phone = left(nullif(btrim(coalesce(p_phone, '')), ''), 40),
        home_area = left(nullif(btrim(coalesce(p_home_area, '')), ''), 120),
        max_travel_km = case when p_max_travel_km between 0 and 2000 then p_max_travel_km else null end
    where id = p_umpire_id;
end;
$$;

revoke execute on function public.link_my_umpire_profiles() from public, anon;
revoke execute on function public.my_umpire_panels() from public, anon;
revoke execute on function public.respond_umpire_appointment(uuid, boolean, text) from public, anon;
revoke execute on function public.claim_umpire_expenses(uuid, integer, integer, text) from public, anon;
revoke execute on function public.set_umpire_payment(uuid, text, text, date) from public, anon;
revoke execute on function public.update_my_umpire_details(uuid, text, text, integer) from public, anon;
grant execute on function public.link_my_umpire_profiles() to authenticated;
grant execute on function public.my_umpire_panels() to authenticated;
grant execute on function public.respond_umpire_appointment(uuid, boolean, text) to authenticated;
grant execute on function public.claim_umpire_expenses(uuid, integer, integer, text) to authenticated;
grant execute on function public.set_umpire_payment(uuid, text, text, date) to authenticated;
grant execute on function public.update_my_umpire_details(uuid, text, text, integer) to authenticated;