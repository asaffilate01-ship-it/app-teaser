
CREATE OR REPLACE FUNCTION public.club_site_path_org(p_name text)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid else null end;
$$;

CREATE OR REPLACE FUNCTION public.is_site_editor(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  select public.has_org_role(p_org, array['owner','club_admin','league_admin']::public.platform_role[]);
$$;
REVOKE ALL ON FUNCTION public.is_site_editor(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_site_editor(uuid) TO authenticated, service_role;

CREATE TABLE public.club_sites (
  organisation_id uuid PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  published boolean NOT NULL DEFAULT false,
  tagline text NOT NULL DEFAULT '' CHECK (char_length(tagline) <= 140),
  about text NOT NULL DEFAULT '' CHECK (char_length(about) <= 5000),
  accent text NOT NULL DEFAULT 'crimson' CHECK (accent IN ('crimson','gold','emerald','royal','teal','orange')),
  contact_email text CHECK (contact_email IS NULL OR (char_length(contact_email) <= 200 AND contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  contact_phone text CHECK (contact_phone IS NULL OR char_length(contact_phone) <= 40),
  address text CHECK (address IS NULL OR char_length(address) <= 300),
  map_url text CHECK (map_url IS NULL OR (char_length(map_url) <= 500 AND map_url ~ '^https://')),
  socials jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(socials) = 'object'),
  sponsors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sponsors) = 'array' AND jsonb_array_length(sponsors) <= 24),
  hero_path text CHECK (hero_path IS NULL OR public.club_site_path_org(hero_path) = organisation_id),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_sites TO authenticated;
GRANT ALL ON public.club_sites TO service_role;
ALTER TABLE public.club_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read site settings" ON public.club_sites FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));
CREATE POLICY "editors add site settings" ON public.club_sites FOR INSERT TO authenticated WITH CHECK (public.is_site_editor(organisation_id));
CREATE POLICY "editors change site settings" ON public.club_sites FOR UPDATE TO authenticated USING (public.is_site_editor(organisation_id)) WITH CHECK (public.is_site_editor(organisation_id));
CREATE POLICY "editors remove site settings" ON public.club_sites FOR DELETE TO authenticated USING (public.is_site_editor(organisation_id));

CREATE TABLE public.club_site_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'news' CHECK (kind IN ('news','notice','document')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 10000),
  file_path text CHECK (file_path IS NULL OR public.club_site_path_org(file_path) = organisation_id),
  link_url text CHECK (link_url IS NULL OR (char_length(link_url) <= 500 AND link_url ~ '^https://')),
  pinned boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'document' OR file_path IS NOT NULL OR link_url IS NOT NULL)
);
CREATE INDEX club_site_posts_org_idx ON public.club_site_posts (organisation_id, published_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_site_posts TO authenticated;
GRANT ALL ON public.club_site_posts TO service_role;
ALTER TABLE public.club_site_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read posts" ON public.club_site_posts FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));
CREATE POLICY "editors add posts" ON public.club_site_posts FOR INSERT TO authenticated WITH CHECK (public.is_site_editor(organisation_id));
CREATE POLICY "editors change posts" ON public.club_site_posts FOR UPDATE TO authenticated USING (public.is_site_editor(organisation_id)) WITH CHECK (public.is_site_editor(organisation_id));
CREATE POLICY "editors remove posts" ON public.club_site_posts FOR DELETE TO authenticated USING (public.is_site_editor(organisation_id));

CREATE TABLE public.club_site_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  path text NOT NULL CHECK (public.club_site_path_org(path) = organisation_id),
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 200),
  consent_confirmed boolean NOT NULL CHECK (consent_confirmed),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX club_site_photos_org_idx ON public.club_site_photos (organisation_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_site_photos TO authenticated;
GRANT ALL ON public.club_site_photos TO service_role;
ALTER TABLE public.club_site_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read photos" ON public.club_site_photos FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));
CREATE POLICY "editors add photos" ON public.club_site_photos FOR INSERT TO authenticated WITH CHECK (public.is_site_editor(organisation_id));
CREATE POLICY "editors change photos" ON public.club_site_photos FOR UPDATE TO authenticated USING (public.is_site_editor(organisation_id)) WITH CHECK (public.is_site_editor(organisation_id));
CREATE POLICY "editors remove photos" ON public.club_site_photos FOR DELETE TO authenticated USING (public.is_site_editor(organisation_id));

CREATE OR REPLACE FUNCTION public.club_site_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_TABLE_NAME = 'club_sites' THEN NEW.updated_by := auth.uid(); END IF;
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME <> 'club_sites' THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER club_sites_stamp BEFORE INSERT OR UPDATE ON public.club_sites FOR EACH ROW EXECUTE FUNCTION public.club_site_stamp();
CREATE TRIGGER club_site_posts_stamp BEFORE INSERT OR UPDATE ON public.club_site_posts FOR EACH ROW EXECUTE FUNCTION public.club_site_stamp();

CREATE OR REPLACE FUNCTION public.club_site_photo_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $$ BEGIN NEW.created_by := auth.uid(); RETURN NEW; END $$;
CREATE TRIGGER club_site_photos_stamp BEFORE INSERT ON public.club_site_photos FOR EACH ROW EXECUTE FUNCTION public.club_site_photo_stamp();

-- Website files: only that club's editors may add, replace or delete them (first folder = organisation id).
CREATE POLICY "site editors upload club site files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'club-site' AND public.is_site_editor(public.club_site_path_org(name)));
CREATE POLICY "site editors update club site files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'club-site' AND public.is_site_editor(public.club_site_path_org(name)))
  WITH CHECK (bucket_id = 'club-site' AND public.is_site_editor(public.club_site_path_org(name)));
CREATE POLICY "site editors delete club site files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'club-site' AND public.is_site_editor(public.club_site_path_org(name)));

-- The one public read path: published sites only, no player names, public matches only.
CREATE OR REPLACE FUNCTION public.get_club_site(p_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_org public.organisations%ROWTYPE;
  v_site public.club_sites%ROWTYPE;
  v_team_ids uuid[];
BEGIN
  SELECT * INTO v_org FROM public.organisations WHERE slug = p_slug;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_site FROM public.club_sites WHERE organisation_id = v_org.id;
  IF NOT FOUND OR NOT v_site.published THEN
    RETURN jsonb_build_object('published', false, 'name', v_org.name, 'kind', v_org.kind, 'slug', v_org.slug);
  END IF;
  SELECT coalesce(array_agg(id), '{}') INTO v_team_ids FROM public.teams WHERE organisation_id = v_org.id;

  RETURN jsonb_build_object(
    'published', true,
    'name', v_org.name, 'kind', v_org.kind, 'slug', v_org.slug,
    'site', jsonb_build_object(
      'tagline', v_site.tagline, 'about', v_site.about, 'accent', v_site.accent,
      'contactEmail', v_site.contact_email, 'contactPhone', v_site.contact_phone,
      'address', v_site.address, 'mapUrl', v_site.map_url, 'socials', v_site.socials,
      'sponsors', v_site.sponsors, 'heroPath', v_site.hero_path, 'updatedAt', v_site.updated_at),
    'teams', coalesce((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'shortName', t.short_name, 'ageGroup', t.age_group) ORDER BY t.name)
      FROM public.teams t WHERE t.organisation_id = v_org.id), '[]'::jsonb),
    'matches', coalesce((SELECT jsonb_agg(x.j ORDER BY x.sort_at DESC) FROM (
      SELECT jsonb_build_object(
        'id', m.id, 'status', m.status,
        'scheduledAt', m.scheduled_at, 'startedAt', m.started_at, 'completedAt', m.completed_at,
        'home', ht.name, 'away', at.name, 'ground', g.name,
        'runs', m.live_state->'runs', 'wickets', m.live_state->'wickets', 'overs', m.live_state->'overs',
        'target', m.live_state->'target', 'battingIsHome', m.live_state->'battingIsHome',
        'result', m.live_state->'result',
        'scoreboard', (SELECT s.slug FROM public.public_scoreboards s WHERE s.match_id = m.id AND s.enabled LIMIT 1)
      ) AS j, coalesce(m.started_at, m.scheduled_at, m.created_at) AS sort_at
      FROM public.matches m
      JOIN public.teams ht ON ht.id = m.home_team_id
      JOIN public.teams at ON at.id = m.away_team_id
      LEFT JOIN public.grounds g ON g.id = m.ground_id
      WHERE m.visibility = 'public'
        AND m.status IN ('scheduled','live','innings_break','completed','abandoned')
        AND (m.owner_organisation_id = v_org.id OR m.home_team_id = ANY(v_team_ids) OR m.away_team_id = ANY(v_team_ids))
      ORDER BY coalesce(m.started_at, m.scheduled_at, m.created_at) DESC
      LIMIT 60) x), '[]'::jsonb),
    'fixtures', coalesce((SELECT jsonb_agg(x.j ORDER BY x.starts_at) FROM (
      SELECT jsonb_build_object(
        'id', f.id, 'competitionId', f.competition_id, 'competition', c.name,
        'round', f.round_name, 'startsAt', f.starts_at, 'status', f.status,
        'homeTeamId', f.home_team_id, 'awayTeamId', f.away_team_id,
        'home', ht.name, 'away', at.name, 'ground', g.name,
        'result', CASE WHEN f.signed_off_at IS NOT NULL THEN f.result ELSE NULL END,
        'signedOff', f.signed_off_at IS NOT NULL, 'signedOffAt', f.signed_off_at,
        'ruleVersionId', f.rule_version_id
      ) AS j, f.starts_at
      FROM public.fixtures f
      JOIN public.competitions c ON c.id = f.competition_id
      JOIN public.teams ht ON ht.id = f.home_team_id
      JOIN public.teams at ON at.id = f.away_team_id
      LEFT JOIN public.grounds g ON g.id = f.ground_id
      WHERE f.status NOT IN ('draft','cancelled')
        AND (c.organisation_id = v_org.id OR f.home_team_id = ANY(v_team_ids) OR f.away_team_id = ANY(v_team_ids))
      ORDER BY f.starts_at NULLS LAST
      LIMIT 300) x), '[]'::jsonb),
    'competitions', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'format', c.format, 'season', s.name,
        'ruleVersionId', r.id, 'rules', r.rules) ORDER BY c.created_at DESC)
      FROM public.competitions c
      LEFT JOIN public.seasons s ON s.id = c.season_id
      LEFT JOIN LATERAL (SELECT rv.id, rv.rules FROM public.competition_rule_versions rv
        WHERE rv.competition_id = c.id AND rv.retired_at IS NULL ORDER BY rv.version DESC LIMIT 1) r ON true
      WHERE c.organisation_id = v_org.id), '[]'::jsonb),
    'posts', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'kind', p.kind, 'title', p.title, 'body', p.body, 'filePath', p.file_path,
        'linkUrl', p.link_url, 'pinned', p.pinned, 'publishedAt', p.published_at)
        ORDER BY p.pinned DESC, p.published_at DESC)
      FROM (SELECT * FROM public.club_site_posts WHERE organisation_id = v_org.id AND published_at IS NOT NULL AND published_at <= now()
        ORDER BY pinned DESC, published_at DESC LIMIT 60) p), '[]'::jsonb),
    'photos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', ph.id, 'path', ph.path, 'caption', ph.caption) ORDER BY ph.created_at DESC)
      FROM (SELECT * FROM public.club_site_photos WHERE organisation_id = v_org.id ORDER BY created_at DESC LIMIT 60) ph), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.get_club_site(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_club_site(text) TO anon, authenticated, service_role;
