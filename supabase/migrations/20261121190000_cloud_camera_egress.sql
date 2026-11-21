-- CricLume P3 cloud capture: real provider job metadata, no simulated recordings.
-- This migration MUST only be deployed to the authorised CricLume project.
begin;

create table public.camera_cloud_recordings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.camera_rooms(id) on delete cascade,
  device_id uuid not null references public.camera_devices(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  provider text not null default 'livekit' check (provider = 'livekit'),
  provider_egress_id text unique,
  provider_room_name text not null check (char_length(provider_room_name) between 12 and 150),
  object_path text not null unique check (object_path ~ '^[a-z0-9/-]+\.mp4$'),
  state text not null default 'starting' check (
    state in ('starting', 'recording', 'stopping', 'provider_completed', 'failed')
  ),
  provider_status integer,
  provider_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Only one chargeable egress request can be in progress per paired device.
create unique index camera_cloud_recording_active_device
  on public.camera_cloud_recordings(device_id)
  where state in ('starting','recording','stopping');

create index camera_cloud_recording_room_recent
  on public.camera_cloud_recordings(room_id, created_at desc);

alter table public.camera_cloud_recordings enable row level security;
revoke all on public.camera_cloud_recordings from public, anon, authenticated;
grant select on public.camera_cloud_recordings to authenticated;
grant all on public.camera_cloud_recordings to service_role;

create policy camera_cloud_recordings_authorised_read
  on public.camera_cloud_recordings for select to authenticated
  using (
    public.can_direct_camera_room(room_id)
    or exists (
      select 1 from public.camera_devices d
      where d.id = camera_cloud_recordings.device_id
        and d.room_id = camera_cloud_recordings.room_id
        and d.user_id = (select auth.uid())
    )
  );

-- Server-side invocation with service credentials is required for all writes.
-- The provider-completed state is intentionally NOT called "saved" or "ready";
-- downstream archive verification and consent/retention review are separate.
commit;
