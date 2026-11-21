-- CricLume: human-approved private cloud archive import staging.
-- Runs only in the actual CricLume project after the prior camera migrations.
begin;

create table public.camera_cloud_import_jobs (
  recording_id uuid primary key references public.camera_cloud_recordings(id) on delete cascade,
  asset_id uuid not null unique default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  room_id uuid not null references public.camera_rooms(id) on delete cascade,
  device_id uuid not null references public.camera_devices(id) on delete restrict,
  approved_by uuid not null references auth.users(id) on delete restrict,
  recording_permission_attested boolean not null check (recording_permission_attested),
  includes_junior boolean not null default true,
  guardian_permission_attested boolean not null default false,
  retention_expires_at timestamptz not null,
  state text not null default 'approved' check (
    state in ('approved', 'importing', 'imported', 'manual_review')
  ),
  failure_code text check (
    failure_code is null or failure_code in (
      'large_file_requires_external_worker',
      'permission_expired', 'role_revoked', 'tenant_mismatch',
      'source_changed', 'transfer_failed', 'asset_write_failed',
      'storage_configuration', 'recording_unavailable'
    )
  ),
  approved_at timestamptz not null default now(),
  claimed_at timestamptz,
  imported_at timestamptz,
  updated_at timestamptz not null default now(),
  check (not includes_junior or guardian_permission_attested),
  check (state <> 'imported' or imported_at is not null),
  check (state <> 'manual_review' or failure_code is not null)
);

create index camera_cloud_import_jobs_ready
  on public.camera_cloud_import_jobs(approved_at)
  where state = 'approved';

alter table public.camera_cloud_import_jobs enable row level security;
revoke all on public.camera_cloud_import_jobs from public, anon, authenticated;
grant select on public.camera_cloud_import_jobs to authenticated;
grant all on public.camera_cloud_import_jobs to service_role;

create policy camera_cloud_import_jobs_authorised_read
  on public.camera_cloud_import_jobs for select to authenticated
  using (
    public.can_direct_camera_room(room_id)
    or public.has_org_role(
      organisation_id,
      array['owner', 'safeguarding_officer']::public.platform_role[]
    )
  );

-- Human review requests are accepted only by a separate JWT-authenticated
-- Edge Function that revalidates owner/safeguarding role and permission.
-- All state changes and file-copy claims are service-role only.
commit;
