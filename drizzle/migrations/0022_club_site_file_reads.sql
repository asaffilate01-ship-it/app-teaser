
CREATE OR REPLACE FUNCTION public.club_site_file_public(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  select exists (
    select 1 from public.club_sites s
    where s.organisation_id = public.club_site_path_org(p_name)
      and s.published
      and (s.hero_path = p_name
        or exists (select 1 from public.club_site_photos ph where ph.organisation_id = s.organisation_id and ph.path = p_name)
        or exists (select 1 from public.club_site_posts p where p.organisation_id = s.organisation_id and p.file_path = p_name
                   and p.published_at is not null and p.published_at <= now()))
  );
$$;
REVOKE ALL ON FUNCTION public.club_site_file_public(text) FROM public;
GRANT EXECUTE ON FUNCTION public.club_site_file_public(text) TO anon, authenticated, service_role;

CREATE POLICY "published club site files are public" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'club-site' AND public.club_site_file_public(name));
CREATE POLICY "members read own club site files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'club-site' AND public.is_org_member(public.club_site_path_org(name)));
