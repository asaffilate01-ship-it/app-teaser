
CREATE TABLE public.fixture_result_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id uuid NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  submitted_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fixture_id, team_id)
);
GRANT SELECT ON public.fixture_result_reports TO authenticated;
GRANT ALL ON public.fixture_result_reports TO service_role;
ALTER TABLE public.fixture_result_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "league and club members read result reports" ON public.fixture_result_reports FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.fixtures f
  JOIN public.competitions c ON c.id = f.competition_id
  JOIN public.teams t ON t.id = fixture_result_reports.team_id
  WHERE f.id = fixture_result_reports.fixture_id
    AND (public.is_org_member(c.organisation_id) OR public.is_org_member(t.organisation_id))
));

-- Same rules the league table uses: exactly one of winner / tie / no result; whole runs; balls above zero unless no result.
CREATE OR REPLACE FUNCTION public.fixture_result_is_valid(p_result jsonb, p_home uuid, p_away uuid)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO ''
AS $$
DECLARE
  v_winner text := p_result->>'winnerTeamId';
  v_tied boolean := coalesce((p_result->>'tied')::boolean, false);
  v_nr boolean := coalesce((p_result->>'noResult')::boolean, false);
  k text;
BEGIN
  IF jsonb_typeof(p_result) <> 'object' THEN RETURN false; END IF;
  IF (v_winner IS NOT NULL)::int + v_tied::int + v_nr::int <> 1 THEN RETURN false; END IF;
  IF v_winner IS NOT NULL AND v_winner NOT IN (p_home::text, p_away::text) THEN RETURN false; END IF;
  FOREACH k IN ARRAY array['homeBonusPoints','awayBonusPoints'] LOOP
    IF p_result ? k AND (jsonb_typeof(p_result->k) <> 'number' OR (p_result->>k)::numeric < 0 OR (p_result->>k)::numeric > 100) THEN RETURN false; END IF;
  END LOOP;
  IF v_nr THEN RETURN true; END IF;
  FOREACH k IN ARRAY array['homeRuns','awayRuns','homeLegalBalls','awayLegalBalls'] LOOP
    IF NOT (p_result ? k) OR jsonb_typeof(p_result->k) <> 'number' THEN RETURN false; END IF;
    IF (p_result->>k)::numeric <> floor((p_result->>k)::numeric) OR (p_result->>k)::numeric < 0 OR (p_result->>k)::numeric > 100000 THEN RETURN false; END IF;
  END LOOP;
  IF (p_result->>'homeLegalBalls')::int = 0 OR (p_result->>'awayLegalBalls')::int = 0 THEN RETURN false; END IF;
  RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.clean_fixture_result(p_result jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $$
  select jsonb_strip_nulls(jsonb_build_object(
    'winnerTeamId', p_result->'winnerTeamId',
    'tied', case when coalesce((p_result->>'tied')::boolean, false) then true end,
    'noResult', case when coalesce((p_result->>'noResult')::boolean, false) then true end,
    'homeRuns', p_result->'homeRuns', 'awayRuns', p_result->'awayRuns',
    'homeLegalBalls', p_result->'homeLegalBalls', 'awayLegalBalls', p_result->'awayLegalBalls',
    'homeBonusPoints', p_result->'homeBonusPoints', 'awayBonusPoints', p_result->'awayBonusPoints'));
$$;

CREATE OR REPLACE FUNCTION public.report_fixture_result(p_fixture_id uuid, p_team_id uuid, p_result jsonb, p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  f public.fixtures%ROWTYPE;
  v_org uuid;
BEGIN
  SELECT * INTO f FROM public.fixtures WHERE id = p_fixture_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That fixture no longer exists.'; END IF;
  IF p_team_id NOT IN (f.home_team_id, f.away_team_id) THEN RAISE EXCEPTION 'That team is not playing in this fixture.'; END IF;
  SELECT organisation_id INTO v_org FROM public.teams WHERE id = p_team_id;
  IF NOT public.has_org_role(v_org, array['owner','club_admin','team_manager','scorer']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only that team''s club admins, team managers or scorers can send its result.';
  END IF;
  IF f.signed_off_at IS NOT NULL THEN RAISE EXCEPTION 'The league has already signed this result off.'; END IF;
  IF f.status IN ('draft','cancelled') THEN RAISE EXCEPTION 'This fixture is not being played.'; END IF;
  IF NOT public.fixture_result_is_valid(p_result, f.home_team_id, f.away_team_id) THEN
    RAISE EXCEPTION 'Check the result: pick a winner, a tie or no result, and enter runs and balls for both sides.';
  END IF;
  INSERT INTO public.fixture_result_reports (fixture_id, team_id, result, note, submitted_by, submitted_at)
  VALUES (p_fixture_id, p_team_id, public.clean_fixture_result(p_result), left(coalesce(p_note, ''), 500), auth.uid(), now())
  ON CONFLICT (fixture_id, team_id) DO UPDATE SET result = excluded.result, note = excluded.note, submitted_by = excluded.submitted_by, submitted_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.sign_off_fixture_result(p_fixture_id uuid, p_result jsonb, p_abandoned boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  f public.fixtures%ROWTYPE;
  v_org uuid;
BEGIN
  SELECT * INTO f FROM public.fixtures WHERE id = p_fixture_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That fixture no longer exists.'; END IF;
  SELECT organisation_id INTO v_org FROM public.competitions WHERE id = f.competition_id;
  IF NOT public.has_org_role(v_org, array['owner','league_admin']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only the league''s owner or league admins can sign results off.';
  END IF;
  IF NOT public.fixture_result_is_valid(p_result, f.home_team_id, f.away_team_id) THEN
    RAISE EXCEPTION 'Check the result: pick a winner, a tie or no result, and enter runs and balls for both sides.';
  END IF;
  IF p_abandoned AND NOT coalesce((p_result->>'noResult')::boolean, false) THEN
    RAISE EXCEPTION 'An abandoned match must be recorded as no result.';
  END IF;
  UPDATE public.fixtures SET
    result = public.clean_fixture_result(p_result),
    status = CASE WHEN p_abandoned THEN 'abandoned'::public.fixture_status ELSE 'completed'::public.fixture_status END,
    signed_off_by = auth.uid(),
    signed_off_at = now()
  WHERE id = p_fixture_id;
END $$;

CREATE OR REPLACE FUNCTION public.reopen_fixture_result(p_fixture_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_org uuid;
BEGIN
  SELECT c.organisation_id INTO v_org FROM public.fixtures f JOIN public.competitions c ON c.id = f.competition_id WHERE f.id = p_fixture_id;
  IF v_org IS NULL OR NOT public.has_org_role(v_org, array['owner','league_admin']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only the league''s owner or league admins can reopen a result.';
  END IF;
  UPDATE public.fixtures SET signed_off_by = NULL, signed_off_at = NULL WHERE id = p_fixture_id;
END $$;

-- Fixtures that have started (or are due) for this club or league, with both reports and a result suggested by the scored match.
CREATE OR REPLACE FUNCTION public.fixture_results_inbox(p_org uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_team_ids uuid[];
BEGIN
  IF NOT public.is_org_member(p_org) THEN RAISE EXCEPTION 'You are not a member of this club.'; END IF;
  SELECT coalesce(array_agg(id), '{}') INTO v_team_ids FROM public.teams WHERE organisation_id = p_org;
  RETURN coalesce((SELECT jsonb_agg(row ORDER BY (row->>'startsAt') DESC NULLS LAST) FROM (
    SELECT jsonb_build_object(
      'fixtureId', f.id, 'competitionId', c.id, 'competition', c.name, 'round', f.round_name,
      'startsAt', f.starts_at, 'status', f.status,
      'homeTeamId', f.home_team_id, 'awayTeamId', f.away_team_id, 'home', ht.name, 'away', at.name,
      'signedOffAt', f.signed_off_at, 'officialResult', CASE WHEN f.signed_off_at IS NOT NULL THEN f.result END,
      'isLeagueAdmin', public.has_org_role(c.organisation_id, array['owner','league_admin']::public.platform_role[]),
      'myTeamIds', to_jsonb(ARRAY(SELECT x FROM unnest(array[f.home_team_id, f.away_team_id]) x WHERE x = ANY(v_team_ids)
        AND public.has_org_role(p_org, array['owner','club_admin','team_manager','scorer']::public.platform_role[]))),
      'reports', coalesce((SELECT jsonb_agg(jsonb_build_object('teamId', r.team_id, 'result', r.result, 'note', r.note, 'submittedAt', r.submitted_at))
        FROM public.fixture_result_reports r WHERE r.fixture_id = f.id), '[]'::jsonb),
      'suggested', (SELECT jsonb_build_object(
          'matchId', m.id,
          'homeRuns', (SELECT i.runs FROM public.innings i WHERE i.match_id = m.id AND i.batting_team_id = f.home_team_id ORDER BY i.innings_number LIMIT 1),
          'homeLegalBalls', (SELECT i.legal_balls FROM public.innings i WHERE i.match_id = m.id AND i.batting_team_id = f.home_team_id ORDER BY i.innings_number LIMIT 1),
          'awayRuns', (SELECT i.runs FROM public.innings i WHERE i.match_id = m.id AND i.batting_team_id = f.away_team_id ORDER BY i.innings_number LIMIT 1),
          'awayLegalBalls', (SELECT i.legal_balls FROM public.innings i WHERE i.match_id = m.id AND i.batting_team_id = f.away_team_id ORDER BY i.innings_number LIMIT 1),
          'status', m.status, 'resultText', m.live_state->>'result')
        FROM public.matches m WHERE m.fixture_id = f.id ORDER BY m.updated_at DESC LIMIT 1)
    ) AS row
    FROM public.fixtures f
    JOIN public.competitions c ON c.id = f.competition_id
    JOIN public.teams ht ON ht.id = f.home_team_id
    JOIN public.teams at ON at.id = f.away_team_id
    WHERE f.status NOT IN ('draft','cancelled')
      AND (f.starts_at IS NULL OR f.starts_at <= now() + interval '1 day')
      AND (c.organisation_id = p_org OR f.home_team_id = ANY(v_team_ids) OR f.away_team_id = ANY(v_team_ids))
    ORDER BY f.starts_at DESC NULLS LAST
    LIMIT 200) s), '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.report_fixture_result(uuid, uuid, jsonb, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.sign_off_fixture_result(uuid, jsonb, boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.reopen_fixture_result(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.fixture_results_inbox(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.report_fixture_result(uuid, uuid, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sign_off_fixture_result(uuid, jsonb, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_fixture_result(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fixture_results_inbox(uuid) TO authenticated, service_role;
