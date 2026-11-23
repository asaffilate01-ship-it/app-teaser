CREATE TABLE public.historic_player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season text NOT NULL CHECK (char_length(btrim(season)) BETWEEN 2 AND 40),
  matches integer NOT NULL DEFAULT 0 CHECK (matches BETWEEN 0 AND 2000),
  innings integer NOT NULL DEFAULT 0 CHECK (innings BETWEEN 0 AND 2000),
  not_outs integer NOT NULL DEFAULT 0 CHECK (not_outs BETWEEN 0 AND 2000),
  runs integer NOT NULL DEFAULT 0 CHECK (runs BETWEEN 0 AND 200000),
  balls_faced integer NOT NULL DEFAULT 0 CHECK (balls_faced BETWEEN 0 AND 400000),
  high_score integer CHECK (high_score IS NULL OR high_score BETWEEN 0 AND 1000),
  fours integer NOT NULL DEFAULT 0 CHECK (fours BETWEEN 0 AND 50000),
  sixes integer NOT NULL DEFAULT 0 CHECK (sixes BETWEEN 0 AND 50000),
  balls_bowled integer NOT NULL DEFAULT 0 CHECK (balls_bowled BETWEEN 0 AND 400000),
  runs_conceded integer NOT NULL DEFAULT 0 CHECK (runs_conceded BETWEEN 0 AND 200000),
  wickets integer NOT NULL DEFAULT 0 CHECK (wickets BETWEEN 0 AND 20000),
  catches integer NOT NULL DEFAULT 0 CHECK (catches BETWEEN 0 AND 20000),
  stumpings integer NOT NULL DEFAULT 0 CHECK (stumpings BETWEEN 0 AND 20000),
  source text NOT NULL DEFAULT 'import' CHECK (char_length(source) <= 60),
  imported_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, season, source)
);
CREATE INDEX historic_player_stats_org ON public.historic_player_stats(organisation_id, season);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historic_player_stats TO authenticated;
GRANT ALL ON public.historic_player_stats TO service_role;
ALTER TABLE public.historic_player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY historic_stats_select ON public.historic_player_stats FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id) OR public.can_act_for_player(player_id));
CREATE POLICY historic_stats_insert ON public.historic_player_stats FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organisation_id, array['owner','club_admin','coach']::public.platform_role[])
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.organisation_id = historic_player_stats.organisation_id));
CREATE POLICY historic_stats_update ON public.historic_player_stats FOR UPDATE TO authenticated
  USING (public.has_org_role(organisation_id, array['owner','club_admin','coach']::public.platform_role[]))
  WITH CHECK (public.has_org_role(organisation_id, array['owner','club_admin','coach']::public.platform_role[])
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.organisation_id = historic_player_stats.organisation_id));
CREATE POLICY historic_stats_delete ON public.historic_player_stats FOR DELETE TO authenticated
  USING (public.has_org_role(organisation_id, array['owner','club_admin','coach']::public.platform_role[]));
CREATE TRIGGER audit_historic_player_stats AFTER INSERT OR UPDATE OR DELETE ON public.historic_player_stats FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('organisation_id');