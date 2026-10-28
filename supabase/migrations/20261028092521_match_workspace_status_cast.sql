begin;
-- CASE resolves string literals to text; cast explicitly to the match_status enum.
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
    (case when p_scheduled_at is null then 'draft' else 'scheduled' end)::public.match_status,
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

commit;
