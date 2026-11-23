
CREATE OR REPLACE FUNCTION public.can_view_fixture_reports(p_fixture_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  select exists (
    select 1
    from public.fixtures f
    join public.competitions c on c.id = f.competition_id
    join public.teams ht on ht.id = f.home_team_id
    join public.teams at on at.id = f.away_team_id
    where f.id = p_fixture_id
      and (public.is_org_member(c.organisation_id) or public.is_org_member(ht.organisation_id) or public.is_org_member(at.organisation_id))
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_fixture_reports(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_view_fixture_reports(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "league and club members read result reports" ON public.fixture_result_reports;
CREATE POLICY "league and club members read result reports" ON public.fixture_result_reports FOR SELECT TO authenticated
USING (public.can_view_fixture_reports(fixture_id));
