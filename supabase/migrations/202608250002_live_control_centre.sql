begin;

alter table public.deliveries
  add column if not exists voided_by_event_id uuid references public.match_events(id);

create or replace view public.player_career_stats
with (security_invoker = true)
as
with batting as (
  select striker_id as player_id,
    count(*) filter (where legal_ball) as balls_faced,
    sum(batter_runs)::bigint as runs,
    count(*) filter (where batter_runs = 4) as fours,
    count(*) filter (where batter_runs = 6) as sixes
  from public.deliveries
  where superseded_by is null and voided_by_event_id is null
  group by striker_id
), bowling as (
  select bowler_id as player_id,
    count(*) filter (where legal_ball) as balls_bowled,
    sum(total_runs)::bigint as runs_conceded,
    count(*) filter (
      where wicket and coalesce(dismissal ->> 'creditedToBowler', 'false') = 'true'
    ) as wickets
  from public.deliveries
  where superseded_by is null and voided_by_event_id is null
  group by bowler_id
), fielding as (
  select fielder_id as player_id,
    count(*) filter (where dismissal ->> 'type' = 'caught') as catches,
    count(*) filter (where dismissal ->> 'type' = 'stumped') as stumpings,
    count(*) filter (where dismissal ->> 'type' = 'run-out') as run_outs
  from public.deliveries
  where fielder_id is not null
    and superseded_by is null
    and voided_by_event_id is null
  group by fielder_id
), ids as (
  select player_id from batting
  union select player_id from bowling
  union select player_id from fielding
)
select ids.player_id,
  coalesce(batting.runs, 0) as runs,
  coalesce(batting.balls_faced, 0) as balls_faced,
  coalesce(batting.fours, 0) as fours,
  coalesce(batting.sixes, 0) as sixes,
  coalesce(bowling.balls_bowled, 0) as balls_bowled,
  coalesce(bowling.runs_conceded, 0) as runs_conceded,
  coalesce(bowling.wickets, 0) as wickets,
  coalesce(fielding.catches, 0) as catches,
  coalesce(fielding.stumpings, 0) as stumpings,
  coalesce(fielding.run_outs, 0) as run_outs
from ids
left join batting using (player_id)
left join bowling using (player_id)
left join fielding using (player_id);

create or replace function public.record_player_consent_decision(
  p_organisation_id uuid,
  p_player_id uuid,
  p_recording public.consent_state,
  p_coaching_analysis public.consent_state,
  p_public_highlights public.consent_state,
  p_biometric_analysis public.consent_state,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_junior boolean;
  v_consent_id uuid;
begin
  if not public.has_org_role(
    p_organisation_id,
    array['owner', 'safeguarding_officer']::public.platform_role[]
  ) then
    raise exception 'not authorised to record safeguarding decisions' using errcode = '42501';
  end if;

  select is_junior into v_is_junior
  from public.players
  where id = p_player_id and organisation_id = p_organisation_id;
  if not found then
    raise exception 'player does not belong to this organisation' using errcode = '23503';
  end if;

  update public.player_consents
  set valid_until = now()
  where player_id = p_player_id
    and organisation_id = p_organisation_id
    and valid_until is null;

  insert into public.player_consents (
    player_id,
    organisation_id,
    recording,
    coaching_analysis,
    public_highlights,
    biometric_analysis,
    consented_by,
    notes
  ) values (
    p_player_id,
    p_organisation_id,
    p_recording,
    p_coaching_analysis,
    p_public_highlights,
    case when v_is_junior then 'denied'::public.consent_state else p_biometric_analysis end,
    (select auth.uid()),
    nullif(trim(p_notes), '')
  ) returning id into v_consent_id;

  return v_consent_id;
end;
$$;

drop policy if exists team_players_admin_insert on public.team_players;
drop policy if exists team_players_admin_update on public.team_players;
drop policy if exists team_players_admin_delete on public.team_players;
create policy team_players_admin_insert on public.team_players for insert to authenticated
with check (exists (
  select 1 from public.teams t
  where t.id = team_id
    and public.has_org_role(
      t.organisation_id,
      array['owner', 'league_admin', 'club_admin', 'coach']::public.platform_role[]
    )
));
create policy team_players_admin_update on public.team_players for update to authenticated
using (exists (
  select 1 from public.teams t
  where t.id = team_id
    and public.has_org_role(
      t.organisation_id,
      array['owner', 'league_admin', 'club_admin', 'coach']::public.platform_role[]
    )
))
with check (exists (
  select 1 from public.teams t
  where t.id = team_id
    and public.has_org_role(
      t.organisation_id,
      array['owner', 'league_admin', 'club_admin', 'coach']::public.platform_role[]
    )
));
create policy team_players_admin_delete on public.team_players for delete to authenticated
using (exists (
  select 1 from public.teams t
  where t.id = team_id
    and public.has_org_role(
      t.organisation_id,
      array['owner', 'league_admin', 'club_admin', 'coach']::public.platform_role[]
    )
));

drop policy if exists fixtures_admin_insert on public.fixtures;
drop policy if exists fixtures_admin_update on public.fixtures;
drop policy if exists fixtures_admin_delete on public.fixtures;
create policy fixtures_admin_insert on public.fixtures for insert to authenticated
with check (exists (
  select 1 from public.competitions c
  where c.id = competition_id
    and public.has_org_role(
      c.organisation_id,
      array['owner', 'league_admin', 'club_admin']::public.platform_role[]
    )
));
create policy fixtures_admin_update on public.fixtures for update to authenticated
using (exists (
  select 1 from public.competitions c
  where c.id = competition_id
    and public.has_org_role(
      c.organisation_id,
      array['owner', 'league_admin', 'club_admin']::public.platform_role[]
    )
))
with check (exists (
  select 1 from public.competitions c
  where c.id = competition_id
    and public.has_org_role(
      c.organisation_id,
      array['owner', 'league_admin', 'club_admin']::public.platform_role[]
    )
));
create policy fixtures_admin_delete on public.fixtures for delete to authenticated
using (exists (
  select 1 from public.competitions c
  where c.id = competition_id
    and public.has_org_role(
      c.organisation_id,
      array['owner', 'league_admin', 'club_admin']::public.platform_role[]
    )
));

create or replace function public.create_competition_workspace(
  p_organisation_id uuid,
  p_name text,
  p_format text,
  p_season_name text,
  p_starts_on date,
  p_ends_on date,
  p_rules jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season public.seasons;
  v_competition public.competitions;
  v_rule public.competition_rule_versions;
begin
  if not public.has_org_role(
    p_organisation_id,
    array['owner', 'league_admin']::public.platform_role[]
  ) then
    raise exception 'not authorised to create competitions' using errcode = '42501';
  end if;
  if char_length(trim(p_name)) < 2 then
    raise exception 'competition name is required' using errcode = '22023';
  end if;
  if char_length(trim(p_season_name)) < 2 then
    raise exception 'season name is required' using errcode = '22023';
  end if;
  if p_format not in ('league', 'groups', 'knockout', 'round_robin_knockout', 'friendly') then
    raise exception 'competition format is invalid' using errcode = '22023';
  end if;
  if p_ends_on < p_starts_on then
    raise exception 'season end must not precede its start' using errcode = '22023';
  end if;

  insert into public.seasons (organisation_id, name, starts_on, ends_on)
  values (p_organisation_id, trim(p_season_name), p_starts_on, p_ends_on)
  on conflict (organisation_id, name) do update
    set starts_on = excluded.starts_on,
        ends_on = excluded.ends_on
  returning * into v_season;

  insert into public.competitions (organisation_id, season_id, name, format, active_rule_version)
  values (p_organisation_id, v_season.id, trim(p_name), p_format, 1)
  returning * into v_competition;

  insert into public.competition_rule_versions (
    competition_id,
    version,
    rules,
    created_by
  ) values (
    v_competition.id,
    1,
    coalesce(p_rules, '{}'::jsonb),
    (select auth.uid())
  ) returning * into v_rule;

  return jsonb_build_object(
    'seasonId', v_season.id,
    'competitionId', v_competition.id,
    'ruleVersionId', v_rule.id
  );
end;
$$;

create or replace function public.create_match_workspace(
  p_organisation_id uuid,
  p_home_team_id uuid,
  p_away_team_id uuid,
  p_ground_id uuid,
  p_competition_id uuid,
  p_scheduled_at timestamptz,
  p_visibility public.match_visibility,
  p_batting_first_team_id uuid,
  p_overs_per_innings integer,
  p_innings_per_side integer,
  p_balls_per_over integer,
  p_weather jsonb,
  p_public_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
  v_innings public.innings;
  v_rule_id uuid;
  v_scoreboard_slug text;
  v_home_players integer;
  v_away_players integer;
begin
  if not public.has_org_role(
    p_organisation_id,
    array['owner', 'league_admin', 'club_admin', 'scorer']::public.platform_role[]
  ) then
    raise exception 'not authorised to create matches' using errcode = '42501';
  end if;
  if p_home_team_id = p_away_team_id then
    raise exception 'home and away teams must be different' using errcode = '22023';
  end if;
  if p_batting_first_team_id is null
    or p_batting_first_team_id not in (p_home_team_id, p_away_team_id) then
    raise exception 'batting-first team must play in this match' using errcode = '22023';
  end if;
  if p_overs_per_innings is not null and p_overs_per_innings < 1 then
    raise exception 'overs must be positive' using errcode = '22023';
  end if;
  if p_innings_per_side is null
    or p_innings_per_side not between 1 and 2
    or p_balls_per_over is null
    or p_balls_per_over not between 4 and 8 then
    raise exception 'innings or balls-per-over setting is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.teams
    where id = p_home_team_id and organisation_id = p_organisation_id
  ) or not exists (
    select 1 from public.teams
    where id = p_away_team_id and organisation_id = p_organisation_id
  ) then
    raise exception 'both teams must belong to the selected organisation' using errcode = '23503';
  end if;
  if p_ground_id is not null and not exists (
    select 1 from public.grounds
    where id = p_ground_id and organisation_id = p_organisation_id
  ) then
    raise exception 'ground must belong to the selected organisation' using errcode = '23503';
  end if;
  if p_competition_id is not null then
    select rv.id into v_rule_id
    from public.competitions c
    join public.competition_rule_versions rv
      on rv.competition_id = c.id and rv.version = c.active_rule_version
    where c.id = p_competition_id and c.organisation_id = p_organisation_id;
    if not found then
      raise exception 'competition or active rule version was not found' using errcode = '23503';
    end if;
  end if;

  select count(*) into v_home_players
  from public.team_players
  where team_id = p_home_team_id
    and valid_from <= current_date
    and (valid_until is null or valid_until >= current_date);
  select count(*) into v_away_players
  from public.team_players
  where team_id = p_away_team_id
    and valid_from <= current_date
    and (valid_until is null or valid_until >= current_date);
  if v_home_players < 2 or v_away_players < 2 then
    raise exception 'each team needs at least two active registered players' using errcode = '23514';
  end if;

  insert into public.matches (
    owner_organisation_id,
    competition_id,
    rule_version_id,
    home_team_id,
    away_team_id,
    ground_id,
    status,
    visibility,
    scheduled_at,
    weather,
    live_state,
    created_by
  ) values (
    p_organisation_id,
    p_competition_id,
    v_rule_id,
    p_home_team_id,
    p_away_team_id,
    p_ground_id,
    case when p_scheduled_at is null then 'draft' else 'scheduled' end,
    p_visibility,
    p_scheduled_at,
    coalesce(p_weather, '{}'::jsonb),
    jsonb_build_object(
      'runs', 0,
      'wickets', 0,
      'overs', '0.0',
      'settings', jsonb_build_object(
        'oversPerInnings', p_overs_per_innings,
        'inningsPerSide', p_innings_per_side,
        'ballsPerOver', p_balls_per_over
      )
    ),
    (select auth.uid())
  ) returning * into v_match;

  insert into public.match_squads (match_id, team_id, player_id)
  select v_match.id, tp.team_id, tp.player_id
  from public.team_players tp
  where tp.team_id in (p_home_team_id, p_away_team_id)
    and tp.valid_from <= current_date
    and (tp.valid_until is null or tp.valid_until >= current_date);

  insert into public.innings (
    match_id,
    innings_number,
    batting_team_id,
    bowling_team_id,
    status
  ) values (
    v_match.id,
    1,
    p_batting_first_team_id,
    case when p_batting_first_team_id = p_home_team_id then p_away_team_id else p_home_team_id end,
    'not_started'
  ) returning * into v_innings;

  if p_visibility = 'public' then
    v_scoreboard_slug := lower(trim(coalesce(nullif(p_public_slug, ''), encode(extensions.gen_random_bytes(8), 'hex'))));
    if v_scoreboard_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
      raise exception 'public scoreboard slug is invalid' using errcode = '22023';
    end if;
    insert into public.public_scoreboards (match_id, slug, enabled)
    values (v_match.id, v_scoreboard_slug, true);
  end if;

  return jsonb_build_object(
    'matchId', v_match.id,
    'inningsId', v_innings.id,
    'scoreboardSlug', v_scoreboard_slug
  );
end;
$$;

create or replace function public.record_delivery_v2(
  p_match_id uuid,
  p_innings_id uuid,
  p_client_event_id uuid,
  p_device_id text,
  p_delivery jsonb,
  p_match_snapshot jsonb,
  p_live_state jsonb,
  p_occurred_at timestamptz
)
returns public.match_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.match_events;
  v_delivery public.deliveries;
  v_extras jsonb := coalesce(p_delivery -> 'extras', '{}'::jsonb);
  v_batter_runs integer := coalesce((p_delivery ->> 'batterRuns')::integer, 0);
  v_extra_runs integer := coalesce((v_extras ->> 'wide')::integer, 0)
    + coalesce((v_extras ->> 'noBall')::integer, 0)
    + coalesce((v_extras ->> 'bye')::integer, 0)
    + coalesce((v_extras ->> 'legBye')::integer, 0)
    + coalesce((v_extras ->> 'penalty')::integer, 0);
  v_legal boolean := coalesce((p_delivery ->> 'legal')::boolean, true);
  v_wicket boolean := p_delivery ? 'dismissal' and p_delivery -> 'dismissal' <> 'null'::jsonb;
  v_dismissal jsonb;
begin
  if not public.can_score_match(p_match_id) then
    raise exception 'not authorised to score this match' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.innings where id = p_innings_id and match_id = p_match_id
  ) then
    raise exception 'innings does not belong to match' using errcode = '23503';
  end if;
  if not exists (
    select 1 from public.match_squads
    where match_id = p_match_id and player_id = (p_delivery ->> 'strikerId')::uuid
  ) or not exists (
    select 1 from public.match_squads
    where match_id = p_match_id and player_id = (p_delivery ->> 'nonStrikerId')::uuid
  ) or not exists (
    select 1 from public.match_squads
    where match_id = p_match_id and player_id = (p_delivery ->> 'bowlerId')::uuid
  ) then
    raise exception 'delivery players must belong to the match squad' using errcode = '23503';
  end if;
  if nullif(p_delivery ->> 'fielderId', '') is not null and not exists (
    select 1 from public.match_squads
    where match_id = p_match_id and player_id = (p_delivery ->> 'fielderId')::uuid
  ) then
    raise exception 'fielder must belong to the match squad' using errcode = '23503';
  end if;

  select e.* into v_event
  from public.match_events e
  where e.match_id = p_match_id and e.client_event_id = p_client_event_id;
  if found then return v_event; end if;

  v_event := public.append_match_event(
    p_match_id,
    p_client_event_id,
    p_device_id,
    'delivery.recorded',
    jsonb_build_object(
      'delivery', p_delivery,
      'inningsId', p_innings_id,
      'matchSnapshot', p_match_snapshot,
      'liveState', p_live_state
    ),
    p_occurred_at
  );

  v_dismissal := case
    when v_wicket then (p_delivery -> 'dismissal') || jsonb_build_object(
      'creditedToBowler', coalesce(p_delivery -> 'dismissal' ->> 'type', '')
        not in ('run-out', 'obstructing-the-field')
    )
    else null
  end;

  insert into public.deliveries (
    match_id, innings_id, event_id, sequence, over_number, ball_in_over,
    striker_id, non_striker_id, bowler_id, end_name, delivery_style, outcome,
    batter_runs, extras, total_runs, legal_ball, wicket, dismissal,
    shot_zone, fielding_zone, fielder_id, notes, occurred_at, recorded_by
  ) values (
    p_match_id,
    p_innings_id,
    v_event.id,
    v_event.sequence,
    coalesce((p_delivery ->> 'over')::integer, 0),
    coalesce((p_delivery ->> 'ball')::integer, 1),
    (p_delivery ->> 'strikerId')::uuid,
    (p_delivery ->> 'nonStrikerId')::uuid,
    (p_delivery ->> 'bowlerId')::uuid,
    p_delivery ->> 'end',
    p_delivery ->> 'deliveryStyle',
    coalesce(p_delivery ->> 'outcome', 'not-recorded'),
    v_batter_runs,
    v_extras,
    v_batter_runs + v_extra_runs,
    v_legal,
    v_wicket,
    v_dismissal,
    coalesce(p_delivery ->> 'shotZone', p_delivery ->> 'fieldZone'),
    coalesce(p_delivery ->> 'fieldingZone', p_delivery ->> 'fieldZone'),
    nullif(p_delivery ->> 'fielderId', '')::uuid,
    p_delivery ->> 'note',
    p_occurred_at,
    (select auth.uid())
  ) returning * into v_delivery;

  update public.innings set
    runs = runs + v_batter_runs + v_extra_runs,
    wickets = wickets + case when v_wicket then 1 else 0 end,
    legal_balls = legal_balls + case when v_legal then 1 else 0 end,
    status = case
      when p_match_snapshot -> 'innings' -> -1 ->> 'status' = 'completed' then 'completed'
      else 'live'
    end,
    started_at = coalesce(started_at, p_occurred_at),
    completed_at = case
      when p_match_snapshot -> 'innings' -> -1 ->> 'status' = 'completed'
        then coalesce(completed_at, p_occurred_at)
      else completed_at
    end,
    updated_at = now()
  where id = p_innings_id;

  return v_event;
end;
$$;

create or replace function public.start_match_innings(
  p_match_id uuid,
  p_innings_number integer,
  p_batting_team_id uuid,
  p_bowling_team_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
  v_innings_id uuid;
  v_max_innings integer;
begin
  if not public.can_score_match(p_match_id) then
    raise exception 'not authorised to start this innings' using errcode = '42501';
  end if;
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'match was not found' using errcode = '23503';
  end if;
  if p_batting_team_id = p_bowling_team_id
    or p_batting_team_id not in (v_match.home_team_id, v_match.away_team_id)
    or p_bowling_team_id not in (v_match.home_team_id, v_match.away_team_id) then
    raise exception 'innings teams must be the two match teams' using errcode = '22023';
  end if;
  v_max_innings := coalesce(
    nullif(v_match.live_state #>> '{settings,inningsPerSide}', '')::integer,
    1
  ) * 2;
  if p_innings_number not between 2 and v_max_innings then
    raise exception 'innings number is outside the match format' using errcode = '22023';
  end if;

  select id into v_innings_id
  from public.innings
  where match_id = p_match_id and innings_number = p_innings_number;
  if found then return v_innings_id; end if;

  update public.innings
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where match_id = p_match_id
    and innings_number < p_innings_number
    and status in ('not_started', 'live');

  insert into public.innings (
    match_id,
    innings_number,
    batting_team_id,
    bowling_team_id,
    status,
    started_at
  ) values (
    p_match_id,
    p_innings_number,
    p_batting_team_id,
    p_bowling_team_id,
    'live',
    now()
  ) returning id into v_innings_id;

  update public.matches
  set status = 'live',
      started_at = coalesce(started_at, now()),
      updated_at = now()
  where id = p_match_id;

  return v_innings_id;
end;
$$;

create or replace function public.void_last_delivery_v1(
  p_match_id uuid,
  p_innings_id uuid,
  p_client_event_id uuid,
  p_device_id text,
  p_match_snapshot jsonb,
  p_live_state jsonb,
  p_occurred_at timestamptz
)
returns public.match_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.deliveries;
  v_event public.match_events;
begin
  if not public.can_score_match(p_match_id) then
    raise exception 'not authorised to correct this match' using errcode = '42501';
  end if;

  select e.* into v_event
  from public.match_events e
  where e.match_id = p_match_id and e.client_event_id = p_client_event_id;
  if found then return v_event; end if;

  select * into v_delivery
  from public.deliveries
  where match_id = p_match_id
    and innings_id = p_innings_id
    and superseded_by is null
    and voided_by_event_id is null
  order by sequence desc
  limit 1
  for update;
  if not found then
    raise exception 'there is no recorded delivery to undo' using errcode = '22023';
  end if;

  v_event := public.append_match_event(
    p_match_id,
    p_client_event_id,
    p_device_id,
    'delivery.voided',
    jsonb_build_object(
      'deliveryId', v_delivery.id,
      'inningsId', p_innings_id,
      'matchSnapshot', p_match_snapshot,
      'liveState', p_live_state
    ),
    p_occurred_at
  );

  update public.deliveries
  set voided_by_event_id = v_event.id
  where id = v_delivery.id;

  update public.innings
  set runs = greatest(0, runs - v_delivery.total_runs),
      wickets = greatest(0, wickets - case when v_delivery.wicket then 1 else 0 end),
      legal_balls = greatest(0, legal_balls - case when v_delivery.legal_ball then 1 else 0 end),
      status = 'live',
      completed_at = null,
      updated_at = now()
  where id = p_innings_id and match_id = p_match_id;

  return v_event;
end;
$$;

create or replace function public.create_camera_room(
  p_match_id uuid,
  p_name text default 'Match camera room'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.camera_rooms;
  v_token text;
  v_expires_at timestamptz := now() + interval '30 minutes';
begin
  if not public.can_score_match(p_match_id) and not exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and public.has_org_role(
        m.owner_organisation_id,
        array['coach']::public.platform_role[]
      )
  ) then
    raise exception 'not authorised to create a camera room' using errcode = '42501';
  end if;
  insert into public.camera_rooms (match_id, name, opened_by, closes_at)
  values (
    p_match_id,
    coalesce(nullif(trim(p_name), ''), 'Match camera room'),
    (select auth.uid()),
    now() + interval '8 hours'
  )
  returning * into v_room;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.camera_pairing_tokens (
    room_id,
    token_hash,
    expires_at,
    uses_remaining,
    created_by
  ) values (
    v_room.id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_expires_at,
    v_room.max_devices,
    (select auth.uid())
  );
  return jsonb_build_object(
    'roomId', v_room.id,
    'pairingToken', v_token,
    'expiresAt', v_expires_at
  );
end;
$$;

grant execute on function public.create_competition_workspace(uuid, text, text, text, date, date, jsonb) to authenticated;
grant execute on function public.create_match_workspace(uuid, uuid, uuid, uuid, uuid, timestamptz, public.match_visibility, uuid, integer, integer, integer, jsonb, text) to authenticated;
grant execute on function public.record_player_consent_decision(uuid, uuid, public.consent_state, public.consent_state, public.consent_state, public.consent_state, text) to authenticated;
grant execute on function public.record_delivery_v2(uuid, uuid, uuid, text, jsonb, jsonb, jsonb, timestamptz) to authenticated;
grant execute on function public.start_match_innings(uuid, integer, uuid, uuid) to authenticated;
grant execute on function public.void_last_delivery_v1(uuid, uuid, uuid, text, jsonb, jsonb, timestamptz) to authenticated;

commit;
