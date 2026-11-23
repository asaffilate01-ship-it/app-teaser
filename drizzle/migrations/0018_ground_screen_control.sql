CREATE TABLE public.ground_screens (
  scoreboard_id uuid PRIMARY KEY REFERENCES public.public_scoreboards(id) ON DELETE CASCADE,
  match_id uuid NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'manual')),
  pages text[] NOT NULL DEFAULT ARRAY['score','batting','bowling','manhattan','worm','chase']::text[]
    CHECK (cardinality(pages) BETWEEN 1 AND 6 AND pages <@ ARRAY['score','batting','bowling','manhattan','worm','chase']::text[]),
  interval_seconds integer NOT NULL DEFAULT 15 CHECK (interval_seconds BETWEEN 5 AND 120),
  manual_page text NOT NULL DEFAULT 'score' CHECK (manual_page IN ('score','batting','bowling','manhattan','worm','chase')),
  replays text NOT NULL DEFAULT 'off' CHECK (replays IN ('off', 'manual', 'auto')),
  replay_delivery_id uuid,
  replay_requested_at timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ground_screens TO authenticated;
GRANT ALL ON public.ground_screens TO service_role;

ALTER TABLE public.ground_screens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club and match people can read ground screen settings"
ON public.ground_screens FOR SELECT TO authenticated
USING (public.can_view_match(match_id));

-- Latest current public-highlights consent for a player is 'granted'.
CREATE OR REPLACE FUNCTION public.player_allows_public_highlights(p_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce((
    SELECT c.public_highlights = 'granted'
    FROM public.player_consents c
    WHERE c.player_id = p_player_id
      AND c.valid_from <= now()
      AND (c.valid_until IS NULL OR c.valid_until > now())
    ORDER BY c.created_at DESC
    LIMIT 1
  ), false);
$$;
REVOKE ALL ON FUNCTION public.player_allows_public_highlights(uuid) FROM public, anon;

-- Public, name-free display settings for a published scoreboard.
CREATE OR REPLACE FUNCTION public.get_ground_screen(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'mode', coalesce(g.mode, 'auto'),
    'pages', to_jsonb(coalesce(g.pages, ARRAY['score','batting','bowling','manhattan','worm','chase']::text[])),
    'intervalSeconds', coalesce(g.interval_seconds, 15),
    'manualPage', coalesce(g.manual_page, 'score'),
    'replays', coalesce(g.replays, 'off'),
    'updatedAt', g.updated_at
  )
  FROM public.public_scoreboards s
  JOIN public.matches m ON m.id = s.match_id
  LEFT JOIN public.ground_screens g ON g.scoreboard_id = s.id
  WHERE s.slug = p_slug AND s.enabled = true AND m.visibility = 'public';
$$;
GRANT EXECUTE ON FUNCTION public.get_ground_screen(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_ground_screen(
  p_match_id uuid,
  p_mode text,
  p_pages text[],
  p_interval_seconds integer,
  p_manual_page text,
  p_replays text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_board uuid;
BEGIN
  IF NOT public.can_score_match(p_match_id) THEN
    RAISE EXCEPTION 'only the club''s scorers and admins can control the ground screen' USING errcode = '42501';
  END IF;
  SELECT id INTO v_board FROM public.public_scoreboards WHERE match_id = p_match_id;
  IF v_board IS NULL THEN
    RAISE EXCEPTION 'publish the scoreboard first' USING errcode = '22023';
  END IF;
  INSERT INTO public.ground_screens (scoreboard_id, match_id, mode, pages, interval_seconds, manual_page, replays, updated_by, updated_at)
  VALUES (v_board, p_match_id, p_mode, p_pages, p_interval_seconds, p_manual_page, p_replays, (SELECT auth.uid()), now())
  ON CONFLICT (scoreboard_id) DO UPDATE
    SET mode = excluded.mode,
        pages = excluded.pages,
        interval_seconds = excluded.interval_seconds,
        manual_page = excluded.manual_page,
        replays = excluded.replays,
        updated_by = excluded.updated_by,
        updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.set_ground_screen(uuid, text, text[], integer, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_ground_screen(uuid, text, text[], integer, text, text) TO authenticated;

-- Recent wickets and boundaries whose batter and bowler both allow public highlights.
CREATE OR REPLACE FUNCTION public.ground_replay_candidates(p_match_id uuid)
RETURNS TABLE (id uuid, sequence bigint, over_number integer, ball_in_over integer, occurred_at timestamptz, wicket boolean, batter_runs integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT d.id, d.sequence::bigint, d.over_number::integer, d.ball_in_over::integer, d.occurred_at, d.wicket, d.batter_runs::integer
  FROM public.deliveries d
  WHERE public.can_view_match(p_match_id)
    AND d.match_id = p_match_id
    AND d.superseded_by IS NULL
    AND d.voided_by_event_id IS NULL
    AND (d.wicket OR d.batter_runs >= 4)
    AND d.striker_id IS NOT NULL AND d.bowler_id IS NOT NULL
    AND public.player_allows_public_highlights(d.striker_id)
    AND public.player_allows_public_highlights(d.bowler_id)
  ORDER BY d.sequence DESC
  LIMIT 40;
$$;
REVOKE ALL ON FUNCTION public.ground_replay_candidates(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ground_replay_candidates(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_ground_replay(p_match_id uuid, p_delivery_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.can_score_match(p_match_id) THEN
    RAISE EXCEPTION 'only the club''s scorers and admins can send replays' USING errcode = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ground_replay_candidates(p_match_id) c WHERE c.id = p_delivery_id) THEN
    RAISE EXCEPTION 'this ball can''t be replayed on the public screen (missing player consent or not a wicket/boundary)' USING errcode = '22023';
  END IF;
  UPDATE public.ground_screens
    SET replay_delivery_id = p_delivery_id, replay_requested_at = now(), updated_by = (SELECT auth.uid()), updated_at = now()
    WHERE match_id = p_match_id AND replays <> 'off';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'switch replays on for the ground screen first' USING errcode = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.request_ground_replay(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_ground_replay(uuid, uuid) TO authenticated;