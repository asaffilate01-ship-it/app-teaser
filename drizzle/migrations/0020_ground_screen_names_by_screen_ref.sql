CREATE OR REPLACE FUNCTION public.get_ground_screen_names(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce(
    jsonb_object_agg(
      left(encode(extensions.digest(m.id::text || ':' || p.id::text, 'sha256'), 'hex'), 16),
      p.display_name
    ),
    '{}'::jsonb
  )
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