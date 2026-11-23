ALTER TABLE public.ground_screens ADD COLUMN show_names boolean NOT NULL DEFAULT false;

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
    'showNames', coalesce(g.show_names, false),
    'updatedAt', g.updated_at
  )
  FROM public.public_scoreboards s
  JOIN public.matches m ON m.id = s.match_id
  LEFT JOIN public.ground_screens g ON g.scoreboard_id = s.id
  WHERE s.slug = p_slug AND s.enabled = true AND m.visibility = 'public';
$$;

-- Names for the public ground screen: only when the club switched names on;
-- adults are shown, juniors only with current granted publicity consent.
CREATE OR REPLACE FUNCTION public.get_ground_screen_names(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce(jsonb_object_agg(p.id::text, p.display_name), '{}'::jsonb)
  FROM public.public_scoreboards s
  JOIN public.matches m ON m.id = s.match_id
  JOIN public.ground_screens g ON g.scoreboard_id = s.id AND g.show_names = true
  JOIN public.match_squads q ON q.match_id = m.id
  JOIN public.players p ON p.id = q.player_id
  WHERE s.slug = p_slug
    AND s.enabled = true
    AND m.visibility = 'public'
    AND (NOT p.is_junior OR public.player_allows_public_highlights(p.id));
$$;
GRANT EXECUTE ON FUNCTION public.get_ground_screen_names(text) TO anon, authenticated;

DROP FUNCTION public.set_ground_screen(uuid, text, text[], integer, text, text);

CREATE OR REPLACE FUNCTION public.set_ground_screen(
  p_match_id uuid,
  p_mode text,
  p_pages text[],
  p_interval_seconds integer,
  p_manual_page text,
  p_replays text,
  p_show_names boolean
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
  INSERT INTO public.ground_screens (scoreboard_id, match_id, mode, pages, interval_seconds, manual_page, replays, show_names, updated_by, updated_at)
  VALUES (v_board, p_match_id, p_mode, p_pages, p_interval_seconds, p_manual_page, p_replays, coalesce(p_show_names, false), (SELECT auth.uid()), now())
  ON CONFLICT (scoreboard_id) DO UPDATE
    SET mode = excluded.mode,
        pages = excluded.pages,
        interval_seconds = excluded.interval_seconds,
        manual_page = excluded.manual_page,
        replays = excluded.replays,
        show_names = excluded.show_names,
        updated_by = excluded.updated_by,
        updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.set_ground_screen(uuid, text, text[], integer, text, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_ground_screen(uuid, text, text[], integer, text, text, boolean) TO authenticated;