DROP POLICY IF EXISTS analysis_files_read ON public.criclume_analysis_files;
CREATE POLICY analysis_files_read ON public.criclume_analysis_files
FOR SELECT TO authenticated
USING (
  retention_expires_at > now()
  AND (
    public.has_org_role(organisation_id, ARRAY['owner','safeguarding_officer']::public.platform_role[])
    OR (NOT includes_junior AND public.has_org_role(organisation_id, ARRAY['club_admin','league_admin','coach']::public.platform_role[]))
    OR (created_by = (SELECT auth.uid()) AND public.has_org_role(organisation_id, ARRAY['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[]))
  )
);

DROP POLICY IF EXISTS analysis_object_read ON storage.objects;
CREATE POLICY analysis_object_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'criclume-evidence'
  AND EXISTS (
    SELECT 1 FROM public.criclume_analysis_files f
    WHERE f.storage_path = objects.name
      AND f.retention_expires_at > now()
      AND (
        public.has_org_role(f.organisation_id, ARRAY['owner','safeguarding_officer']::public.platform_role[])
        OR (NOT f.includes_junior AND public.has_org_role(f.organisation_id, ARRAY['club_admin','league_admin','coach']::public.platform_role[]))
        OR (f.created_by = (SELECT auth.uid()) AND public.has_org_role(f.organisation_id, ARRAY['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[]))
      )
  )
);

DROP POLICY IF EXISTS analysis_object_delete ON storage.objects;
CREATE POLICY analysis_object_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'criclume-evidence'
  AND EXISTS (
    SELECT 1 FROM public.criclume_analysis_files f
    WHERE f.storage_path = objects.name
      AND f.created_by = (SELECT auth.uid())
      AND public.has_org_role(f.organisation_id, ARRAY['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[])
  )
);

DROP POLICY IF EXISTS analysis_object_insert ON storage.objects;
CREATE POLICY analysis_object_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'criclume-evidence'
  AND EXISTS (
    SELECT 1 FROM public.criclume_analysis_files f
    WHERE f.storage_path = objects.name
      AND f.created_by = (SELECT auth.uid())
      AND public.has_org_role(f.organisation_id, ARRAY['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[])
  )
);