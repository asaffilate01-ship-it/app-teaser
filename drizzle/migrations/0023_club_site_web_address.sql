
ALTER TABLE public.club_sites ADD COLUMN web_slug text UNIQUE
  CHECK (web_slug IS NULL OR (web_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(web_slug) BETWEEN 3 AND 40));

CREATE OR REPLACE FUNCTION public.get_club_site(p_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_org public.organisations%ROWTYPE;
  v_site public.club_sites%ROWTYPE;
  v_team_ids uuid[];
BEGIN
  SELECT o.* INTO v_org FROM public.club_sites s JOIN public.organisations o ON o.id = s.organisation_id WHERE s.web_slug = p_slug;
  IF NOT FOUND THEN
    SELECT * INTO v_org FROM public.organisations WHERE slug = p_slug;
    IF NOT FOUND THEN RETURN NULL; END IF;
  END IF;
  SELECT * INTO v_site FROM public.club_sites WHERE organisation_id = v_org.id;
  IF NOT FOUND OR NOT v_site.published THEN
    RETURN jsonb_build_object('published', false, 'name', v_org.name, 'kind', v_org.kind, 'slug', coalesce(v_site.web_slug, v_org.slug));
  END IF;
  SELECT coalesce(array_agg(id), '{}') INTO v_team_ids FROM public.teams WHERE organisation_id = v_org.id;

  RETURN jsonb_build_object(
    'published', true,
    'name', v_org.name, 'kind', v_org.kind, 'slug', coalesce(v_site.web_slug, v_org.slug),
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
