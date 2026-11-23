CREATE OR REPLACE FUNCTION public.league_member_players(p_league uuid, p_club uuid)
 RETURNS TABLE(id uuid, display_name text, is_junior boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select p.id, p.display_name, p.is_junior from public.players p
  where p.organisation_id = p_club
    and public.has_org_role(p_league, array['owner','league_admin']::public.platform_role[])
    and exists (select 1 from public.league_memberships lm where lm.league_id = p_league and lm.club_id = p_club and lm.status = 'approved')
  order by p.display_name
  limit 500;
$function$;
REVOKE ALL ON FUNCTION public.league_member_players(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.league_member_players(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fixture_umpires_for_marks(p_fixture uuid)
 RETURNS TABLE(umpire_id uuid, display_name text, "position" text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select u.id, u.display_name, a.position from public.umpire_appointments a
  join public.umpires u on u.id = a.umpire_id
  join public.fixtures f on f.id = a.fixture_id
  where a.fixture_id = p_fixture and a.status in ('accepted','completed')
    and exists (select 1 from public.teams t where t.id in (f.home_team_id, f.away_team_id)
      and public.has_org_role(t.organisation_id, array['owner','club_admin','team_manager','coach']::public.platform_role[]));
$function$;
REVOKE ALL ON FUNCTION public.fixture_umpires_for_marks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fixture_umpires_for_marks(uuid) TO authenticated;