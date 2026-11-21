-- CricLume cloud auto recording: separate opt-in from local capture arming.
-- Apply only to the verified CricLume project. No cron job is installed here.
begin;

alter table public.camera_cloud_recordings
  add column start_source text not null default 'director'
  check (start_source in ('director', 'match_state'));

-- One automatic job per camera per match room: prevent loops that repeatedly
-- restart paid egress after failure, manual stop or duration expiration.
create unique index camera_cloud_once_per_match_room_device
  on public.camera_cloud_recordings(room_id, device_id)
  where start_source = 'match_state';

create table public.camera_cloud_auto_opt_ins (
  device_id uuid primary key references public.camera_devices(id) on delete cascade,
  room_id uuid not null references public.camera_rooms(id) on delete cascade,
  operator_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  adult_only_attested boolean not null default false,
  opted_in_at timestamptz,
  updated_at timestamptz not null default now(),
  check (not enabled or adult_only_attested),
  check (not enabled or opted_in_at is not null)
);

create index camera_cloud_auto_opt_ins_room
  on public.camera_cloud_auto_opt_ins(room_id)
  where enabled;

alter table public.camera_cloud_auto_opt_ins enable row level security;
revoke all on public.camera_cloud_auto_opt_ins from public, anon, authenticated;
grant select, insert, update on public.camera_cloud_auto_opt_ins to authenticated;
grant all on public.camera_cloud_auto_opt_ins to service_role;

create policy camera_auto_opt_ins_read on public.camera_cloud_auto_opt_ins
  for select to authenticated
  using (
    operator_id = (select auth.uid())
    or public.can_direct_camera_room(room_id)
  );

create policy camera_auto_opt_ins_operator_insert on public.camera_cloud_auto_opt_ins
  for insert to authenticated with check (
    operator_id = (select auth.uid())
    and exists (
      select 1
      from public.camera_devices d
      join public.camera_rooms r on r.id = d.room_id
      where d.id = camera_cloud_auto_opt_ins.device_id
        and d.room_id = camera_cloud_auto_opt_ins.room_id
        and d.user_id = (select auth.uid())
        and r.status = 'open'
    )
    and (
      not enabled
      or exists (
        select 1 from public.camera_recording_arms a
        where a.device_id = camera_cloud_auto_opt_ins.device_id
          and a.room_id = camera_cloud_auto_opt_ins.room_id
          and a.user_id = (select auth.uid())
          and a.armed and a.consent_confirmed
      )
    )
  );

create policy camera_auto_opt_ins_operator_update on public.camera_cloud_auto_opt_ins
  for update to authenticated
  using (operator_id = (select auth.uid()))
  with check (
    operator_id = (select auth.uid())
    and exists (
      select 1
      from public.camera_devices d
      join public.camera_rooms r on r.id = d.room_id
      where d.id = camera_cloud_auto_opt_ins.device_id
        and d.room_id = camera_cloud_auto_opt_ins.room_id
        and d.user_id = (select auth.uid())
        and r.status = 'open'
    )
    and (
      not enabled
      or exists (
        select 1 from public.camera_recording_arms a
        where a.device_id = camera_cloud_auto_opt_ins.device_id
          and a.room_id = camera_cloud_auto_opt_ins.room_id
          and a.user_id = (select auth.uid())
          and a.armed and a.consent_confirmed
      )
    )
  );

-- Cloud auto rows and paid jobs are written by trusted backend code only.
-- Operators cannot elevate their own opt-in to organisation-wide approval.
commit;
