-- 1. Where a club plays: country -> province (region) -> region/district -> town
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS town text;
ALTER TABLE public.organisations
  ADD CONSTRAINT organisations_district_length CHECK (district IS NULL OR char_length(btrim(district)) BETWEEN 1 AND 80),
  ADD CONSTRAINT organisations_town_length CHECK (town IS NULL OR char_length(btrim(town)) BETWEEN 1 AND 80);
COMMENT ON COLUMN public.organisations.region IS 'Province / state / county (first level inside the country)';
COMMENT ON COLUMN public.organisations.district IS 'Region / district inside the province';
COMMENT ON COLUMN public.organisations.town IS 'Town or city';

-- 2. Team type (1st XI, 2nd XI, U13, Ladies ...)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.teams ADD CONSTRAINT teams_category_format CHECK (category IS NULL OR category ~ '^[a-z0-9_]{1,24}$');

-- 3. How many teams a club may have: free plan = 1, paid plan = no limit, leagues = no limit
CREATE OR REPLACE FUNCTION public.club_team_limit(p_org uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN (SELECT kind FROM public.organisations WHERE id = p_org) = 'league' THEN NULL
    WHEN EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.organisation_id = p_org AND s.plan IN ('club', 'league') AND s.status IN ('active', 'trialing')
    ) THEN NULL
    ELSE 1
  END;
$$;
REVOKE ALL ON FUNCTION public.club_team_limit(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.club_team_limit(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.team_allowance(p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.is_org_member(p_org) THEN RAISE EXCEPTION 'You are not a member of this club.' USING errcode = '42501'; END IF;
  RETURN jsonb_build_object(
    'limit', public.club_team_limit(p_org),
    'used', (SELECT count(*) FROM public.teams WHERE organisation_id = p_org)
  );
END $$;
REVOKE ALL ON FUNCTION public.team_allowance(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.team_allowance(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_team_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_limit integer;
  v_used integer;
BEGIN
  IF tg_op = 'UPDATE' AND new.organisation_id IS NOT DISTINCT FROM old.organisation_id THEN RETURN new; END IF;
  -- Serialise team creation per club so two quick adds cannot both slip under the limit.
  PERFORM 1 FROM public.organisations WHERE id = new.organisation_id FOR UPDATE;
  v_limit := public.club_team_limit(new.organisation_id);
  IF v_limit IS NULL THEN RETURN new; END IF;
  SELECT count(*) INTO v_used FROM public.teams WHERE organisation_id = new.organisation_id AND id <> new.id;
  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'The free plan includes % team. Upgrade to the Club or League plan to add more teams such as a 2nd XI, age groups or ladies.', v_limit
      USING errcode = 'P0001';
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS teams_plan_limit ON public.teams;
CREATE TRIGGER teams_plan_limit BEFORE INSERT OR UPDATE OF organisation_id ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_limit();

-- 4. Clubs belonging to a league
CREATE TABLE public.league_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'left', 'removed')),
  requested_by uuid NOT NULL,
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, club_id),
  CHECK (league_id <> club_id)
);
CREATE INDEX league_memberships_club_idx ON public.league_memberships (club_id);
GRANT SELECT ON public.league_memberships TO authenticated;
GRANT ALL ON public.league_memberships TO service_role;
ALTER TABLE public.league_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY league_memberships_member_select ON public.league_memberships
  FOR SELECT TO authenticated USING (public.is_org_member(league_id) OR public.is_org_member(club_id));
CREATE TRIGGER league_memberships_updated_at BEFORE UPDATE ON public.league_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.search_leagues(p_query text DEFAULT '', p_country text DEFAULT NULL)
RETURNS TABLE (id uuid, name text, country_code text, region text, district text, town text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_q text := btrim(coalesce(p_query, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first.' USING errcode = '42501'; END IF;
  RETURN QUERY
  SELECT o.id, o.name, o.country_code, o.region, o.district, o.town
  FROM public.organisations o
  WHERE o.kind = 'league'
    AND (p_country IS NULL OR p_country = '' OR o.country_code = p_country)
    AND (v_q = '' OR o.name ILIKE '%' || replace(replace(v_q, '%', ''), '_', '') || '%')
  ORDER BY o.name
  LIMIT 50;
END $$;
REVOKE ALL ON FUNCTION public.search_leagues(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.search_leagues(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_league_membership(p_club uuid, p_league uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_row public.league_memberships%ROWTYPE;
BEGIN
  IF NOT public.has_org_role(p_club, array['owner', 'club_admin']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only the club''s owner or admins can join a league.' USING errcode = '42501';
  END IF;
  IF (SELECT kind FROM public.organisations WHERE id = p_league) IS DISTINCT FROM 'league' THEN
    RAISE EXCEPTION 'That league could not be found.' USING errcode = '22023';
  END IF;
  IF (SELECT kind FROM public.organisations WHERE id = p_club) = 'league' THEN
    RAISE EXCEPTION 'A league cannot join another league.' USING errcode = '22023';
  END IF;
  SELECT * INTO v_row FROM public.league_memberships WHERE league_id = p_league AND club_id = p_club FOR UPDATE;
  IF FOUND THEN
    IF v_row.status IN ('pending', 'approved') THEN RETURN v_row.id; END IF;
    UPDATE public.league_memberships
      SET status = 'pending', requested_by = auth.uid(), decided_by = NULL, decided_at = NULL
      WHERE id = v_row.id;
    RETURN v_row.id;
  END IF;
  INSERT INTO public.league_memberships (league_id, club_id, requested_by)
  VALUES (p_league, p_club, auth.uid())
  RETURNING id INTO v_row.id;
  RETURN v_row.id;
END $$;
REVOKE ALL ON FUNCTION public.request_league_membership(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_league_membership(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.decide_league_membership(p_id uuid, p_approve boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_row public.league_memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.league_memberships WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That request no longer exists.' USING errcode = '22023'; END IF;
  IF NOT public.has_org_role(v_row.league_id, array['owner', 'league_admin']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only the league''s owner or admins can decide this.' USING errcode = '42501';
  END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'This request has already been answered.' USING errcode = '22023'; END IF;
  UPDATE public.league_memberships
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
        decided_by = auth.uid(), decided_at = now()
    WHERE id = p_id;
END $$;
REVOKE ALL ON FUNCTION public.decide_league_membership(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.decide_league_membership(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.end_league_membership(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_row public.league_memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.league_memberships WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That link no longer exists.' USING errcode = '22023'; END IF;
  IF public.has_org_role(v_row.club_id, array['owner', 'club_admin']::public.platform_role[]) THEN
    UPDATE public.league_memberships SET status = 'left', decided_by = auth.uid(), decided_at = now() WHERE id = p_id;
  ELSIF public.has_org_role(v_row.league_id, array['owner', 'league_admin']::public.platform_role[]) THEN
    UPDATE public.league_memberships SET status = 'removed', decided_by = auth.uid(), decided_at = now() WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Only the club''s or league''s owner or admins can do this.' USING errcode = '42501';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.end_league_membership(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.end_league_membership(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.league_links(p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.is_org_member(p_org) THEN RAISE EXCEPTION 'You are not a member of this club.' USING errcode = '42501'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', m.id, 'status', m.status, 'createdAt', m.created_at, 'decidedAt', m.decided_at,
      'side', CASE WHEN m.league_id = p_org THEN 'league' ELSE 'club' END,
      'otherId', o.id, 'otherName', o.name, 'otherKind', o.kind,
      'country', o.country_code, 'region', o.region, 'district', o.district, 'town', o.town
    ) ORDER BY (m.status = 'pending') DESC, o.name)
    FROM public.league_memberships m
    JOIN public.organisations o ON o.id = CASE WHEN m.league_id = p_org THEN m.club_id ELSE m.league_id END
    WHERE (m.league_id = p_org OR m.club_id = p_org) AND m.status IN ('pending', 'approved')
  ), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.league_links(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.league_links(uuid) TO authenticated, service_role;

-- 5. Tournament / league invitations to other clubs
CREATE OR REPLACE FUNCTION public.competition_host(p_competition uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$ SELECT organisation_id FROM public.competitions WHERE id = p_competition; $$;
REVOKE ALL ON FUNCTION public.competition_host(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.competition_host(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_competition_participant(p_competition uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.competition_entries e
    JOIN public.teams t ON t.id = e.team_id
    WHERE e.competition_id = p_competition AND e.status = 'active' AND public.is_org_member(t.organisation_id)
  );
$$;
REVOKE ALL ON FUNCTION public.is_competition_participant(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_competition_participant(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_view_entered_team(p_team uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.competition_entries e
    JOIN public.competitions c ON c.id = e.competition_id
    WHERE e.team_id = p_team
      AND (public.is_org_member(c.organisation_id) OR public.is_competition_participant(c.id))
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_entered_team(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_view_entered_team(uuid) TO authenticated, service_role;

-- Clubs taking part can read the competition, its entries and the other teams' names.
CREATE POLICY competitions_participant_select ON public.competitions
  FOR SELECT TO authenticated USING (public.is_competition_participant(id));
CREATE POLICY entries_participant_select ON public.competition_entries
  FOR SELECT TO authenticated USING (public.is_competition_participant(competition_id));
CREATE POLICY teams_competition_select ON public.teams
  FOR SELECT TO authenticated USING (public.can_view_entered_team(id));

CREATE TABLE public.competition_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 500),
  team_ids uuid[] NOT NULL DEFAULT '{}',
  invited_by uuid NOT NULL,
  responded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (competition_id, organisation_id)
);
CREATE INDEX competition_invites_org_idx ON public.competition_invites (organisation_id, status);
GRANT SELECT ON public.competition_invites TO authenticated;
GRANT ALL ON public.competition_invites TO service_role;
ALTER TABLE public.competition_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY competition_invites_select ON public.competition_invites
  FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id) OR public.is_org_member(public.competition_host(competition_id)));

CREATE OR REPLACE FUNCTION public.find_clubs_to_invite(p_competition uuid, p_query text DEFAULT '', p_country text DEFAULT NULL)
RETURNS TABLE (id uuid, name text, kind text, country_code text, region text, district text, town text, invite_status text, in_league boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_host uuid := public.competition_host(p_competition);
  v_q text := btrim(coalesce(p_query, ''));
BEGIN
  IF v_host IS NULL OR NOT public.has_org_role(v_host, array['owner', 'league_admin']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only the organisers can invite clubs.' USING errcode = '42501';
  END IF;
  IF char_length(v_q) < 2 AND coalesce(p_country, '') = '' THEN RETURN; END IF;
  RETURN QUERY
  SELECT o.id, o.name, o.kind::text, o.country_code, o.region, o.district, o.town,
         i.status,
         EXISTS (SELECT 1 FROM public.league_memberships m WHERE m.league_id = v_host AND m.club_id = o.id AND m.status = 'approved')
  FROM public.organisations o
  LEFT JOIN public.competition_invites i ON i.competition_id = p_competition AND i.organisation_id = o.id
  WHERE o.id <> v_host AND o.kind <> 'league'
    AND (coalesce(p_country, '') = '' OR o.country_code = p_country)
    AND (v_q = '' OR o.name ILIKE '%' || replace(replace(v_q, '%', ''), '_', '') || '%'
         OR o.town ILIKE '%' || replace(replace(v_q, '%', ''), '_', '') || '%')
  ORDER BY o.name
  LIMIT 30;
END $$;
REVOKE ALL ON FUNCTION public.find_clubs_to_invite(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.find_clubs_to_invite(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.invite_clubs_to_competition(p_competition uuid, p_orgs uuid[], p_message text DEFAULT '')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_host uuid := public.competition_host(p_competition);
  v_org uuid;
  v_count integer := 0;
  v_status text;
BEGIN
  IF v_host IS NULL OR NOT public.has_org_role(v_host, array['owner', 'league_admin']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only the organisers can invite clubs.' USING errcode = '42501';
  END IF;
  IF coalesce(array_length(p_orgs, 1), 0) > 100 THEN
    RAISE EXCEPTION 'Invite up to 100 clubs at a time.' USING errcode = '22023';
  END IF;
  FOREACH v_org IN ARRAY coalesce(p_orgs, '{}') LOOP
    IF v_org = v_host OR NOT EXISTS (SELECT 1 FROM public.organisations WHERE id = v_org AND kind <> 'league') THEN
      CONTINUE;
    END IF;
    SELECT status INTO v_status FROM public.competition_invites
      WHERE competition_id = p_competition AND organisation_id = v_org FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.competition_invites (competition_id, organisation_id, message, invited_by)
      VALUES (p_competition, v_org, left(coalesce(p_message, ''), 500), auth.uid());
      v_count := v_count + 1;
    ELSIF v_status IN ('declined', 'withdrawn') THEN
      UPDATE public.competition_invites
        SET status = 'pending', message = left(coalesce(p_message, ''), 500), invited_by = auth.uid(),
            team_ids = '{}', responded_by = NULL, responded_at = NULL, created_at = now()
        WHERE competition_id = p_competition AND organisation_id = v_org;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.invite_clubs_to_competition(uuid, uuid[], text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.invite_clubs_to_competition(uuid, uuid[], text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.invite_league_clubs(p_competition uuid, p_message text DEFAULT '')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_host uuid := public.competition_host(p_competition);
BEGIN
  IF v_host IS NULL OR NOT public.has_org_role(v_host, array['owner', 'league_admin']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only the organisers can invite clubs.' USING errcode = '42501';
  END IF;
  RETURN public.invite_clubs_to_competition(
    p_competition,
    ARRAY(SELECT club_id FROM public.league_memberships WHERE league_id = v_host AND status = 'approved'),
    p_message
  );
END $$;
REVOKE ALL ON FUNCTION public.invite_league_clubs(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.invite_league_clubs(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.withdraw_competition_invite(p_invite uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_inv public.competition_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.competition_invites WHERE id = p_invite FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That invitation no longer exists.' USING errcode = '22023'; END IF;
  IF NOT public.has_org_role(public.competition_host(v_inv.competition_id), array['owner', 'league_admin']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only the organisers can withdraw an invitation.' USING errcode = '42501';
  END IF;
  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Only an unanswered invitation can be withdrawn.' USING errcode = '22023';
  END IF;
  UPDATE public.competition_invites SET status = 'withdrawn', responded_by = auth.uid(), responded_at = now() WHERE id = p_invite;
END $$;
REVOKE ALL ON FUNCTION public.withdraw_competition_invite(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_competition_invite(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.respond_competition_invite(p_invite uuid, p_accept boolean, p_team_ids uuid[] DEFAULT '{}')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_inv public.competition_invites%ROWTYPE;
  v_team uuid;
  v_teams uuid[];
BEGIN
  SELECT * INTO v_inv FROM public.competition_invites WHERE id = p_invite FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That invitation no longer exists.' USING errcode = '22023'; END IF;
  IF NOT public.has_org_role(v_inv.organisation_id, array['owner', 'club_admin', 'team_manager']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Only the club''s owner, admins or team managers can answer this invitation.' USING errcode = '42501';
  END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'This invitation has already been answered or withdrawn.' USING errcode = '22023'; END IF;
  IF NOT p_accept THEN
    UPDATE public.competition_invites SET status = 'declined', responded_by = auth.uid(), responded_at = now() WHERE id = p_invite;
    RETURN;
  END IF;
  v_teams := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_team_ids, '{}')) x);
  IF coalesce(array_length(v_teams, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Pick at least one of your teams to enter.' USING errcode = '22023';
  END IF;
  IF array_length(v_teams, 1) > 12 THEN
    RAISE EXCEPTION 'Enter up to 12 teams.' USING errcode = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_teams) x WHERE NOT EXISTS (
       SELECT 1 FROM public.teams t WHERE t.id = x AND t.organisation_id = v_inv.organisation_id)) THEN
    RAISE EXCEPTION 'You can only enter your own club''s teams.' USING errcode = '42501';
  END IF;
  FOREACH v_team IN ARRAY v_teams LOOP
    INSERT INTO public.competition_entries (competition_id, team_id, status)
    VALUES (v_inv.competition_id, v_team, 'active')
    ON CONFLICT (competition_id, team_id) DO UPDATE SET status = 'active';
  END LOOP;
  UPDATE public.competition_invites
    SET status = 'accepted', team_ids = v_teams, responded_by = auth.uid(), responded_at = now()
    WHERE id = p_invite;
END $$;
REVOKE ALL ON FUNCTION public.respond_competition_invite(uuid, boolean, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.respond_competition_invite(uuid, boolean, uuid[]) TO authenticated, service_role;

-- Invitations received, invitations sent and competitions entered, for one club.
CREATE OR REPLACE FUNCTION public.competition_invites_overview(p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.is_org_member(p_org) THEN RAISE EXCEPTION 'You are not a member of this club.' USING errcode = '42501'; END IF;
  RETURN jsonb_build_object(
    'received', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'status', i.status, 'message', i.message, 'createdAt', i.created_at, 'respondedAt', i.responded_at,
        'competitionId', c.id, 'competition', c.name, 'format', c.format,
        'season', s.name, 'startsOn', s.starts_on, 'endsOn', s.ends_on,
        'hostName', h.name, 'hostKind', h.kind, 'hostTown', h.town, 'hostRegion', h.region, 'hostCountry', h.country_code,
        'teamIds', to_jsonb(i.team_ids)
      ) ORDER BY (i.status = 'pending') DESC, i.created_at DESC)
      FROM public.competition_invites i
      JOIN public.competitions c ON c.id = i.competition_id
      JOIN public.seasons s ON s.id = c.season_id
      JOIN public.organisations h ON h.id = c.organisation_id
      WHERE i.organisation_id = p_org AND i.status IN ('pending', 'accepted')
    ), '[]'::jsonb),
    'sent', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'status', i.status, 'createdAt', i.created_at, 'respondedAt', i.responded_at,
        'competitionId', i.competition_id, 'clubId', o.id, 'clubName', o.name, 'clubTown', o.town,
        'clubRegion', o.region, 'clubCountry', o.country_code,
        'teams', coalesce((SELECT jsonb_agg(t.name ORDER BY t.name) FROM public.teams t WHERE t.id = ANY(i.team_ids)), '[]'::jsonb)
      ) ORDER BY o.name)
      FROM public.competition_invites i
      JOIN public.competitions c ON c.id = i.competition_id
      JOIN public.organisations o ON o.id = i.organisation_id
      WHERE c.organisation_id = p_org
    ), '[]'::jsonb),
    'entered', coalesce((
      SELECT jsonb_agg(row ORDER BY row->>'competition') FROM (
        SELECT jsonb_build_object(
          'competitionId', c.id, 'competition', c.name, 'format', c.format, 'season', s.name,
          'hostName', h.name,
          'teams', jsonb_agg(t.name ORDER BY t.name),
          'fixtures', (SELECT count(*) FROM public.fixtures f WHERE f.competition_id = c.id
                         AND (f.home_team_id IN (SELECT id FROM public.teams WHERE organisation_id = p_org)
                              OR f.away_team_id IN (SELECT id FROM public.teams WHERE organisation_id = p_org)))
        ) AS row
        FROM public.competition_entries e
        JOIN public.teams t ON t.id = e.team_id AND t.organisation_id = p_org
        JOIN public.competitions c ON c.id = e.competition_id AND c.organisation_id <> p_org
        JOIN public.seasons s ON s.id = c.season_id
        JOIN public.organisations h ON h.id = c.organisation_id
        WHERE e.status = 'active'
        GROUP BY c.id, c.name, c.format, s.name, h.name
      ) x
    ), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.competition_invites_overview(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.competition_invites_overview(uuid) TO authenticated, service_role;

-- Other clubs' teams entered in this club's competitions (for fixtures and tables).
CREATE OR REPLACE FUNCTION public.competition_entry_teams(p_org uuid)
RETURNS TABLE (competition_id uuid, team_id uuid, name text, short_name text, club_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.is_org_member(p_org) THEN RAISE EXCEPTION 'You are not a member of this club.' USING errcode = '42501'; END IF;
  RETURN QUERY
  SELECT e.competition_id, t.id, t.name, t.short_name, o.name
  FROM public.competition_entries e
  JOIN public.competitions c ON c.id = e.competition_id AND c.organisation_id = p_org
  JOIN public.teams t ON t.id = e.team_id
  JOIN public.organisations o ON o.id = t.organisation_id
  WHERE e.status = 'active'
  ORDER BY o.name, t.name;
END $$;
REVOKE ALL ON FUNCTION public.competition_entry_teams(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.competition_entry_teams(uuid) TO authenticated, service_role;

CREATE POLICY fixtures_participant_select ON public.fixtures
  FOR SELECT TO authenticated USING (public.is_competition_participant(competition_id));

-- Organisers may add only their own teams directly; other clubs' teams join by accepting an invitation.
DROP POLICY IF EXISTS entries_admin_insert ON public.competition_entries;
CREATE POLICY entries_admin_insert ON public.competition_entries
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.competitions c JOIN public.teams t ON t.id = competition_entries.team_id
    WHERE c.id = competition_entries.competition_id
      AND t.organisation_id = c.organisation_id
      AND public.has_org_role(c.organisation_id, ARRAY['owner'::public.platform_role, 'league_admin'::public.platform_role])
  ));
DROP POLICY IF EXISTS entries_admin_update ON public.competition_entries;
CREATE POLICY entries_admin_update ON public.competition_entries
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.competitions c
    WHERE c.id = competition_entries.competition_id
      AND public.has_org_role(c.organisation_id, ARRAY['owner'::public.platform_role, 'league_admin'::public.platform_role])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.competitions c JOIN public.teams t ON t.id = competition_entries.team_id
    WHERE c.id = competition_entries.competition_id
      AND public.has_org_role(c.organisation_id, ARRAY['owner'::public.platform_role, 'league_admin'::public.platform_role])
      AND (t.organisation_id = c.organisation_id OR EXISTS (
        SELECT 1 FROM public.competition_invites i
        WHERE i.competition_id = c.id AND i.status = 'accepted' AND competition_entries.team_id = ANY(i.team_ids)))
  ));