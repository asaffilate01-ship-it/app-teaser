CREATE TABLE public.competition_registration_settings (
  competition_id uuid PRIMARY KEY REFERENCES public.competitions(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  open boolean NOT NULL DEFAULT false,
  closes_at timestamptz,
  team_fee_minor integer NOT NULL DEFAULT 0 CHECK (team_fee_minor BETWEEN 0 AND 100000000),
  player_fee_minor integer NOT NULL DEFAULT 0 CHECK (player_fee_minor BETWEEN 0 AND 100000000),
  currency text NOT NULL DEFAULT 'GBP' CHECK (currency ~ '^[A-Z]{3}$'),
  payment_instructions text CHECK (payment_instructions IS NULL OR char_length(payment_instructions) <= 1000),
  overseas_limit integer CHECK (overseas_limit IS NULL OR overseas_limit BETWEEN 0 AND 11),
  played_down_limit integer CHECK (played_down_limit IS NULL OR played_down_limit BETWEEN 1 AND 50),
  registered_only boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_registration_settings TO authenticated;
GRANT ALL ON public.competition_registration_settings TO service_role;
ALTER TABLE public.competition_registration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY reg_settings_select ON public.competition_registration_settings FOR SELECT TO authenticated
  USING (open OR public.is_org_member(organisation_id) OR public.is_competition_participant(competition_id));
CREATE POLICY reg_settings_write ON public.competition_registration_settings FOR ALL TO authenticated
  USING (public.has_org_role(organisation_id, array['owner','league_admin']::public.platform_role[]))
  WITH CHECK (public.has_org_role(organisation_id, array['owner','league_admin']::public.platform_role[])
    AND EXISTS (SELECT 1 FROM public.competitions c WHERE c.id = competition_id AND c.organisation_id = competition_registration_settings.organisation_id));

CREATE TABLE public.competition_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  fee_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  payment_reference text CHECK (payment_reference IS NULL OR char_length(payment_reference) <= 120),
  paid_confirmed_at timestamptz,
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  requested_by uuid DEFAULT auth.uid(),
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, team_id)
);
GRANT SELECT, UPDATE ON public.competition_registrations TO authenticated;
GRANT ALL ON public.competition_registrations TO service_role;
ALTER TABLE public.competition_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY comp_reg_select ON public.competition_registrations FOR SELECT TO authenticated
  USING (public.has_org_role(league_id, array['owner','league_admin']::public.platform_role[]) OR public.is_org_member(club_id));
-- Clubs may only add their payment reference while pending; everything else goes through the functions.
CREATE POLICY comp_reg_update_reference ON public.competition_registrations FOR UPDATE TO authenticated
  USING (status = 'pending' AND public.has_org_role(club_id, array['owner','club_admin','treasurer']::public.platform_role[]))
  WITH CHECK (status = 'pending' AND public.has_org_role(club_id, array['owner','club_admin','treasurer']::public.platform_role[]));

CREATE OR REPLACE FUNCTION public.guard_registration_update()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
BEGIN
  IF coalesce(current_setting('criclume.registration', true), '') <> 'on' THEN
    IF (NEW.status, NEW.fee_minor, NEW.currency, NEW.team_id, NEW.club_id, NEW.league_id, NEW.competition_id, NEW.paid_confirmed_at, NEW.decided_by)
       IS DISTINCT FROM (OLD.status, OLD.fee_minor, OLD.currency, OLD.team_id, OLD.club_id, OLD.league_id, OLD.competition_id, OLD.paid_confirmed_at, OLD.decided_by) THEN
      RAISE EXCEPTION 'Only the payment reference and note can be changed here.';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER competition_registrations_guard BEFORE UPDATE ON public.competition_registrations FOR EACH ROW EXECUTE FUNCTION public.guard_registration_update();

CREATE OR REPLACE FUNCTION public.open_registrations()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'competitionId', c.id, 'competition', c.name, 'league', o.name, 'leagueId', o.id,
    'closesAt', s.closes_at, 'teamFeeMinor', s.team_fee_minor, 'playerFeeMinor', s.player_fee_minor,
    'currency', s.currency, 'paymentInstructions', s.payment_instructions,
    'overseasLimit', s.overseas_limit, 'playedDownLimit', s.played_down_limit, 'registeredOnly', s.registered_only)
    order by s.closes_at nulls last), '[]'::jsonb)
  from public.competition_registration_settings s
  join public.competitions c on c.id = s.competition_id
  join public.organisations o on o.id = c.organisation_id
  where s.open and (s.closes_at is null or s.closes_at > now()) and (select auth.uid()) is not null;
$function$;
REVOKE ALL ON FUNCTION public.open_registrations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_registrations() TO authenticated;

CREATE OR REPLACE FUNCTION public.register_team(p_competition_id uuid, p_team_id uuid, p_note text DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE s public.competition_registration_settings%ROWTYPE; t public.teams%ROWTYPE; v_id uuid;
BEGIN
  SELECT * INTO s FROM public.competition_registration_settings WHERE competition_id = p_competition_id;
  IF NOT FOUND OR NOT s.open OR (s.closes_at IS NOT NULL AND s.closes_at <= now()) THEN
    RAISE EXCEPTION 'Registration for that competition is closed.';
  END IF;
  SELECT * INTO t FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND OR NOT public.has_org_role(t.organisation_id, array['owner','club_admin']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only your club''s admins can register its teams.' USING errcode = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.competition_entries WHERE competition_id = p_competition_id AND team_id = p_team_id AND status = 'active') THEN
    RAISE EXCEPTION 'That team is already in the competition.';
  END IF;
  INSERT INTO public.competition_registrations (competition_id, league_id, team_id, club_id, fee_minor, currency, note)
  VALUES (p_competition_id, s.organisation_id, p_team_id, t.organisation_id, s.team_fee_minor, s.currency, left(p_note, 500))
  ON CONFLICT (competition_id, team_id) DO UPDATE SET status = 'pending', note = excluded.note, decided_by = NULL
    WHERE public.competition_registrations.status IN ('rejected','withdrawn')
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'That team has already asked to join.'; END IF;
  RETURN v_id;
END $function$;
REVOKE ALL ON FUNCTION public.register_team(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_team(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_team_registration(p_id uuid, p_decision text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE r public.competition_registrations%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.competition_registrations WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_org_role(r.league_id, array['owner','league_admin']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only league admins can decide registrations.' USING errcode = '42501';
  END IF;
  IF p_decision NOT IN ('approve','reject','paid') THEN RAISE EXCEPTION 'Unknown decision.'; END IF;
  PERFORM set_config('criclume.registration', 'on', true);
  IF p_decision = 'paid' THEN
    UPDATE public.competition_registrations SET paid_confirmed_at = now(), decided_by = auth.uid() WHERE id = p_id;
  ELSIF p_decision = 'approve' THEN
    UPDATE public.competition_registrations SET status = 'approved', decided_by = auth.uid() WHERE id = p_id;
    INSERT INTO public.competition_entries (competition_id, team_id, status)
    VALUES (r.competition_id, r.team_id, 'active')
    ON CONFLICT DO NOTHING;
    UPDATE public.competition_entries SET status = 'active' WHERE competition_id = r.competition_id AND team_id = r.team_id;
  ELSE
    UPDATE public.competition_registrations SET status = 'rejected', decided_by = auth.uid() WHERE id = p_id;
  END IF;
  PERFORM set_config('criclume.registration', '', true);
END $function$;
REVOKE ALL ON FUNCTION public.decide_team_registration(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_team_registration(uuid, text) TO authenticated;

CREATE TABLE public.competition_player_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  overseas boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','rejected')),
  registered_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, player_id)
);
GRANT SELECT ON public.competition_player_registrations TO authenticated;
GRANT ALL ON public.competition_player_registrations TO service_role;
ALTER TABLE public.competition_player_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY comp_player_reg_select ON public.competition_player_registrations FOR SELECT TO authenticated
  USING (public.has_org_role(league_id, array['owner','league_admin']::public.platform_role[]) OR public.is_org_member(club_id));

CREATE OR REPLACE FUNCTION public.register_players(p_competition_id uuid, p_team_id uuid, p_player_ids uuid[], p_overseas uuid[] DEFAULT '{}')
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE t public.teams%ROWTYPE; c public.competitions%ROWTYPE; v_count int := 0;
BEGIN
  SELECT * INTO t FROM public.teams WHERE id = p_team_id;
  SELECT * INTO c FROM public.competitions WHERE id = p_competition_id;
  IF t.id IS NULL OR c.id IS NULL OR NOT public.has_org_role(t.organisation_id, array['owner','club_admin','team_manager']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only your club''s admins or team managers can register players.' USING errcode = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.competition_entries WHERE competition_id = p_competition_id AND team_id = p_team_id AND status = 'active') THEN
    RAISE EXCEPTION 'Register the team first; players can be added once the league accepts it.';
  END IF;
  IF coalesce(array_length(p_player_ids, 1), 0) > 60 THEN RAISE EXCEPTION 'Register at most 60 players at once.'; END IF;
  INSERT INTO public.competition_player_registrations (competition_id, league_id, team_id, club_id, player_id, overseas)
  SELECT p_competition_id, c.organisation_id, p_team_id, t.organisation_id, p.id, p.id = ANY (coalesce(p_overseas, '{}'))
  FROM public.players p WHERE p.id = ANY (p_player_ids) AND p.organisation_id = t.organisation_id
  ON CONFLICT (competition_id, player_id) DO UPDATE SET overseas = excluded.overseas, team_id = excluded.team_id
    WHERE public.competition_player_registrations.club_id = excluded.club_id AND public.competition_player_registrations.status = 'registered';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $function$;
REVOKE ALL ON FUNCTION public.register_players(uuid, uuid, uuid[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_players(uuid, uuid, uuid[], uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_player_registration_status(p_id uuid, p_status text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE r public.competition_player_registrations%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.competition_player_registrations WHERE id = p_id;
  IF NOT FOUND OR NOT public.has_org_role(r.league_id, array['owner','league_admin']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only league admins can change a player registration.' USING errcode = '42501';
  END IF;
  IF p_status NOT IN ('registered','rejected') THEN RAISE EXCEPTION 'Unknown status.'; END IF;
  UPDATE public.competition_player_registrations SET status = p_status WHERE id = p_id;
END $function$;
REVOKE ALL ON FUNCTION public.set_player_registration_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_player_registration_status(uuid, text) TO authenticated;

CREATE TABLE public.competition_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 2 AND 300),
  valid_until date,
  granted_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.competition_permits TO authenticated;
GRANT ALL ON public.competition_permits TO service_role;
ALTER TABLE public.competition_permits ENABLE ROW LEVEL SECURITY;
CREATE POLICY permits_select ON public.competition_permits FOR SELECT TO authenticated
  USING (public.has_org_role(league_id, array['owner','league_admin']::public.platform_role[])
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND public.is_org_member(t.organisation_id)));
CREATE POLICY permits_insert ON public.competition_permits FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(league_id, array['owner','league_admin']::public.platform_role[])
    AND EXISTS (SELECT 1 FROM public.competitions c WHERE c.id = competition_id AND c.organisation_id = competition_permits.league_id));
CREATE POLICY permits_delete ON public.competition_permits FOR DELETE TO authenticated
  USING (public.has_org_role(league_id, array['owner','league_admin']::public.platform_role[]));

-- Data for checking a team's eligibility (registrations, permits, suspensions, games for higher teams).
CREATE OR REPLACE FUNCTION public.team_eligibility_data(p_competition_id uuid, p_team_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE t public.teams%ROWTYPE; v_rank int;
BEGIN
  SELECT * INTO t FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND OR NOT (public.is_org_member(t.organisation_id) OR EXISTS (
    SELECT 1 FROM public.competitions c WHERE c.id = p_competition_id AND public.has_org_role(c.organisation_id, array['owner','league_admin']::public.platform_role[]))) THEN
    RETURN '{}'::jsonb;
  END IF;
  v_rank := coalesce(substring(coalesce(t.category, '') || ' ' || t.name from '(\d+)\s*(?:st|nd|rd|th)\s*XI')::int, 99);
  RETURN jsonb_build_object(
    'settings', (SELECT to_jsonb(s) - 'organisation_id' FROM public.competition_registration_settings s WHERE s.competition_id = p_competition_id),
    'registrations', coalesce((SELECT jsonb_agg(jsonb_build_object('playerId', r.player_id, 'overseas', r.overseas, 'status', r.status, 'teamId', r.team_id))
       FROM public.competition_player_registrations r WHERE r.competition_id = p_competition_id AND r.club_id = t.organisation_id), '[]'::jsonb),
    'permits', coalesce((SELECT jsonb_agg(jsonb_build_object('playerId', p.player_id, 'validUntil', p.valid_until))
       FROM public.competition_permits p WHERE p.competition_id = p_competition_id AND p.team_id = p_team_id
       AND (p.valid_until IS NULL OR p.valid_until >= current_date)), '[]'::jsonb),
    'suspensions', coalesce((SELECT jsonb_agg(jsonb_build_object('playerId', d.player_id, 'until', d.suspended_until))
       FROM public.discipline_cases d JOIN public.players pl ON pl.id = d.player_id
       WHERE pl.organisation_id = t.organisation_id AND d.status IN ('decided','appealed')
       AND d.suspended_from <= current_date AND d.suspended_until >= current_date), '[]'::jsonb),
    'higherTeamGames', coalesce((SELECT jsonb_object_agg(x.player_id, x.n) FROM (
       SELECT ms.player_id, count(*)::int AS n
       FROM public.match_squads ms JOIN public.matches m ON m.id = ms.match_id JOIN public.teams ht ON ht.id = ms.team_id
       WHERE ht.organisation_id = t.organisation_id AND ht.id <> t.id
         AND coalesce(substring(coalesce(ht.category, '') || ' ' || ht.name from '(\d+)\s*(?:st|nd|rd|th)\s*XI')::int, 99) < v_rank
         AND coalesce(m.scheduled_at, m.created_at) > now() - interval '365 days'
       GROUP BY ms.player_id) x), '{}'::jsonb)
  );
END $function$;

-- Transfers between clubs
CREATE TABLE public.player_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  from_club_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  to_club_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offered' CHECK (status IN ('offered','completed','declined','cancelled')),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  effective_on date NOT NULL DEFAULT current_date,
  new_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  requested_by uuid DEFAULT auth.uid(),
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK (from_club_id <> to_club_id)
);
GRANT SELECT ON public.player_transfers TO authenticated;
GRANT ALL ON public.player_transfers TO service_role;
ALTER TABLE public.player_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY transfers_select ON public.player_transfers FOR SELECT TO authenticated
  USING (public.has_org_role(from_club_id, array['owner','club_admin','team_manager']::public.platform_role[])
    OR public.has_org_role(to_club_id, array['owner','club_admin','team_manager']::public.platform_role[])
    OR EXISTS (SELECT 1 FROM public.league_memberships lm WHERE lm.status = 'approved' AND lm.club_id IN (from_club_id, to_club_id)
      AND public.has_org_role(lm.league_id, array['owner','league_admin']::public.platform_role[])));

CREATE OR REPLACE FUNCTION public.offer_player_transfer(p_player_id uuid, p_to_club text, p_note text DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE p public.players%ROWTYPE; v_to uuid; v_id uuid;
BEGIN
  SELECT * INTO p FROM public.players WHERE id = p_player_id;
  IF NOT FOUND OR NOT public.has_org_role(p.organisation_id, array['owner','club_admin']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only your club''s admins can release a player.' USING errcode = '42501';
  END IF;
  SELECT id INTO v_to FROM public.organisations WHERE kind IN ('club','school','academy') AND (slug = lower(btrim(p_to_club)) OR id::text = btrim(p_to_club));
  IF v_to IS NULL THEN RAISE EXCEPTION 'No club found with that web address. Ask the other club for their CricLume link name.'; END IF;
  IF v_to = p.organisation_id THEN RAISE EXCEPTION 'That is your own club.'; END IF;
  IF EXISTS (SELECT 1 FROM public.player_transfers WHERE player_id = p.id AND status = 'offered') THEN
    RAISE EXCEPTION 'That player already has a transfer waiting.';
  END IF;
  INSERT INTO public.player_transfers (player_id, player_name, from_club_id, to_club_id, note)
  VALUES (p.id, p.display_name, p.organisation_id, v_to, left(p_note, 500)) RETURNING id INTO v_id;
  RETURN v_id;
END $function$;
REVOKE ALL ON FUNCTION public.offer_player_transfer(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.offer_player_transfer(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.answer_player_transfer(p_id uuid, p_answer text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE x public.player_transfers%ROWTYPE; p public.players%ROWTYPE; v_new uuid;
BEGIN
  SELECT * INTO x FROM public.player_transfers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR x.status <> 'offered' THEN RAISE EXCEPTION 'That transfer is no longer waiting.'; END IF;
  IF p_answer = 'cancel' THEN
    IF NOT public.has_org_role(x.from_club_id, array['owner','club_admin']::public.platform_role[]) THEN RAISE EXCEPTION 'Not allowed.' USING errcode = '42501'; END IF;
    UPDATE public.player_transfers SET status = 'cancelled', decided_by = auth.uid(), decided_at = now() WHERE id = p_id;
    RETURN;
  END IF;
  IF NOT public.has_org_role(x.to_club_id, array['owner','club_admin']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only the receiving club''s admins can answer.' USING errcode = '42501';
  END IF;
  IF p_answer = 'decline' THEN
    UPDATE public.player_transfers SET status = 'declined', decided_by = auth.uid(), decided_at = now() WHERE id = p_id;
    RETURN;
  END IF;
  IF p_answer <> 'accept' THEN RAISE EXCEPTION 'Unknown answer.'; END IF;
  SELECT * INTO p FROM public.players WHERE id = x.player_id;
  INSERT INTO public.players (organisation_id, display_name, is_junior, linked_user_id, external_reference)
  VALUES (x.to_club_id, p.display_name, p.is_junior, p.linked_user_id, 'transfer:' || p.id::text)
  RETURNING id INTO v_new;
  UPDATE public.player_transfers SET status = 'completed', new_player_id = v_new, decided_by = auth.uid(), decided_at = now() WHERE id = p_id;
END $function$;
REVOKE ALL ON FUNCTION public.answer_player_transfer(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.answer_player_transfer(uuid, text) TO authenticated;

-- Discipline
CREATE TABLE public.discipline_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL,
  fixture_id uuid REFERENCES public.fixtures(id) ON DELETE SET NULL,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  offence text NOT NULL CHECK (char_length(btrim(offence)) BETWEEN 2 AND 160),
  detail text CHECK (detail IS NULL OR char_length(detail) <= 2000),
  incident_on date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','decided','appealed','closed')),
  fine_minor integer NOT NULL DEFAULT 0 CHECK (fine_minor BETWEEN 0 AND 100000000),
  currency text NOT NULL DEFAULT 'GBP' CHECK (currency ~ '^[A-Z]{3}$'),
  fine_paid boolean NOT NULL DEFAULT false,
  matches_banned integer CHECK (matches_banned IS NULL OR matches_banned BETWEEN 0 AND 100),
  suspended_from date,
  suspended_until date,
  outcome text CHECK (outcome IS NULL OR char_length(outcome) <= 1000),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (suspended_until IS NULL OR suspended_from IS NULL OR suspended_until >= suspended_from)
);
CREATE INDEX discipline_cases_player ON public.discipline_cases(player_id, suspended_until);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discipline_cases TO authenticated;
GRANT ALL ON public.discipline_cases TO service_role;
ALTER TABLE public.discipline_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY discipline_select ON public.discipline_cases FOR SELECT TO authenticated
  USING (public.has_org_role(league_id, array['owner','league_admin']::public.platform_role[])
    OR public.has_org_role(club_id, array['owner','club_admin','team_manager','safeguarding_officer']::public.platform_role[])
    OR public.can_act_for_player(player_id));
CREATE POLICY discipline_insert ON public.discipline_cases FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(league_id, array['owner','league_admin']::public.platform_role[])
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.organisation_id = discipline_cases.club_id)
    AND EXISTS (SELECT 1 FROM public.league_memberships lm WHERE lm.league_id = discipline_cases.league_id AND lm.club_id = discipline_cases.club_id AND lm.status = 'approved'));
CREATE POLICY discipline_update ON public.discipline_cases FOR UPDATE TO authenticated
  USING (public.has_org_role(league_id, array['owner','league_admin']::public.platform_role[]))
  WITH CHECK (public.has_org_role(league_id, array['owner','league_admin']::public.platform_role[]));
CREATE POLICY discipline_delete ON public.discipline_cases FOR DELETE TO authenticated
  USING (public.has_org_role(league_id, array['owner','league_admin']::public.platform_role[]) AND status = 'open');

CREATE OR REPLACE FUNCTION public.player_suspended_on(p_player_id uuid, p_day date)
 RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select max(d.suspended_until) from public.discipline_cases d
  where d.player_id = p_player_id and d.status in ('decided','appealed')
    and d.suspended_from is not null and d.suspended_until is not null
    and p_day between d.suspended_from and d.suspended_until;
$function$;

CREATE OR REPLACE FUNCTION public.block_suspended_selection()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_day date; v_until date; v_name text;
BEGIN
  IF tg_table_name = 'event_selections' THEN
    SELECT coalesce(e.starts_at::date, current_date) INTO v_day FROM public.club_events e WHERE e.id = NEW.event_id;
  ELSE
    SELECT coalesce(m.scheduled_at::date, current_date) INTO v_day FROM public.matches m WHERE m.id = NEW.match_id;
  END IF;
  v_until := public.player_suspended_on(NEW.player_id, coalesce(v_day, current_date));
  IF v_until IS NOT NULL THEN
    SELECT display_name INTO v_name FROM public.players WHERE id = NEW.player_id;
    RAISE EXCEPTION '% is suspended until % and cannot be picked.', coalesce(v_name, 'This player'), to_char(v_until, 'DD Mon YYYY') USING errcode = '23514';
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER event_selections_suspension BEFORE INSERT OR UPDATE OF player_id ON public.event_selections FOR EACH ROW EXECUTE FUNCTION public.block_suspended_selection();
CREATE TRIGGER match_squads_suspension BEFORE INSERT OR UPDATE OF player_id ON public.match_squads FOR EACH ROW EXECUTE FUNCTION public.block_suspended_selection();

-- Captain's marks for umpires, pitch and outfield
CREATE TABLE public.fixture_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id uuid NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  umpire_marks jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(umpire_marks) = 'array' AND jsonb_array_length(umpire_marks) <= 4),
  pitch_mark smallint CHECK (pitch_mark IS NULL OR pitch_mark BETWEEN 1 AND 6),
  outfield_mark smallint CHECK (outfield_mark IS NULL OR outfield_mark BETWEEN 1 AND 6),
  comments text CHECK (comments IS NULL OR char_length(comments) <= 1500),
  submitted_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fixture_id, team_id)
);
GRANT SELECT, INSERT, UPDATE ON public.fixture_marks TO authenticated;
GRANT ALL ON public.fixture_marks TO service_role;
ALTER TABLE public.fixture_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_marks_select ON public.fixture_marks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND public.is_org_member(t.organisation_id))
    OR EXISTS (SELECT 1 FROM public.fixtures f JOIN public.competitions c ON c.id = f.competition_id
      WHERE f.id = fixture_id AND public.has_org_role(c.organisation_id, array['owner','league_admin']::public.platform_role[])));
CREATE POLICY fixture_marks_insert ON public.fixture_marks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.fixtures f JOIN public.teams t ON t.id = team_id
    WHERE f.id = fixture_id AND team_id IN (f.home_team_id, f.away_team_id)
      AND public.has_org_role(t.organisation_id, array['owner','club_admin','team_manager','coach']::public.platform_role[])));
CREATE POLICY fixture_marks_update ON public.fixture_marks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id
      AND public.has_org_role(t.organisation_id, array['owner','club_admin','team_manager','coach']::public.platform_role[])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fixtures f JOIN public.teams t ON t.id = team_id
    WHERE f.id = fixture_id AND team_id IN (f.home_team_id, f.away_team_id)
      AND public.has_org_role(t.organisation_id, array['owner','club_admin','team_manager','coach']::public.platform_role[])));

-- Umpire's own match record and report
CREATE TABLE public.umpire_match_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.umpire_appointments(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  umpire_id uuid NOT NULL REFERENCES public.umpires(id) ON DELETE CASCADE,
  decisions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(decisions) = 'array' AND jsonb_array_length(decisions) <= 300),
  incidents text CHECK (incidents IS NULL OR char_length(incidents) <= 3000),
  pitch_comment text CHECK (pitch_comment IS NULL OR char_length(pitch_comment) <= 500),
  conduct_concern boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.umpire_match_reports TO authenticated;
GRANT ALL ON public.umpire_match_reports TO service_role;
ALTER TABLE public.umpire_match_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY umpire_reports_select ON public.umpire_match_reports FOR SELECT TO authenticated
  USING (public.is_my_umpire(umpire_id) OR public.is_umpire_manager(organisation_id));
CREATE POLICY umpire_reports_insert ON public.umpire_match_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_my_umpire(umpire_id) AND EXISTS (SELECT 1 FROM public.umpire_appointments a
    WHERE a.id = appointment_id AND a.umpire_id = umpire_match_reports.umpire_id AND a.organisation_id = umpire_match_reports.organisation_id
      AND a.status IN ('accepted','completed')));
CREATE POLICY umpire_reports_update ON public.umpire_match_reports FOR UPDATE TO authenticated
  USING (public.is_my_umpire(umpire_id))
  WITH CHECK (public.is_my_umpire(umpire_id) AND EXISTS (SELECT 1 FROM public.umpire_appointments a
    WHERE a.id = appointment_id AND a.umpire_id = umpire_match_reports.umpire_id AND a.organisation_id = umpire_match_reports.organisation_id));

CREATE TABLE public.umpire_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  umpire_id uuid NOT NULL REFERENCES public.umpires(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.umpire_appointments(id) ON DELETE SET NULL,
  assessor_id uuid NOT NULL DEFAULT auth.uid(),
  assessed_on date NOT NULL DEFAULT current_date,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(scores) = 'object'),
  overall smallint NOT NULL CHECK (overall BETWEEN 0 AND 100),
  recommended_grade text CHECK (recommended_grade IS NULL OR char_length(recommended_grade) <= 40),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.umpire_assessments TO authenticated;
GRANT ALL ON public.umpire_assessments TO service_role;
ALTER TABLE public.umpire_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY umpire_assess_select ON public.umpire_assessments FOR SELECT TO authenticated
  USING (public.is_my_umpire(umpire_id) OR public.is_umpire_manager(organisation_id));
CREATE POLICY umpire_assess_insert ON public.umpire_assessments FOR INSERT TO authenticated
  WITH CHECK (public.is_umpire_manager(organisation_id) AND assessor_id = (select auth.uid())
    AND EXISTS (SELECT 1 FROM public.umpires u WHERE u.id = umpire_id AND u.organisation_id = umpire_assessments.organisation_id));
CREATE POLICY umpire_assess_delete ON public.umpire_assessments FOR DELETE TO authenticated
  USING (public.is_umpire_manager(organisation_id) AND assessor_id = (select auth.uid()));

-- An umpire's captain's marks, without the team comments.
CREATE OR REPLACE FUNCTION public.my_umpire_marks()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('fixtureId', fm.fixture_id, 'on', f.starts_at, 'mark', (m ->> 'mark')::numeric) order by f.starts_at), '[]'::jsonb)
  from public.fixture_marks fm
  join public.fixtures f on f.id = fm.fixture_id
  cross join lateral jsonb_array_elements(fm.umpire_marks) m
  join public.umpires u on u.id::text = m ->> 'umpireId'
  where u.user_id = (select auth.uid()) and (m ->> 'mark') ~ '^[0-9]+(\.[0-9]+)?$';
$function$;
REVOKE ALL ON FUNCTION public.my_umpire_marks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_umpire_marks() TO authenticated;

-- Player auction / draft
CREATE TABLE public.auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 120),
  status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup','live','closed')),
  purse_minor integer NOT NULL CHECK (purse_minor BETWEEN 0 AND 2000000000),
  currency text NOT NULL DEFAULT 'GBP' CHECK (currency ~ '^[A-Z]{3}$'),
  max_squad integer NOT NULL DEFAULT 15 CHECK (max_squad BETWEEN 1 AND 40),
  current_lot_id uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.auction_teams (
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  PRIMARY KEY (auction_id, team_id)
);
CREATE TABLE public.auction_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  player_name text NOT NULL CHECK (char_length(btrim(player_name)) BETWEEN 2 AND 80),
  role text CHECK (role IS NULL OR char_length(role) <= 40),
  base_price_minor integer NOT NULL DEFAULT 0 CHECK (base_price_minor BETWEEN 0 AND 2000000000),
  sort integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','sold','unsold')),
  sold_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  sold_price_minor integer CHECK (sold_price_minor IS NULL OR sold_price_minor >= 0),
  sold_at timestamptz
);
CREATE INDEX auction_lots_auction ON public.auction_lots(auction_id, sort);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auctions, public.auction_teams, public.auction_lots TO authenticated;
GRANT ALL ON public.auctions, public.auction_teams, public.auction_lots TO service_role;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_lots ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_auction(p_auction_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select exists (select 1 from public.auctions a where a.id = p_auction_id and (
    public.is_org_member(a.organisation_id)
    or exists (select 1 from public.auction_teams at join public.teams t on t.id = at.team_id
               where at.auction_id = a.id and public.is_org_member(t.organisation_id))));
$function$;
CREATE OR REPLACE FUNCTION public.can_run_auction(p_auction_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select exists (select 1 from public.auctions a where a.id = p_auction_id
    and public.has_org_role(a.organisation_id, array['owner','league_admin','club_admin']::public.platform_role[]));
$function$;

CREATE POLICY auctions_select ON public.auctions FOR SELECT TO authenticated USING (public.can_view_auction(id));
CREATE POLICY auctions_insert ON public.auctions FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organisation_id, array['owner','league_admin','club_admin']::public.platform_role[]));
CREATE POLICY auctions_update ON public.auctions FOR UPDATE TO authenticated
  USING (public.can_run_auction(id)) WITH CHECK (public.has_org_role(organisation_id, array['owner','league_admin','club_admin']::public.platform_role[]));
CREATE POLICY auctions_delete ON public.auctions FOR DELETE TO authenticated USING (public.can_run_auction(id) AND status = 'setup');
CREATE POLICY auction_teams_select ON public.auction_teams FOR SELECT TO authenticated USING (public.can_view_auction(auction_id));
CREATE POLICY auction_teams_write ON public.auction_teams FOR INSERT TO authenticated WITH CHECK (public.can_run_auction(auction_id));
CREATE POLICY auction_teams_delete ON public.auction_teams FOR DELETE TO authenticated USING (public.can_run_auction(auction_id));
CREATE POLICY auction_lots_select ON public.auction_lots FOR SELECT TO authenticated USING (public.can_view_auction(auction_id));
CREATE POLICY auction_lots_insert ON public.auction_lots FOR INSERT TO authenticated WITH CHECK (public.can_run_auction(auction_id) AND status = 'waiting');
CREATE POLICY auction_lots_update ON public.auction_lots FOR UPDATE TO authenticated
  USING (public.can_run_auction(auction_id)) WITH CHECK (public.can_run_auction(auction_id) AND status IN ('waiting','unsold'));
CREATE POLICY auction_lots_delete ON public.auction_lots FOR DELETE TO authenticated USING (public.can_run_auction(auction_id) AND status <> 'sold');

CREATE OR REPLACE FUNCTION public.sell_auction_lot(p_lot_id uuid, p_team_id uuid, p_price_minor integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE l public.auction_lots%ROWTYPE; a public.auctions%ROWTYPE; v_spent bigint; v_count int;
BEGIN
  SELECT * INTO l FROM public.auction_lots WHERE id = p_lot_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_run_auction(l.auction_id) THEN RAISE EXCEPTION 'Only the auctioneer can sell players.' USING errcode = '42501'; END IF;
  SELECT * INTO a FROM public.auctions WHERE id = l.auction_id FOR UPDATE;
  IF a.status <> 'live' THEN RAISE EXCEPTION 'Start the auction first.'; END IF;
  IF l.status = 'sold' THEN RAISE EXCEPTION 'That player is already sold.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.auction_teams WHERE auction_id = a.id AND team_id = p_team_id) THEN RAISE EXCEPTION 'That team is not in this auction.'; END IF;
  IF p_price_minor < l.base_price_minor THEN RAISE EXCEPTION 'The price is below the base price.'; END IF;
  SELECT coalesce(sum(sold_price_minor), 0), count(*) INTO v_spent, v_count FROM public.auction_lots
    WHERE auction_id = a.id AND sold_team_id = p_team_id AND status = 'sold';
  IF v_spent + p_price_minor > a.purse_minor THEN RAISE EXCEPTION 'That team does not have enough left in its purse.'; END IF;
  IF v_count >= a.max_squad THEN RAISE EXCEPTION 'That team''s squad is full.'; END IF;
  UPDATE public.auction_lots SET status = 'sold', sold_team_id = p_team_id, sold_price_minor = p_price_minor, sold_at = now() WHERE id = p_lot_id;
END $function$;
REVOKE ALL ON FUNCTION public.sell_auction_lot(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sell_auction_lot(uuid, uuid, integer) TO authenticated;

CREATE TRIGGER audit_discipline_cases AFTER INSERT OR UPDATE OR DELETE ON public.discipline_cases FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('club_id');
CREATE TRIGGER audit_player_transfers AFTER INSERT OR UPDATE OR DELETE ON public.player_transfers FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('from_club_id');
CREATE TRIGGER audit_competition_registrations AFTER INSERT OR UPDATE OR DELETE ON public.competition_registrations FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('league_id');
CREATE TRIGGER audit_point_adjustments AFTER INSERT OR UPDATE OR DELETE ON public.competition_point_adjustments FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('league_id');

REVOKE ALL ON FUNCTION public.team_eligibility_data(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.team_eligibility_data(uuid, uuid) TO authenticated;