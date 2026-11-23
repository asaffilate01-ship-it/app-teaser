
CREATE OR REPLACE FUNCTION public.start_match_innings_v2(
  p_match_id uuid,
  p_innings_id uuid,
  p_innings_number integer,
  p_batting_team_id uuid,
  p_bowling_team_id uuid,
  p_client_event_id uuid,
  p_device_id text,
  p_match_snapshot jsonb,
  p_live_state jsonb,
  p_occurred_at timestamptz
)
RETURNS public.match_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_match public.matches;
  v_existing public.innings;
  v_event public.match_events;
  v_max_innings integer;
BEGIN
  IF NOT public.can_score_match(p_match_id) THEN
    RAISE EXCEPTION 'not authorised to start this innings' USING errcode = '42501';
  END IF;

  -- Already applied (a retry after a lost reply): return the original event.
  SELECT e.* INTO v_event FROM public.match_events e WHERE e.match_id = p_match_id AND e.client_event_id = p_client_event_id;
  IF FOUND THEN RETURN v_event; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match was not found' USING errcode = '23503'; END IF;
  IF p_batting_team_id = p_bowling_team_id
    OR p_batting_team_id NOT IN (v_match.home_team_id, v_match.away_team_id)
    OR p_bowling_team_id NOT IN (v_match.home_team_id, v_match.away_team_id) THEN
    RAISE EXCEPTION 'innings teams must be the two match teams' USING errcode = '22023';
  END IF;
  v_max_innings := coalesce(nullif(coalesce(p_live_state, v_match.live_state) #>> '{settings,inningsPerSide}', '')::integer, 1) * 2;
  IF v_max_innings = 2 AND (coalesce(p_live_state, v_match.live_state) #>> '{settings,superOver}') = 'true' THEN
    v_max_innings := v_max_innings + 6;
  END IF;
  IF p_innings_number NOT BETWEEN 2 AND v_max_innings THEN
    RAISE EXCEPTION 'innings number is outside the match format' USING errcode = '22023';
  END IF;

  SELECT * INTO v_existing FROM public.innings WHERE match_id = p_match_id AND innings_number = p_innings_number;
  IF FOUND THEN
    IF v_existing.id <> p_innings_id THEN
      RAISE EXCEPTION 'another scorer already started innings %', p_innings_number USING errcode = '23505';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.innings WHERE id = p_innings_id) THEN
      RAISE EXCEPTION 'innings id already used' USING errcode = '23505';
    END IF;
    UPDATE public.innings
    SET status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now()
    WHERE match_id = p_match_id AND innings_number < p_innings_number AND status IN ('not_started', 'live');
    INSERT INTO public.innings (id, match_id, innings_number, batting_team_id, bowling_team_id, status, started_at)
    VALUES (p_innings_id, p_match_id, p_innings_number, p_batting_team_id, p_bowling_team_id, 'live', coalesce(p_occurred_at, now()));
  END IF;

  RETURN public.append_match_event(
    p_match_id, p_client_event_id, p_device_id, 'innings.started',
    jsonb_build_object('inningsId', p_innings_id, 'inningsNumber', p_innings_number, 'matchSnapshot', p_match_snapshot, 'liveState', p_live_state),
    p_occurred_at
  );
END $$;

REVOKE ALL ON FUNCTION public.start_match_innings_v2(uuid, uuid, integer, uuid, uuid, uuid, text, jsonb, jsonb, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_match_innings_v2(uuid, uuid, integer, uuid, uuid, uuid, text, jsonb, jsonb, timestamptz) TO authenticated, service_role;
