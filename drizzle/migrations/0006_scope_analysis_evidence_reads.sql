DROP POLICY IF EXISTS analysis_object_read ON storage.objects;
CREATE POLICY analysis_object_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'criclume-evidence'
  AND EXISTS (
    SELECT 1
    FROM public.criclume_analysis_files f
    WHERE f.storage_path = storage.objects.name
      AND f.retention_expires_at > now()
      AND public.has_org_role(
        f.organisation_id,
        ARRAY['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[]
      )
  )
);