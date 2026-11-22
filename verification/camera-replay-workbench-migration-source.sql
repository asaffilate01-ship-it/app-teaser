-- CricLume: manual timing calibration and *private* editorial highlight candidates.
-- All playback remains governed by existing asset RLS and blur requirements.
begin;

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
commit;
