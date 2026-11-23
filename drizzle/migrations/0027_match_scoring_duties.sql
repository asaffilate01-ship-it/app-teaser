-- Per-match scoring duties: who may record balls, who adds bowling & fielding, who runs the video feed.
create table public.match_scoring_duties (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null,
  duty text not null check (duty in ('lead', 'batting', 'bowling', 'video')),
  assigned_by uuid,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id, duty)
);
create index match_scoring_duties_user_idx on public.match_scoring_duties (user_id);

grant select on public.match_scoring_duties to authenticated;
grant all on public.match_scoring_duties to service_role;
alter table public.match_scoring_duties enable row level security;
-- Writes only through set_match_scoring_duty (checks who may assign).
create policy match_scoring_duties_select on public.match_scoring_duties
  for select to authenticated using (public.can_view_match(match_id));

-- Club owners / admins of the match's club (and league admins) always hold every duty.
create or replace function public.is_match_manager(p_match_id uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and public.has_org_role(m.owner_organisation_id, array['owner','league_admin','club_admin']::public.platform_role[])
  );
$$;

-- The signed-in person's duties for one match. 'lead' covers everything.
-- Club scorers may score a match nobody has been given duties for; once duties are handed out,
-- only the people named (plus club admins) can score it.
create or replace function public.my_match_duties(p_match_id uuid)
returns text[] language plpgsql stable security definer set search_path to '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_duties text[];
begin
  if v_uid is null then return array[]::text[]; end if;
  select owner_organisation_id into v_org from public.matches where id = p_match_id;
  if v_org is null then return array[]::text[]; end if;
  if public.has_org_role(v_org, array['owner','league_admin','club_admin']::public.platform_role[]) then
    return array['lead','batting','bowling','video'];
  end if;
  -- Duties only count while the person is still an active member of the club.
  if not exists (
    select 1 from public.organisation_members om
    where om.organisation_id = v_org and om.user_id = v_uid and om.status = 'active'
  ) then
    return array[]::text[];
  end if;
  select coalesce(array_agg(d.duty order by d.duty), array[]::text[]) into v_duties
  from public.match_scoring_duties d where d.match_id = p_match_id and d.user_id = v_uid;
  if exists (
    select 1 from public.match_assignments a
    where a.match_id = p_match_id and a.user_id = v_uid and a.role = 'scorer'
  ) then
    v_duties := v_duties || array['lead'];
  end if;
  if cardinality(v_duties) = 0
    and public.has_org_role(v_org, array['scorer']::public.platform_role[])
    and not exists (select 1 from public.match_scoring_duties d where d.match_id = p_match_id)
  then
    v_duties := array['lead'];
  end if;
  if 'lead' = any(v_duties) then
    return array['lead','batting','bowling','video'];
  end if;
  return v_duties;
end;
$$;

create or replace function public.has_match_duty(p_match_id uuid, p_duties text[])
returns boolean language sql stable security definer set search_path to '' as $$
  select public.my_match_duties(p_match_id) && p_duties;
$$;

-- Anyone on the scoring team (balls, or bowling & fielding).
create or replace function public.can_score_match(p_match_id uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select public.has_match_duty(p_match_id, array['lead','batting','bowling']);
$$;

-- Recording, correcting balls and running the match (innings, rules, rain): lead or batting & runs.
create or replace function public.can_record_balls(p_match_id uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select public.has_match_duty(p_match_id, array['lead','batting']);
$$;

-- Every scoring write goes through here, so this is where duties are enforced.
create or replace function public.append_match_event(p_match_id uuid, p_client_event_id uuid, p_device_id text, p_event_type text, p_payload jsonb, p_occurred_at timestamp with time zone)
 returns public.match_events
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_existing public.match_events;
  v_sequence bigint;
  v_event public.match_events;
  v_patch boolean := p_event_type in ('delivery.tagged', 'bowling.updated');
begin
  if v_patch then
    if not public.has_match_duty(p_match_id, array['lead','bowling']) then
      raise exception 'only the bowling & fielding scorer can add this' using errcode = '42501';
    end if;
    -- Bowling & fielding notes never replace the score: no snapshot, no live score.
    p_payload := p_payload - 'matchSnapshot' - 'liveState';
    -- Fielding notes must come through tag_delivery_v1 (it checks the ball and the fielder).
    if p_event_type = 'delivery.tagged' and coalesce(current_setting('criclume.tagging', true), '') <> 'on' then
      raise exception 'use tag_delivery_v1 to add fielding' using errcode = '42501';
    end if;
    if p_event_type = 'bowling.updated' and not exists (
      select 1 from public.match_squads
      where match_id = p_match_id and player_id = nullif(p_payload ->> 'bowlerId', '')::uuid
    ) then
      raise exception 'bowler must belong to the match squad' using errcode = '23503';
    end if;
  elsif not public.can_record_balls(p_match_id) then
    raise exception 'not authorised to score this match' using errcode = '42501';
  end if;

  select * into v_existing
  from public.match_events
  where match_id = p_match_id and client_event_id = p_client_event_id;
  if found then return v_existing; end if;

  perform 1 from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found' using errcode = 'P0002'; end if;

  select coalesce(max(sequence), 0) + 1 into v_sequence
  from public.match_events where match_id = p_match_id;

  insert into public.match_events (
    match_id, sequence, client_event_id, device_id, event_type, payload, occurred_at, recorded_by
  ) values (
    p_match_id, v_sequence, p_client_event_id, left(p_device_id, 200), left(p_event_type, 100),
    p_payload, p_occurred_at, (select auth.uid())
  ) returning * into v_event;

  if p_payload ? 'liveState' then
    update public.matches
    set live_state = p_payload -> 'liveState',
      status = case p_payload -> 'matchSnapshot' ->> 'status'
        when 'live' then 'live'::public.match_status
        when 'innings-break' then 'innings_break'::public.match_status
        when 'completed' then 'completed'::public.match_status
        else status
      end,
      started_at = coalesce(started_at, case when p_payload -> 'matchSnapshot' ->> 'status' = 'live' then now() else null end),
      completed_at = case when p_payload -> 'matchSnapshot' ->> 'status' = 'completed' then coalesce(completed_at, now()) else completed_at end,
      updated_at = now()
    where id = p_match_id;
  end if;

  return v_event;
exception
  when unique_violation then
    select * into v_existing
    from public.match_events
    where match_id = p_match_id and client_event_id = p_client_event_id;
    return v_existing;
end;
$function$;

-- Bowling & fielding scorer: add fielder, fielding position and ball type to a ball already recorded.
create or replace function public.tag_delivery_v1(
  p_match_id uuid, p_innings_id uuid, p_delivery_id text, p_client_event_id uuid, p_device_id text,
  p_tag jsonb, p_occurred_at timestamptz
) returns public.match_events
language plpgsql security definer set search_path to '' as $$
declare
  v_event public.match_events;
  v_fielder uuid := nullif(p_tag ->> 'fielderId', '')::uuid;
  v_dismissal_fielder uuid := nullif(p_tag ->> 'dismissalFielderId', '')::uuid;
  v_recorded public.match_events;
begin
  if not public.has_match_duty(p_match_id, array['lead','bowling']) then
    raise exception 'only the bowling & fielding scorer can add fielding' using errcode = '42501';
  end if;
  if coalesce(p_delivery_id, '') = '' then
    raise exception 'which ball?' using errcode = '22023';
  end if;
  if (v_fielder is not null and not exists (
        select 1 from public.match_squads where match_id = p_match_id and player_id = v_fielder))
    or (v_dismissal_fielder is not null and not exists (
        select 1 from public.match_squads where match_id = p_match_id and player_id = v_dismissal_fielder)) then
    raise exception 'fielder must belong to the match squad' using errcode = '23503';
  end if;
  select * into v_recorded from public.match_events e
  where e.match_id = p_match_id and e.event_type = 'delivery.recorded'
    and e.payload -> 'delivery' ->> 'id' = p_delivery_id
    and e.payload ->> 'inningsId' = p_innings_id::text
  order by e.sequence desc limit 1;
  if not found then
    raise exception 'that ball has not reached the cloud yet' using errcode = 'P0002';
  end if;

  perform set_config('criclume.tagging', 'on', true);
  v_event := public.append_match_event(
    p_match_id, p_client_event_id, p_device_id, 'delivery.tagged',
    jsonb_build_object('inningsId', p_innings_id, 'deliveryId', p_delivery_id, 'tag', p_tag),
    p_occurred_at
  );
  perform set_config('criclume.tagging', '', true);

  update public.deliveries d set
    fielding_zone = coalesce(p_tag ->> 'fieldZone', d.fielding_zone),
    shot_zone = coalesce(p_tag ->> 'fieldZone', d.shot_zone),
    fielder_id = case when p_tag ? 'fielderId' then v_fielder else d.fielder_id end,
    delivery_style = coalesce(p_tag ->> 'deliveryStyle', d.delivery_style),
    dismissal = case
      when d.dismissal is not null and p_tag ? 'dismissalFielderId'
        then d.dismissal || jsonb_build_object('fielderId', v_dismissal_fielder)
      else d.dismissal end
  where d.event_id = v_recorded.id;

  return v_event;
end;
$$;

-- Who is on this match's scoring team, and who could be added (active club members).
create or replace function public.match_scoring_team(p_match_id uuid)
returns table (user_id uuid, display_name text, club_role text, duties text[], always_full boolean)
language plpgsql stable security definer set search_path to '' as $$
declare v_org uuid;
begin
  if not (public.is_match_manager(p_match_id) or public.has_match_duty(p_match_id, array['lead','batting','bowling','video'])) then
    raise exception 'not part of this match''s scoring team' using errcode = '42501';
  end if;
  select owner_organisation_id into v_org from public.matches where id = p_match_id;
  return query
  select om.user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Club member')::text,
    min(om.role::text)::text,
    coalesce((select array_agg(d.duty order by d.duty) from public.match_scoring_duties d
              where d.match_id = p_match_id and d.user_id = om.user_id), array[]::text[]),
    bool_or(om.role in ('owner','league_admin','club_admin'))
  from public.organisation_members om
  left join public.profiles p on p.id = om.user_id
  where om.organisation_id = v_org and om.status = 'active'
    and om.role in ('owner','league_admin','club_admin','scorer','coach','team_manager')
  group by om.user_id, p.display_name
  order by 5 desc, 2;
end;
$$;

-- Hand out or take back a duty. Club admins can give any duty; a lead scorer can give
-- batting, bowling and video helpers but not make another lead.
create or replace function public.set_match_scoring_duty(p_match_id uuid, p_user_id uuid, p_duty text, p_enabled boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare v_org uuid; v_manager boolean;
begin
  if p_duty not in ('lead','batting','bowling','video') then
    raise exception 'unknown duty' using errcode = '22023';
  end if;
  select owner_organisation_id into v_org from public.matches where id = p_match_id;
  if v_org is null then raise exception 'match not found' using errcode = 'P0002'; end if;
  v_manager := public.is_match_manager(p_match_id);
  if not v_manager and not (p_duty <> 'lead' and 'lead' = any(
      (select array_agg(d.duty) from public.match_scoring_duties d
       where d.match_id = p_match_id and d.user_id = (select auth.uid())))) then
    raise exception 'only club admins or the lead scorer can hand out scoring duties' using errcode = '42501';
  end if;
  if p_enabled then
    if not exists (
      select 1 from public.organisation_members om
      where om.organisation_id = v_org and om.user_id = p_user_id and om.status = 'active'
    ) then
      raise exception 'scorers must be active members of the club' using errcode = '23503';
    end if;
    insert into public.match_scoring_duties (match_id, user_id, duty, assigned_by)
    values (p_match_id, p_user_id, p_duty, (select auth.uid()))
    on conflict do nothing;
  else
    if p_duty = 'lead' and not v_manager then
      raise exception 'only club admins can remove a lead scorer' using errcode = '42501';
    end if;
    delete from public.match_scoring_duties
    where match_id = p_match_id and user_id = p_user_id and duty = p_duty;
  end if;
end;
$$;

-- Camera rooms: lead scorer or video duty (coaches/admins as before).
create or replace function public.can_direct_camera_room(p_room_id uuid)
returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (
    select 1 from public.camera_rooms r
    join public.matches m on m.id = r.match_id
    where r.id = p_room_id
      and r.status = 'open'
      and (
        public.has_org_role(m.owner_organisation_id, array['owner','league_admin','club_admin','coach']::public.platform_role[])
        or public.has_match_duty(m.id, array['lead','video'])
      )
  );
$function$;

create or replace function public.create_camera_room(p_match_id uuid, p_name text default 'Match camera room')
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_room public.camera_rooms;
  v_token text;
  v_expires_at timestamptz := now() + interval '30 minutes';
begin
  if not public.has_match_duty(p_match_id, array['lead','video']) and not exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and public.has_org_role(m.owner_organisation_id, array['coach']::public.platform_role[])
  ) then
    raise exception 'not authorised to create a camera room' using errcode = '42501';
  end if;
  insert into public.camera_rooms (match_id, name, opened_by, closes_at)
  values (p_match_id, coalesce(nullif(trim(p_name), ''), 'Match camera room'), (select auth.uid()), now() + interval '8 hours')
  returning * into v_room;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.camera_pairing_tokens (room_id, token_hash, expires_at, uses_remaining, created_by)
  values (v_room.id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expires_at, v_room.max_devices, (select auth.uid()));
  return jsonb_build_object('roomId', v_room.id, 'pairingToken', v_token, 'expiresAt', v_expires_at);
end;
$function$;

drop policy if exists camera_rooms_match_insert on public.camera_rooms;
create policy camera_rooms_match_insert on public.camera_rooms for insert to authenticated
  with check (public.has_match_duty(match_id, array['lead','video']));
drop policy if exists camera_rooms_match_update on public.camera_rooms;
create policy camera_rooms_match_update on public.camera_rooms for update to authenticated
  using (public.has_match_duty(match_id, array['lead','video']))
  with check (public.has_match_duty(match_id, array['lead','video']));

-- Direct table writes: only people who record balls.
drop policy if exists deliveries_match_insert on public.deliveries;
create policy deliveries_match_insert on public.deliveries for insert to authenticated
  with check (public.can_record_balls(match_id) and recorded_by = (select auth.uid()));
drop policy if exists deliveries_match_update on public.deliveries;
create policy deliveries_match_update on public.deliveries for update to authenticated
  using (public.can_record_balls(match_id)) with check (public.can_record_balls(match_id));
drop policy if exists innings_match_insert on public.innings;
create policy innings_match_insert on public.innings for insert to authenticated
  with check (public.can_record_balls(match_id));
drop policy if exists innings_match_update on public.innings;
create policy innings_match_update on public.innings for update to authenticated
  using (public.can_record_balls(match_id)) with check (public.can_record_balls(match_id));
drop policy if exists matches_scorer_update on public.matches;
create policy matches_scorer_update on public.matches for update to authenticated
  using (public.can_record_balls(id)) with check (public.can_record_balls(id));

-- Adding people to a match was open to any scorer; now only club admins (duties go through set_match_scoring_duty).
drop policy if exists assignments_match_insert on public.match_assignments;
create policy assignments_match_insert on public.match_assignments for insert to authenticated
  with check (public.is_match_manager(match_id));
drop policy if exists assignments_match_update on public.match_assignments;
create policy assignments_match_update on public.match_assignments for update to authenticated
  using (public.is_match_manager(match_id)) with check (public.is_match_manager(match_id));

-- The old online-only innings start skipped the event log; the app uses start_match_innings_v2.
revoke execute on function public.start_match_innings(uuid, integer, uuid, uuid) from public, anon, authenticated;

revoke execute on function public.my_match_duties(uuid) from public, anon;
grant execute on function public.my_match_duties(uuid) to authenticated;
revoke execute on function public.has_match_duty(uuid, text[]) from public, anon;
grant execute on function public.has_match_duty(uuid, text[]) to authenticated;
revoke execute on function public.can_record_balls(uuid) from public, anon;
grant execute on function public.can_record_balls(uuid) to authenticated;
revoke execute on function public.is_match_manager(uuid) from public, anon;
grant execute on function public.is_match_manager(uuid) to authenticated;
revoke execute on function public.tag_delivery_v1(uuid, uuid, text, uuid, text, jsonb, timestamptz) from public, anon;
grant execute on function public.tag_delivery_v1(uuid, uuid, text, uuid, text, jsonb, timestamptz) to authenticated;
revoke execute on function public.match_scoring_team(uuid) from public, anon;
grant execute on function public.match_scoring_team(uuid) to authenticated;
revoke execute on function public.set_match_scoring_duty(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.set_match_scoring_duty(uuid, uuid, text, boolean) to authenticated;