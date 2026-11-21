-- CricLume P3 privacy gate: private club video access, minors and blur requirements.
-- This source is converted into a timestamped Supabase migration by the CLI.
begin;

-- Users may only review recordings when they are the owning paired operator
-- or an authorised club reviewer. Junior footage is reserved to the operator
-- and designated safeguarding roles; public match viewing never grants access.
create or replace function public.can_review_camera_asset(p_asset_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1
    from public.video_assets a
    join public.camera_rooms r on r.id = a.room_id
    join public.matches m on m.id = r.match_id
    join public.camera_devices d on d.id = a.device_id and d.room_id = r.id
    where a.id = p_asset_id
      and a.organisation_id = m.owner_organisation_id
      and a.recording_consent = 'granted'
      and a.retention_expires_at > now()
      and a.status in ('uploaded', 'processing', 'ready')
      and (
        public.has_org_role(
          a.organisation_id,
          array['owner', 'safeguarding_officer']::public.platform_role[]
        )
        or (
          not a.includes_junior
          and public.has_org_role(
            a.organisation_id,
            array['club_admin', 'league_admin', 'coach']::public.platform_role[]
          )
        )
        or (
          a.created_by = (select auth.uid())
          and d.user_id = (select auth.uid())
        )
      )
  );
$$;
revoke all on function public.can_review_camera_asset(uuid) from public, anon, authenticated;
grant execute on function public.can_review_camera_asset(uuid) to authenticated;

-- The asset owner needs to read their own new uploading row so INSERT..RETURNING
-- continues to work. All other private reads are consent, role and expiry gated.
drop policy if exists video_assets_member_select on public.video_assets;
create policy video_assets_member_select on public.video_assets
  for select to authenticated
  using (
    public.can_review_camera_asset(id)
    or (
      created_by = (select auth.uid())
      and status = 'uploading'
      and recording_consent = 'granted'
      and retention_expires_at > now()
      and exists (
        select 1 from public.camera_devices d
        where d.id = video_assets.device_id
          and d.room_id = video_assets.room_id
          and d.user_id = (select auth.uid())
      )
    )
  );

-- Only trusted service-role video workers should change consent, publication,
-- retention, and processed media variants. Paired operators have the scoped
-- complete_camera_asset_upload RPC instead of broad direct UPDATE privileges.
drop policy if exists video_assets_capture_update on public.video_assets;
revoke update on public.video_assets from authenticated;
grant select, update on public.video_assets to service_role;

drop policy if exists video_variants_admin_insert on public.video_variants;
drop policy if exists video_variants_admin_update on public.video_variants;
revoke insert, update on public.video_variants from authenticated;
grant select, insert, update on public.video_variants to service_role;

drop policy if exists video_variants_member_select on public.video_variants;
create policy video_variants_member_select on public.video_variants
  for select to authenticated
  using (
    public.can_review_camera_asset(asset_id)
    and exists (
      select 1 from public.video_assets a
      join public.camera_devices d on d.id = a.device_id and d.room_id = a.room_id
      where a.id = video_variants.asset_id
        and (
          a.blur_mode = 'none'
          or video_variants.kind = 'blurred'
          or public.has_org_role(
            a.organisation_id,
            array['owner', 'safeguarding_officer']::public.platform_role[]
          )
          or (
            a.created_by = (select auth.uid())
            and d.user_id = (select auth.uid())
          )
        )
    )
  );

-- Reject source upload paths that point at another room, another club, or a
-- forged derivative. Source objects are always in the canonical 4-segment path.
create or replace function public.can_upload_camera_source(p_name text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_parts text[];
begin
  if (select auth.uid()) is null or p_name is null then return false; end if;
  if p_name !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/source\.(webm|mp4)
    then return false;
  end if;
  v_parts := string_to_array(p_name, '/');
  return exists (
    select 1
    from public.video_assets a
    join public.camera_rooms r on r.id = a.room_id
    join public.matches m on m.id = r.match_id
    join public.camera_devices d on d.id = a.device_id and d.room_id = r.id
    where a.id = v_parts[3]::uuid
      and a.room_id = v_parts[2]::uuid
      and a.organisation_id = v_parts[1]::uuid
      and m.owner_organisation_id = a.organisation_id
      and a.recording_consent = 'granted'
      and a.retention_expires_at > now()
      and a.status in ('planned', 'uploading')
      and a.storage_path is null
      and p_name = a.organisation_id::text || '/' || a.room_id::text || '/'
        || a.id::text || '/source.'
        || case when a.content_type = 'video/mp4' then 'mp4' else 'webm' end
      and (
        (a.created_by = (select auth.uid()) and d.user_id = (select auth.uid()))
        or public.has_org_role(
          a.organisation_id,
          array['owner', 'club_admin', 'league_admin', 'coach']::public.platform_role[]
        )
      )
  );
end;
$$;
revoke all on function public.can_upload_camera_source(text) from public, anon, authenticated;
grant execute on function public.can_upload_camera_source(text) to authenticated;

drop policy if exists match_video_consented_upload on storage.objects;
create policy match_video_consented_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'match-video'
    and public.can_upload_camera_source(name)
  );

-- Signed URL access must match a real permitted source OR a real, ready video
-- variant. A requested blur cannot be bypassed by signing the original source
-- or an unblurred proxy (apart from explicit safeguarding/operator access).
create or replace function public.can_read_camera_storage_path(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.video_assets a
    join public.camera_devices d on d.id = a.device_id and d.room_id = a.room_id
    join public.camera_rooms r on r.id = a.room_id
    join public.matches m on m.id = r.match_id
    where m.owner_organisation_id = a.organisation_id
      and a.recording_consent = 'granted'
      and a.retention_expires_at > now()
      and (
        (
          a.status in ('planned', 'uploading')
          and a.created_by = (select auth.uid())
          and d.user_id = (select auth.uid())
          and p_name = a.organisation_id::text || '/' || a.room_id::text || '/'
            || a.id::text || '/source.'
            || case when a.content_type = 'video/mp4' then 'mp4' else 'webm' end
        )
        or (
          public.can_review_camera_asset(a.id)
          and (
            (
              a.storage_path = p_name
              and (
                a.blur_mode = 'none'
                or public.has_org_role(
                  a.organisation_id,
                  array['owner', 'safeguarding_officer']::public.platform_role[]
                )
                or (
                  a.created_by = (select auth.uid())
                  and d.user_id = (select auth.uid())
                )
              )
            )
            or exists (
              select 1 from public.video_variants v
              where v.asset_id = a.id
                and v.storage_path = p_name
                and v.status = 'ready'
                and (
                  a.blur_mode = 'none'
                  or v.kind = 'blurred'
                  or public.has_org_role(
                    a.organisation_id,
                    array['owner', 'safeguarding_officer']::public.platform_role[]
                  )
                  or (
                    a.created_by = (select auth.uid())
                    and d.user_id = (select auth.uid())
                  )
                )
            )
          )
        )
      )
  );
$$;
revoke all on function public.can_read_camera_storage_path(text) from public, anon, authenticated;
grant execute on function public.can_read_camera_storage_path(text) to authenticated;

drop policy if exists match_video_member_read on storage.objects;
create policy match_video_authorised_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'match-video'
    and public.can_read_camera_storage_path(name)
  );

-- Media metadata linked to a delivery must not disclose junior footage IDs to
-- users who may score/view the match but may not review the private recording.
drop policy if exists media_links_match_select on public.delivery_media_links;
create policy media_links_match_select on public.delivery_media_links
  for select to authenticated
  using (
    exists (
      select 1 from public.deliveries d
      where d.id = delivery_id
        and public.can_view_match(d.match_id)
    )
    and public.can_review_camera_asset(asset_id)
  );

drop policy if exists annotations_asset_select on public.video_annotations;
create policy annotations_asset_select on public.video_annotations
  for select to authenticated
  using (public.can_review_camera_asset(asset_id));

drop policy if exists annotations_author_insert on public.video_annotations;
create policy annotations_author_insert on public.video_annotations
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.can_review_camera_asset(asset_id)
  );

drop policy if exists annotations_author_update on public.video_annotations;
create policy annotations_author_update on public.video_annotations
  for update to authenticated
  using (
    author_id = (select auth.uid())
    and public.can_review_camera_asset(asset_id)
  )
  with check (
    author_id = (select auth.uid())
    and public.can_review_camera_asset(asset_id)
  );

commit;

    then return false;
  end if;
  v_parts := string_to_array(p_name, '/');
  return exists (
    select 1
    from public.video_assets a
    join public.camera_rooms r on r.id = a.room_id
    join public.matches m on m.id = r.match_id
    join public.camera_devices d on d.id = a.device_id and d.room_id = r.id
    where a.id = v_parts[3]::uuid
      and a.room_id = v_parts[2]::uuid
      and a.organisation_id = v_parts[1]::uuid
      and m.owner_organisation_id = a.organisation_id
      and a.recording_consent = 'granted'
      and a.retention_expires_at > now()
      and a.status in ('planned', 'uploading')
      and a.storage_path is null
      and p_name = a.organisation_id::text || '/' || a.room_id::text || '/'
        || a.id::text || '/source.'
        || case when a.content_type = 'video/mp4' then 'mp4' else 'webm' end
      and (
        (a.created_by = (select auth.uid()) and d.user_id = (select auth.uid()))
        or public.has_org_role(
          a.organisation_id,
          array['owner', 'club_admin', 'league_admin', 'coach']::public.platform_role[]
        )
      )
  );
end;
$$;
revoke all on function public.can_upload_camera_source(text) from public, anon, authenticated;
grant execute on function public.can_upload_camera_source(text) to authenticated;

drop policy if exists match_video_consented_upload on storage.objects;
create policy match_video_consented_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'match-video'
    and public.can_upload_camera_source(name)
  );

-- Signed URL access must match a real permitted source OR a real, ready video
-- variant. A requested blur cannot be bypassed by signing the original source
-- or an unblurred proxy (apart from explicit safeguarding/operator access).
create or replace function public.can_read_camera_storage_path(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.video_assets a
    join public.camera_devices d on d.id = a.device_id and d.room_id = a.room_id
    join public.camera_rooms r on r.id = a.room_id
    join public.matches m on m.id = r.match_id
    where m.owner_organisation_id = a.organisation_id
      and a.recording_consent = 'granted'
      and a.retention_expires_at > now()
      and (
        (
          a.status in ('planned', 'uploading')
          and a.created_by = (select auth.uid())
          and d.user_id = (select auth.uid())
          and p_name = a.organisation_id::text || '/' || a.room_id::text || '/'
            || a.id::text || '/source.'
            || case when a.content_type = 'video/mp4' then 'mp4' else 'webm' end
        )
        or (
          public.can_review_camera_asset(a.id)
          and (
            (
              a.storage_path = p_name
              and (
                a.blur_mode = 'none'
                or public.has_org_role(
                  a.organisation_id,
                  array['owner', 'safeguarding_officer']::public.platform_role[]
                )
                or (
                  a.created_by = (select auth.uid())
                  and d.user_id = (select auth.uid())
                )
              )
            )
            or exists (
              select 1 from public.video_variants v
              where v.asset_id = a.id
                and v.storage_path = p_name
                and v.status = 'ready'
                and (
                  a.blur_mode = 'none'
                  or v.kind = 'blurred'
                  or public.has_org_role(
                    a.organisation_id,
                    array['owner', 'safeguarding_officer']::public.platform_role[]
                  )
                  or (
                    a.created_by = (select auth.uid())
                    and d.user_id = (select auth.uid())
                  )
                )
            )
          )
        )
      )
  );
$$;
revoke all on function public.can_read_camera_storage_path(text) from public, anon, authenticated;
grant execute on function public.can_read_camera_storage_path(text) to authenticated;

drop policy if exists match_video_member_read on storage.objects;
create policy match_video_authorised_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'match-video'
    and public.can_read_camera_storage_path(name)
  );

-- Media metadata linked to a delivery must not disclose junior footage IDs to
-- users who may score/view the match but may not review the private recording.
drop policy if exists media_links_match_select on public.delivery_media_links;
create policy media_links_match_select on public.delivery_media_links
  for select to authenticated
  using (
    exists (
      select 1 from public.deliveries d
      where d.id = delivery_id
        and public.can_view_match(d.match_id)
    )
    and public.can_review_camera_asset(asset_id)
  );

drop policy if exists annotations_asset_select on public.video_annotations;
create policy annotations_asset_select on public.video_annotations
  for select to authenticated
  using (public.can_review_camera_asset(asset_id));

drop policy if exists annotations_author_insert on public.video_annotations;
create policy annotations_author_insert on public.video_annotations
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.can_review_camera_asset(asset_id)
  );

drop policy if exists annotations_author_update on public.video_annotations;
create policy annotations_author_update on public.video_annotations
  for update to authenticated
  using (
    author_id = (select auth.uid())
    and public.can_review_camera_asset(asset_id)
  )
  with check (
    author_id = (select auth.uid())
    and public.can_review_camera_asset(asset_id)
  );

commit;
