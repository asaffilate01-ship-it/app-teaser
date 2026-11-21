-- CricLume P3 follow-up: seal camera-to-organisation integrity and finalise
-- video uploads for paired (non-member) camera operators without broad UPDATE.
-- Apply ONLY in CricLume's own Supabase project, never the Dishbee project.
begin;

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

commit;
