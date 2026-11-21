-- CricLume P3: auditable director recording controls and isolated live-media signalling.
-- This migration must be deployed only to CricLume's own Supabase project.
begin;

create or replace function public.can_direct_camera_room(p_room_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.camera_rooms r
    join public.matches m on m.id = r.match_id
    where r.id = p_room_id
      and r.status = 'open'
      and (
        public.has_org_role(
          m.owner_organisation_id,
          array['owner','league_admin','club_admin','coach']::public.platform_role[]
        )
        or public.can_score_match(m.id)
      )
  );
$$;
revoke all on function public.can_direct_camera_room(uuid) from public, anon, authenticated;
grant execute on function public.can_direct_camera_room(uuid) to authenticated;

create or replace function public.can_operate_camera_room(p_room_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.camera_devices d
    join public.camera_rooms r on r.id = d.room_id
    where d.room_id = p_room_id
      and d.user_id = (select auth.uid())
      and r.status = 'open'
  );
$$;
revoke all on function public.can_operate_camera_room(uuid) from public, anon, authenticated;
grant execute on function public.can_operate_camera_room(uuid) to authenticated;

-- Camera operators alone may arm their own devices, with separate confirmed
-- recording consent. A director can see these settings, but cannot arm for them.
create table public.camera_recording_arms (
  device_id uuid primary key references public.camera_devices(id) on delete cascade,
  room_id uuid not null references public.camera_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  armed boolean not null default false,
  consent_confirmed boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not armed or consent_confirmed)
);

create index camera_recording_arms_room_idx on public.camera_recording_arms(room_id);
alter table public.camera_recording_arms enable row level security;
revoke all on public.camera_recording_arms from public, anon, authenticated;
grant select, insert, update on public.camera_recording_arms to authenticated;

create policy camera_arms_visible on public.camera_recording_arms
  for select to authenticated using (
    user_id = (select auth.uid()) or public.can_direct_camera_room(room_id)
  );
create policy camera_arms_own_insert on public.camera_recording_arms
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.camera_devices d
      where d.id = device_id and d.room_id = camera_recording_arms.room_id
        and d.user_id = (select auth.uid())
    )
  );
create policy camera_arms_own_update on public.camera_recording_arms
  for update to authenticated using (
    user_id = (select auth.uid())
  ) with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.camera_devices d
      where d.id = device_id and d.room_id = camera_recording_arms.room_id
        and d.user_id = (select auth.uid())
    )
  );

-- Permanent audit trail for short-lived control commands. Recording remains
-- physically limited by the device browser, its consent and media permissions.
create table public.camera_recording_commands (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.camera_rooms(id) on delete cascade,
  device_id uuid not null references public.camera_devices(id) on delete cascade,
  action text not null check (action in ('start', 'stop')),
  source text not null default 'director' check (source in ('director', 'match_state', 'operator')),
  issued_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index camera_recording_commands_recent_idx
  on public.camera_recording_commands(room_id, created_at desc);
alter table public.camera_recording_commands enable row level security;
revoke all on public.camera_recording_commands from public, anon, authenticated;
grant select, insert on public.camera_recording_commands to authenticated;

create policy camera_commands_visible on public.camera_recording_commands
  for select to authenticated using (
    public.can_direct_camera_room(room_id)
    or exists (
      select 1 from public.camera_devices d
      where d.id = camera_recording_commands.device_id
        and d.room_id = camera_recording_commands.room_id
        and d.user_id = (select auth.uid())
    )
  );
create policy camera_commands_director_only on public.camera_recording_commands
  for insert to authenticated with check (
    issued_by = (select auth.uid())
    and source = 'director'
    and public.can_direct_camera_room(room_id)
    and exists (
      select 1 from public.camera_devices d
      where d.id = device_id and d.room_id = camera_recording_commands.room_id
    )
    and (
      action = 'stop'
      or exists (
        select 1 from public.camera_recording_arms a
        where a.device_id = camera_recording_commands.device_id
          and a.room_id = camera_recording_commands.room_id
          and a.armed and a.consent_confirmed
      )
    )
  );

-- The server queues commands on authoritative match status transitions.
-- A camera must be online, open and armed to act on a start command.
create function public.camera_recording_match_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = old.status then return new; end if;
  if new.status = 'live' then
    insert into public.camera_recording_commands(room_id, device_id, action, source, issued_by)
    select r.id, a.device_id, 'start', 'match_state', r.opened_by
    from public.camera_rooms r
    join public.camera_recording_arms a on a.room_id = r.id
    where r.match_id = new.id and r.status = 'open'
      and a.armed and a.consent_confirmed;
  elsif new.status in ('completed', 'abandoned', 'cancelled') then
    insert into public.camera_recording_commands(room_id, device_id, action, source, issued_by)
    select r.id, d.id, 'stop', 'match_state', r.opened_by
    from public.camera_rooms r
    join public.camera_devices d on d.room_id = r.id
    where r.match_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.camera_recording_match_transition() from public, anon, authenticated;
create trigger camera_match_auto_record
after update of status on public.matches
for each row execute function public.camera_recording_match_transition();

-- Arming a device after a match has gone live must not miss the start.
-- Unarming always sends a stop for that device.
create function public.camera_recording_arm_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status public.match_status; v_opened_by uuid;
begin
  if tg_op = 'UPDATE' and old.armed = new.armed then return new; end if;
  select m.status, r.opened_by into v_status, v_opened_by
  from public.camera_rooms r join public.matches m on m.id = r.match_id
  where r.id = new.room_id;
  if new.armed and v_status = 'live' then
    insert into public.camera_recording_commands(room_id, device_id, action, source, issued_by)
    values (new.room_id, new.device_id, 'start', 'operator', v_opened_by);
  elsif tg_op = 'UPDATE' and old.armed and not new.armed then
    insert into public.camera_recording_commands(room_id, device_id, action, source, issued_by)
    values (new.room_id, new.device_id, 'stop', 'operator', v_opened_by);
  end if;
  return new;
end;
$$;
revoke all on function public.camera_recording_arm_transition() from public, anon, authenticated;
create trigger camera_arm_auto_record
after insert or update of armed on public.camera_recording_arms
for each row execute function public.camera_recording_arm_transition();

-- Separate media signalling from the broad match-presence channel. Spectators
-- cannot subscribe to live camera SDP/ICE traffic. WebRTC media stays encrypted.
create policy camera_live_signal_read on realtime.messages for select to authenticated
using (
  (select realtime.topic()) ~ '^camera-live:[0-9a-fA-F-]{36}$'
  and realtime.messages.extension = 'broadcast'
  and (
    public.can_direct_camera_room(split_part((select realtime.topic()), ':', 2)::uuid)
    or public.can_operate_camera_room(split_part((select realtime.topic()), ':', 2)::uuid)
  )
);
create policy camera_live_signal_write on realtime.messages for insert to authenticated
with check (
  (select realtime.topic()) ~ '^camera-live:[0-9a-fA-F-]{36}$'
  and realtime.messages.extension = 'broadcast'
  and (
    public.can_direct_camera_room(split_part((select realtime.topic()), ':', 2)::uuid)
    or public.can_operate_camera_room(split_part((select realtime.topic()), ':', 2)::uuid)
  )
);

alter publication supabase_realtime add table public.camera_recording_commands;
commit;
