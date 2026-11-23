create or replace function public.start_match_innings(p_match_id uuid, p_innings_number integer, p_batting_team_id uuid, p_bowling_team_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
  -- Super Over rule: up to three tie-break overs per side in one-innings matches.
  if v_max_innings = 2 and (v_match.live_state #>> '{settings,superOver}') = 'true' then
    v_max_innings := v_max_innings + 6;
  end if;
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
$function$;

revoke all on function public.start_match_innings(uuid, integer, uuid, uuid) from public, anon;
grant execute on function public.start_match_innings(uuid, integer, uuid, uuid) to authenticated;