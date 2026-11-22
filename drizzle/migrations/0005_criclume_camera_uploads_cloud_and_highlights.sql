-- ==== 20261121142000_camera_upload_integrity.sql
-- CricLume P3 follow-up: seal camera-to-organisation integrity and finalise
-- video uploads for paired (non-member) camera operators without broad UPDATE.
-- Apply ONLY in CricLume's own Supabase project, never the Dishbee project.
drop policy if exists video_assets_capture_insert on public.video_assets;
create policy video_assets_capture_insert on public.video_assets
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and status = 'uploading'
    and recording_consent = 'granted'
    and publication_consent = 'pending'
    and storage_path is null
    and started_at < ended_at
    and retention_expires_at > now()
    and content_type in ('video/mp4', 'video/webm')
    and exists (
      select 1
      from public.camera_devices d
      join public.camera_rooms r on r.id = d.room_id
      join public.matches m on m.id = r.match_id
      where d.id = video_assets.device_id
        and r.id = video_assets.room_id
        and m.owner_organisation_id = video_assets.organisation_id
        and (
          d.user_id = (select auth.uid())
          or public.has_org_role(
            m.owner_organisation_id,
            array['owner', 'league_admin', 'club_admin', 'scorer', 'coach']::public.platform_role[]
          )
        )
    )
  );

-- Returning the new asset ID after INSERT requires SELECT under RLS.
-- Paired operators may read ONLY the video assets they themselves created.
drop policy if exists video_assets_member_select on public.video_assets;
create policy video_assets_member_select on public.video_assets
  for select to authenticated
  using (
    public.is_org_member(organisation_id)
    or (
      created_by = (select auth.uid())
      and exists (
        select 1 from public.camera_devices d
        where d.id = video_assets.device_id
          and d.room_id = video_assets.room_id
          and d.user_id = (select auth.uid())
      )
    )
  );

-- Deliberately security definer: paired camera operators may not belong to the
-- club membership table, while direct video_assets UPDATE is restricted.
-- This function can ONLY set the fixed storage_path and uploaded status of a
-- real, already present source object belonging to the calling operator.
create function public.complete_camera_asset_upload(
  p_asset_id uuid,
  p_storage_path text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.video_assets;
  v_expected text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in as the paired camera operator' using errcode = '42501';
  end if;

  select a.* into v_asset
    from public.video_assets a
    join public.camera_devices d on d.id = a.device_id and d.room_id = a.room_id
    join public.camera_rooms r on r.id = a.room_id
    join public.matches m on m.id = r.match_id
   where a.id = p_asset_id
     and a.created_by = (select auth.uid())
     and d.user_id = (select auth.uid())
     and m.owner_organisation_id = a.organisation_id
   for update of a;

  if not found then
    raise exception 'Camera asset does not belong to this paired operator'
      using errcode = '42501';
  end if;

  if v_asset.recording_consent <> 'granted'
     or v_asset.retention_expires_at <= now() then
    raise exception 'Recording consent or retention is no longer valid'
      using errcode = '42501';
  end if;

  v_expected := v_asset.organisation_id::text || '/' || v_asset.room_id::text
    || '/' || v_asset.id::text || '/source.'
    || case when v_asset.content_type = 'video/mp4' then 'mp4' else 'webm' end;

  if p_storage_path is distinct from v_expected then
    raise exception 'Unexpected private recording path' using errcode = '22023';
  end if;

  if v_asset.status = 'uploaded' and v_asset.storage_path = v_expected then
    return v_asset.id;
  end if;

  if v_asset.status <> 'uploading' or v_asset.storage_path is not null then
    raise exception 'Recording is not awaiting upload completion' using errcode = '22023';
  end if;

  if not exists (
    select 1 from storage.objects s
     where s.bucket_id = 'match-video' and s.name = v_expected
  ) then
    raise exception 'Source recording is missing from private Storage'
      using errcode = '22023';
  end if;

  update public.video_assets
     set storage_path = v_expected, status = 'uploaded'
   where id = v_asset.id;

  return v_asset.id;
end;
$$;

revoke all on function public.complete_camera_asset_upload(uuid,text)
  from public, anon, authenticated;
grant execute on function public.complete_camera_asset_upload(uuid,text)
  to authenticated;

-- ==== 20261121173000_camera_command_receipts.sql
-- CricLume: private, append-only camera command acknowledgment ledger.
-- A receipt is a phone-reported response, NOT proof that video reached storage.
create table public.camera_command_receipts (
  command_id uuid primary key references public.camera_recording_commands(id) on delete cascade,
  room_id uuid not null references public.camera_rooms(id) on delete cascade,
  device_id uuid not null references public.camera_devices(id) on delete cascade,
  reported_by uuid not null references auth.users(id),
  outcome text not null check (
    outcome in ('started','already_recording','stopped','already_stopped','blocked','failed')
  ),
  reason_code text not null default 'none' check (
    reason_code in ('none','missing_consent','not_armed','preview_off','capture_failed')
  ),
  reported_at timestamptz not null default now(),
  check (
    (outcome in ('started','already_recording','stopped','already_stopped') and reason_code = 'none')
    or (outcome = 'blocked' and reason_code in ('missing_consent','not_armed','preview_off'))
    or (outcome = 'failed' and reason_code = 'capture_failed')
  )
);

create index camera_command_receipts_room_device_idx
  on public.camera_command_receipts(room_id, device_id, reported_at desc);

alter table public.camera_command_receipts enable row level security;
revoke all on public.camera_command_receipts from public, anon, authenticated;
grant select, insert on public.camera_command_receipts to authenticated;

create policy camera_command_receipts_read on public.camera_command_receipts
  for select to authenticated using (
    public.can_direct_camera_room(room_id)
    or exists (
      select 1 from public.camera_devices d
      where d.id = camera_command_receipts.device_id
        and d.room_id = camera_command_receipts.room_id
        and d.user_id = (select auth.uid())
    )
  );

-- Only the explicitly paired device owner may add the single immutable outcome
-- for a recent command addressed to exactly that device and room. A director
-- cannot impersonate a phone acknowledgment.
create policy camera_command_receipts_operator_insert on public.camera_command_receipts
  for insert to authenticated with check (
    reported_by = (select auth.uid())
    and exists (
      select 1 from public.camera_recording_commands c
      join public.camera_devices d on d.id = c.device_id and d.room_id = c.room_id
      where c.id = camera_command_receipts.command_id
        and c.room_id = camera_command_receipts.room_id
        and c.device_id = camera_command_receipts.device_id
        and d.user_id = (select auth.uid())
        and c.created_at >= now() - interval '5 minutes'
        and c.created_at <= now() + interval '5 seconds'
        and (
          (
            c.action = 'start'
            and camera_command_receipts.outcome in ('started','already_recording','blocked','failed')
          )
          or (
            c.action = 'stop'
            and camera_command_receipts.outcome in ('stopped','already_stopped','failed')
          )
        )
    )
  );

-- No authenticated UPDATE or DELETE grants: acknowledgments are immutable.
-- Supabase service role has its existing administrative bypass for audits.

-- ==== 20261121190000_cloud_camera_egress.sql
-- CricLume P3 cloud capture: real provider job metadata, no simulated recordings.
-- This migration MUST only be deployed to the authorised CricLume project.
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

-- ==== 20261121200000_cloud_camera_match_auto.sql
-- CricLume cloud auto recording: separate opt-in from local capture arming.
-- Apply only to the verified CricLume project. No cron job is installed here.
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

-- ==== 20261121220000_camera_cloud_archive_inspection.sql
-- CricLume: check real private S3 video objects after signed LiveKit egress completion.
-- Do not deploy this to Dishbee or treat object existence as publication approval.
alter table public.camera_cloud_recordings
  add column archive_check_status text not null default 'uninspected'
    check (archive_check_status in (
      'uninspected','object_confirmed','object_missing',
      'invalid_object','storage_error','review_required'
    )),
  add column archive_check_attempts integer not null default 0
    check (archive_check_attempts between 0 and 5),
  add column archive_object_bytes bigint
    check (archive_object_bytes is null or archive_object_bytes >= 0),
  add column archive_object_etag text
    check (archive_object_etag is null or char_length(archive_object_etag) <= 200),
  add column archive_checked_at timestamptz,
  add column archive_object_confirmed_at timestamptz,
  add constraint cloud_archive_confirmed_only_with_evidence check (
    archive_check_status <> 'object_confirmed'
    or (
      archive_object_bytes >= 1024
      and archive_checked_at is not null
      and archive_object_confirmed_at is not null
      and state = 'provider_completed'
    )
  );

create index camera_cloud_archive_inspection_pending
  on public.camera_cloud_recordings(created_at)
  where state = 'provider_completed'
    and archive_check_status in ('uninspected','object_missing','storage_error')
    and archive_check_attempts < 5;

-- The parent table already has RLS and no authenticated INSERT/UPDATE/DELETE
-- grants. Only the service role updates verified object metadata.
-- Even after an object is confirmed, all viewing and download permissions
-- remain separate from this non-public storage evidence.

-- ==== 20261121235000_camera_private_archive_import.sql
-- CricLume: human-approved private cloud archive import staging.
-- Runs only in the actual CricLume project after the prior camera migrations.
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

-- ==== 20261122131914_camera_replay_calibration_highlights.sql
-- CricLume: manual timing calibration and *private* editorial highlight candidates.
-- All playback remains governed by existing asset RLS and blur requirements.
create table public.camera_clip_calibrations (
  asset_id uuid primary key references public.video_assets(id) on delete cascade,
  room_id uuid not null references public.camera_rooms(id) on delete cascade,
  offset_ms integer not null default 0 check (offset_ms between -30000 and 30000),
  method text not null default 'manual_review' check (method = 'manual_review'),
  calibrated_by uuid not null references auth.users(id),
  calibrated_at timestamptz not null default now()
);

alter table public.camera_clip_calibrations enable row level security;
revoke all on public.camera_clip_calibrations from public, anon, authenticated;
grant select, insert, update on public.camera_clip_calibrations to authenticated;
grant all on public.camera_clip_calibrations to service_role;

create policy camera_calibration_private_read on public.camera_clip_calibrations
  for select to authenticated using (
    (
      public.can_direct_camera_room(room_id)
      or exists (
        select 1 from public.video_assets review_asset
        where review_asset.id = asset_id
          and review_asset.room_id = room_id
          and public.has_org_role(
            review_asset.organisation_id,
            array['owner','league_admin','club_admin','coach','safeguarding_officer']::public.platform_role[]
          )
      )
    )
    and public.can_review_camera_asset(asset_id)
    and exists (
      select 1 from public.video_assets a
      where a.id = camera_clip_calibrations.asset_id
        and a.room_id = camera_clip_calibrations.room_id
    )
  );

create policy camera_calibration_author_insert on public.camera_clip_calibrations
  for insert to authenticated with check (
    calibrated_by = (select auth.uid())
    and method = 'manual_review'
    and (
      public.can_direct_camera_room(room_id)
      or exists (
        select 1 from public.video_assets review_asset
        where review_asset.id = asset_id
          and review_asset.room_id = room_id
          and public.has_org_role(
            review_asset.organisation_id,
            array['owner','league_admin','club_admin','coach','safeguarding_officer']::public.platform_role[]
          )
      )
    )
    and public.can_review_camera_asset(asset_id)
    and exists (
      select 1 from public.video_assets a
      where a.id = camera_clip_calibrations.asset_id
        and a.room_id = camera_clip_calibrations.room_id
    )
  );

create policy camera_calibration_author_update on public.camera_clip_calibrations
  for update to authenticated
  using (
    calibrated_by = (select auth.uid())
    and (
      public.can_direct_camera_room(room_id)
      or exists (
        select 1 from public.video_assets review_asset
        where review_asset.id = asset_id
          and review_asset.room_id = room_id
          and public.has_org_role(
            review_asset.organisation_id,
            array['owner','league_admin','club_admin','coach','safeguarding_officer']::public.platform_role[]
          )
      )
    )
    and public.can_review_camera_asset(asset_id)
  )
  with check (
    calibrated_by = (select auth.uid())
    and method = 'manual_review'
    and (
      public.can_direct_camera_room(room_id)
      or exists (
        select 1 from public.video_assets review_asset
        where review_asset.id = asset_id
          and review_asset.room_id = room_id
          and public.has_org_role(
            review_asset.organisation_id,
            array['owner','league_admin','club_admin','coach','safeguarding_officer']::public.platform_role[]
          )
      )
    )
    and public.can_review_camera_asset(asset_id)
    and exists (
      select 1 from public.video_assets a
      where a.id = camera_clip_calibrations.asset_id
        and a.room_id = camera_clip_calibrations.room_id
    )
  );

create table public.camera_highlight_candidates (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.camera_rooms(id) on delete cascade,
  asset_id uuid not null references public.video_assets(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete set null,
  at_ms integer not null check (at_ms between 0 and 28800000),
  duration_ms integer not null default 6000 check (duration_ms between 1000 and 30000),
  kind text not null check (kind in ('wicket', 'boundary', 'fielding', 'other')),
  note text check (char_length(note) <= 240),
  source text not null default 'manual' check (source = 'manual'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index camera_highlight_candidates_room_recent
  on public.camera_highlight_candidates(room_id, created_at desc);

alter table public.camera_highlight_candidates enable row level security;
revoke all on public.camera_highlight_candidates from public, anon, authenticated;
grant select, insert on public.camera_highlight_candidates to authenticated;
grant all on public.camera_highlight_candidates to service_role;

create policy camera_highlight_private_read on public.camera_highlight_candidates
  for select to authenticated using (
    (
      public.can_direct_camera_room(room_id)
      or exists (
        select 1 from public.video_assets review_asset
        where review_asset.id = asset_id
          and review_asset.room_id = room_id
          and public.has_org_role(
            review_asset.organisation_id,
            array['owner','league_admin','club_admin','coach','safeguarding_officer']::public.platform_role[]
          )
      )
    )
    and public.can_review_camera_asset(asset_id)
    and exists (
      select 1 from public.video_assets a
      where a.id = camera_highlight_candidates.asset_id
        and a.room_id = camera_highlight_candidates.room_id
    )
  );

create policy camera_highlight_director_insert on public.camera_highlight_candidates
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and source = 'manual'
    and (
      public.can_direct_camera_room(room_id)
      or exists (
        select 1 from public.video_assets review_asset
        where review_asset.id = asset_id
          and review_asset.room_id = room_id
          and public.has_org_role(
            review_asset.organisation_id,
            array['owner','league_admin','club_admin','coach','safeguarding_officer']::public.platform_role[]
          )
      )
    )
    and public.can_review_camera_asset(asset_id)
    and exists (
      select 1
      from public.video_assets a
      join public.camera_rooms r on r.id = a.room_id
      where a.id = camera_highlight_candidates.asset_id
        and a.room_id = camera_highlight_candidates.room_id
        and (
          camera_highlight_candidates.delivery_id is null
          or exists (
            select 1 from public.deliveries d
            where d.id = camera_highlight_candidates.delivery_id
              and d.match_id = r.match_id
              and d.superseded_by is null
          )
        )
    )
  );

-- Highlights are editorial bookmarks, not copies, variants or publication consent.
-- Deliberately no authenticated UPDATE/DELETE, no public SELECT grant.

-- Server-side tasks (billing webhooks, notifications, media workers) use the service role.
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
