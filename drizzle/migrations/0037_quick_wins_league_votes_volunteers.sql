
-- 1. Walkovers in league results
CREATE OR REPLACE FUNCTION public.clean_fixture_result(p_result jsonb)
 RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $function$
  select jsonb_strip_nulls(jsonb_build_object(
    'winnerTeamId', p_result->'winnerTeamId',
    'walkover', case when coalesce((p_result->>'walkover')::boolean, false) and p_result->>'winnerTeamId' is not null then true end,
    'tied', case when coalesce((p_result->>'tied')::boolean, false) then true end,
    'noResult', case when coalesce((p_result->>'noResult')::boolean, false) then true end,
    'homeRuns', case when coalesce((p_result->>'walkover')::boolean, false) then null else p_result->'homeRuns' end,
    'awayRuns', case when coalesce((p_result->>'walkover')::boolean, false) then null else p_result->'awayRuns' end,
    'homeLegalBalls', case when coalesce((p_result->>'walkover')::boolean, false) then null else p_result->'homeLegalBalls' end,
    'awayLegalBalls', case when coalesce((p_result->>'walkover')::boolean, false) then null else p_result->'awayLegalBalls' end,
    'homeBonusPoints', p_result->'homeBonusPoints', 'awayBonusPoints', p_result->'awayBonusPoints'));
$function$;

CREATE OR REPLACE FUNCTION public.fixture_result_is_valid(p_result jsonb, p_home uuid, p_away uuid)
 RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO ''
AS $function$
DECLARE
  v_winner text := p_result->>'winnerTeamId';
  v_tied boolean := coalesce((p_result->>'tied')::boolean, false);
  v_nr boolean := coalesce((p_result->>'noResult')::boolean, false);
  v_walkover boolean := coalesce((p_result->>'walkover')::boolean, false);
  k text;
BEGIN
  IF jsonb_typeof(p_result) <> 'object' THEN RETURN false; END IF;
  IF (v_winner IS NOT NULL)::int + v_tied::int + v_nr::int <> 1 THEN RETURN false; END IF;
  IF v_winner IS NOT NULL AND v_winner NOT IN (p_home::text, p_away::text) THEN RETURN false; END IF;
  FOREACH k IN ARRAY array['homeBonusPoints','awayBonusPoints'] LOOP
    IF p_result ? k AND (jsonb_typeof(p_result->k) <> 'number' OR (p_result->>k)::numeric < 0 OR (p_result->>k)::numeric > 100) THEN RETURN false; END IF;
  END LOOP;
  IF v_nr THEN RETURN true; END IF;
  IF v_walkover THEN RETURN v_winner IS NOT NULL; END IF;
  FOREACH k IN ARRAY array['homeRuns','awayRuns','homeLegalBalls','awayLegalBalls'] LOOP
    IF NOT (p_result ? k) OR jsonb_typeof(p_result->k) <> 'number' THEN RETURN false; END IF;
    IF (p_result->>k)::numeric <> floor((p_result->>k)::numeric) OR (p_result->>k)::numeric < 0 OR (p_result->>k)::numeric > 100000 THEN RETURN false; END IF;
  END LOOP;
  IF (p_result->>'homeLegalBalls')::int = 0 OR (p_result->>'awayLegalBalls')::int = 0 THEN RETURN false; END IF;
  RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END $function$;

-- 2. Points deductions / awards
CREATE TABLE public.competition_point_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  points numeric(6,2) NOT NULL CHECK (points <> 0 AND points BETWEEN -100 AND 100),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 300),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX competition_point_adjustments_competition ON public.competition_point_adjustments(competition_id);
GRANT SELECT, INSERT, DELETE ON public.competition_point_adjustments TO authenticated;
GRANT ALL ON public.competition_point_adjustments TO service_role;
ALTER TABLE public.competition_point_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY point_adjustments_select ON public.competition_point_adjustments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.competitions c WHERE c.id = competition_id AND public.is_org_member(c.organisation_id))
         OR public.is_competition_participant(competition_id));
CREATE POLICY point_adjustments_insert ON public.competition_point_adjustments FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.competitions c WHERE c.id = competition_id
                AND public.has_org_role(c.organisation_id, ARRAY['owner','league_admin']::public.platform_role[]))
    AND EXISTS (SELECT 1 FROM public.fixtures f WHERE f.competition_id = competition_point_adjustments.competition_id
                AND team_id IN (f.home_team_id, f.away_team_id)));
CREATE POLICY point_adjustments_delete ON public.competition_point_adjustments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.competitions c WHERE c.id = competition_id
                 AND public.has_org_role(c.organisation_id, ARRAY['owner','league_admin']::public.platform_role[])));

-- Public club website tables carry the same deductions.
DO $do$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.get_club_site(text)'::regprocedure) INTO d;
  IF position('''adjustments''' in d) = 0 THEN
    d := replace(d, $r$'ruleVersionId', r.id, 'rules', r.rules)$r$,
      $r$'ruleVersionId', r.id, 'rules', r.rules, 'adjustments', coalesce((SELECT jsonb_agg(jsonb_build_object('teamId', a.team_id, 'points', a.points, 'reason', a.reason) ORDER BY a.created_at) FROM public.competition_point_adjustments a WHERE a.competition_id = c.id), '[]'::jsonb))$r$);
    IF position('''adjustments''' in d) = 0 THEN RAISE EXCEPTION 'get_club_site could not be updated'; END IF;
    EXECUTE d;
  END IF;
END $do$;

-- 3. Fan vote for Player of the Match
CREATE TABLE public.potm_votes (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  voter_hash text NOT NULL,
  player_ref text NOT NULL CHECK (player_ref ~ '^[0-9a-f]{16}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, voter_hash)
);
GRANT ALL ON public.potm_votes TO service_role;
ALTER TABLE public.potm_votes ENABLE ROW LEVEL SECURITY;
-- No policies: votes are only written and counted through the functions below.

CREATE OR REPLACE FUNCTION public.potm_vote_tally(p_slug text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_match uuid; v_status public.match_status; v_completed timestamptz; v_names jsonb; v_votes jsonb; v_total int;
BEGIN
  SELECT m.id, m.status, m.completed_at INTO v_match, v_status, v_completed
  FROM public.public_scoreboards s JOIN public.matches m ON m.id = s.match_id
  WHERE s.slug = p_slug AND s.enabled AND m.visibility = 'public';
  IF NOT FOUND THEN RETURN jsonb_build_object('enabled', false); END IF;
  v_names := public.get_ground_screen_names(p_slug);
  IF v_names = '{}'::jsonb THEN RETURN jsonb_build_object('enabled', false); END IF;
  SELECT coalesce(jsonb_object_agg(player_ref, n), '{}'::jsonb), coalesce(sum(n), 0) INTO v_votes, v_total
  FROM (SELECT player_ref, count(*)::int AS n FROM public.potm_votes WHERE match_id = v_match AND v_names ? player_ref GROUP BY player_ref) t;
  RETURN jsonb_build_object(
    'enabled', true,
    'open', v_status IN ('live','innings_break') OR (v_status = 'completed' AND coalesce(v_completed, now()) > now() - interval '3 days'),
    'votes', v_votes, 'total', v_total);
END $function$;

CREATE OR REPLACE FUNCTION public.cast_potm_vote(p_slug text, p_ref text, p_voter text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_match uuid; v_status public.match_status; v_completed timestamptz;
BEGIN
  IF coalesce(p_ref, '') !~ '^[0-9a-f]{16}$' OR char_length(coalesce(p_voter, '')) NOT BETWEEN 16 AND 100 THEN
    RAISE EXCEPTION 'That vote could not be counted.';
  END IF;
  SELECT m.id, m.status, m.completed_at INTO v_match, v_status, v_completed
  FROM public.public_scoreboards s JOIN public.matches m ON m.id = s.match_id
  WHERE s.slug = p_slug AND s.enabled AND m.visibility = 'public';
  IF NOT FOUND THEN RAISE EXCEPTION 'This scoreboard is not open.'; END IF;
  IF NOT (v_status IN ('live','innings_break') OR (v_status = 'completed' AND coalesce(v_completed, now()) > now() - interval '3 days')) THEN
    RAISE EXCEPTION 'Voting has closed for this match.';
  END IF;
  IF NOT (public.get_ground_screen_names(p_slug) ? p_ref) THEN
    RAISE EXCEPTION 'Fan voting is only open when the club shows player names.';
  END IF;
  INSERT INTO public.potm_votes (match_id, voter_hash, player_ref)
  VALUES (v_match, encode(extensions.digest(v_match::text || ':' || p_voter, 'sha256'), 'hex'), p_ref)
  ON CONFLICT (match_id, voter_hash) DO UPDATE SET player_ref = excluded.player_ref, updated_at = now();
  RETURN public.potm_vote_tally(p_slug);
END $function$;

CREATE OR REPLACE FUNCTION public.potm_vote_tally_for_match(p_match_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE m public.matches%ROWTYPE; v jsonb;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;
  IF NOT (public.is_org_member(m.owner_organisation_id)
          OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id IN (m.home_team_id, m.away_team_id) AND public.is_org_member(t.organisation_id))) THEN
    RETURN '{}'::jsonb;
  END IF;
  SELECT coalesce(jsonb_object_agg(player_ref, n), '{}'::jsonb) INTO v
  FROM (SELECT player_ref, count(*)::int AS n FROM public.potm_votes WHERE match_id = p_match_id GROUP BY player_ref) t;
  RETURN v;
END $function$;

REVOKE ALL ON FUNCTION public.potm_vote_tally(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cast_potm_vote(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.potm_vote_tally_for_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.potm_vote_tally(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_potm_vote(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.potm_vote_tally_for_match(uuid) TO authenticated;

-- 4. Volunteer jobs with self sign-up
CREATE TABLE public.club_volunteer_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.club_events(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 80),
  starts_at timestamptz NOT NULL,
  places integer NOT NULL CHECK (places BETWEEN 1 AND 50),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);
CREATE INDEX club_volunteer_jobs_org ON public.club_volunteer_jobs(organisation_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_volunteer_jobs TO authenticated;
GRANT ALL ON public.club_volunteer_jobs TO service_role;
ALTER TABLE public.club_volunteer_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY volunteer_jobs_select ON public.club_volunteer_jobs FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));
CREATE POLICY volunteer_jobs_insert ON public.club_volunteer_jobs FOR INSERT TO authenticated
  WITH CHECK (public.is_event_manager(organisation_id)
    AND (event_id IS NULL OR EXISTS (SELECT 1 FROM public.club_events e WHERE e.id = event_id AND e.organisation_id = club_volunteer_jobs.organisation_id)));
CREATE POLICY volunteer_jobs_update ON public.club_volunteer_jobs FOR UPDATE TO authenticated
  USING (public.is_event_manager(organisation_id))
  WITH CHECK (public.is_event_manager(organisation_id)
    AND (event_id IS NULL OR EXISTS (SELECT 1 FROM public.club_events e WHERE e.id = event_id AND e.organisation_id = club_volunteer_jobs.organisation_id)));
CREATE POLICY volunteer_jobs_delete ON public.club_volunteer_jobs FOR DELETE TO authenticated USING (public.is_event_manager(organisation_id));

CREATE TABLE public.club_volunteer_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.club_volunteer_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id)
);
GRANT SELECT, DELETE ON public.club_volunteer_signups TO authenticated;
GRANT ALL ON public.club_volunteer_signups TO service_role;
ALTER TABLE public.club_volunteer_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY volunteer_signups_select ON public.club_volunteer_signups FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));
CREATE POLICY volunteer_signups_delete ON public.club_volunteer_signups FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_event_manager(organisation_id));

CREATE OR REPLACE FUNCTION public.volunteer_sign_up(p_job_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE j public.club_volunteer_jobs%ROWTYPE; v_taken int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to volunteer.'; END IF;
  SELECT * INTO j FROM public.club_volunteer_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_org_member(j.organisation_id) THEN RAISE EXCEPTION 'That job is not open to you.'; END IF;
  IF j.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'That job has been cancelled.'; END IF;
  IF j.starts_at < now() - interval '6 hours' THEN RAISE EXCEPTION 'That job has already happened.'; END IF;
  IF EXISTS (SELECT 1 FROM public.club_volunteer_signups WHERE job_id = p_job_id AND user_id = auth.uid()) THEN RETURN; END IF;
  SELECT count(*) INTO v_taken FROM public.club_volunteer_signups WHERE job_id = p_job_id;
  IF v_taken >= j.places THEN RAISE EXCEPTION 'All places for that job are taken.'; END IF;
  INSERT INTO public.club_volunteer_signups (organisation_id, job_id, user_id) VALUES (j.organisation_id, p_job_id, auth.uid());
END $function$;
REVOKE ALL ON FUNCTION public.volunteer_sign_up(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.volunteer_sign_up(uuid) TO authenticated;

-- 5. Add a player to a team while scoring
CREATE OR REPLACE FUNCTION public.add_match_squad_player(p_match_id uuid, p_team_id uuid, p_name text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  m public.matches%ROWTYPE; t public.teams%ROWTYPE; v_id uuid;
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
BEGIN
  IF NOT public.can_score_match(p_match_id) THEN
    RAISE EXCEPTION 'Only this match''s scorers can add players.' USING errcode = '42501';
  END IF;
  SELECT * INTO m FROM public.matches WHERE id = p_match_id;
  IF p_team_id NOT IN (m.home_team_id, m.away_team_id) THEN RAISE EXCEPTION 'That team is not playing in this match.'; END IF;
  IF char_length(v_name) NOT BETWEEN 2 AND 60 THEN RAISE EXCEPTION 'Enter the player''s name (2 to 60 letters).'; END IF;
  SELECT * INTO t FROM public.teams WHERE id = p_team_id;
  IF NOT public.is_org_member(t.organisation_id) THEN
    RAISE EXCEPTION 'Only members of % can add players to that team. Ask their club to add the player.', t.name;
  END IF;
  INSERT INTO public.players (organisation_id, display_name, is_junior)
  VALUES (t.organisation_id, v_name,
          coalesce(t.age_group, '') ~* '^\s*u(nder)?\s*-?\d' OR coalesce(t.category, '') ~* '(junior|^\s*u\d)')
  RETURNING id INTO v_id;
  INSERT INTO public.match_squads (match_id, team_id, player_id, batting_position)
  VALUES (p_match_id, p_team_id, v_id,
          (SELECT coalesce(max(batting_position), 0) + 1 FROM public.match_squads WHERE match_id = p_match_id AND team_id = p_team_id));
  RETURN v_id;
END $function$;
REVOKE ALL ON FUNCTION public.add_match_squad_player(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_match_squad_player(uuid, uuid, text) TO authenticated;
