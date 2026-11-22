-- ==== 20261121102945_camera_media_privacy_gate.sql
-- CricLume P3 privacy gate: private club video access, minors and blur requirements.
-- This source is converted into a timestamped Supabase migration by the CLI.
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
  if p_name !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/source\.(webm|mp4)$'
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

-- ==== 20261121113000_camera_director_controls.sql
-- CricLume P3: auditable director recording controls and isolated live-media signalling.
-- This migration must be deployed only to CricLume's own Supabase project.
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

-- Earlier camera-device update RLS allowed every match viewer to edit other
-- devices, including their user_id. Close that ownership escalation first.
drop policy if exists camera_devices_self_update on public.camera_devices;
create policy camera_devices_self_update on public.camera_devices
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid())
  and public.can_access_camera_room(room_id));

-- Media signalling is scoped to ONE paired device per private topic. A phone
-- operator cannot watch another phone just because they share a match.
create function public.can_access_camera_signal_topic(p_topic text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p_topic ~ '^camera-live:[0-9a-fA-F-]{36}:[0-9a-fA-F-]{36}$'
    then (
      public.can_direct_camera_room(split_part(p_topic, ':', 2)::uuid)
      or exists (
        select 1 from public.camera_devices d
        where d.id = split_part(p_topic, ':', 3)::uuid
          and d.room_id = split_part(p_topic, ':', 2)::uuid
          and d.user_id = (select auth.uid())
      )
    )
    else false end;
$$;
revoke all on function public.can_access_camera_signal_topic(text)
  from public, anon, authenticated;
grant execute on function public.can_access_camera_signal_topic(text) to authenticated;

create policy camera_live_signal_read on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and public.can_access_camera_signal_topic((select realtime.topic()))
);
create policy camera_live_signal_write on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and public.can_access_camera_signal_topic((select realtime.topic()))
);

alter publication supabase_realtime add table public.camera_recording_commands;
