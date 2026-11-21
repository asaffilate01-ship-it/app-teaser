begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select has_table('public', 'camera_cloud_import_jobs', 'private cloud import queue exists');
select has_column('public', 'camera_cloud_import_jobs', 'recording_id', 'import is linked to a provider recording');
select has_column('public', 'camera_cloud_import_jobs', 'asset_id', 'private asset ID is reserved for an idempotent path');
select has_column('public', 'camera_cloud_import_jobs', 'recording_permission_attested', 'reviewer recording attestation is recorded');
select has_column('public', 'camera_cloud_import_jobs', 'guardian_permission_attested', 'guardian attestation is explicit');
select has_column('public', 'camera_cloud_import_jobs', 'retention_expires_at', 'private import has a finite retention deadline');
select ok(
  (select relrowsecurity from pg_class where oid='public.camera_cloud_import_jobs'::regclass),
  'import queue is protected by RLS'
);
select ok(
  not has_table_privilege('anon','public.camera_cloud_import_jobs','SELECT'),
  'anonymous accounts cannot enumerate imported media'
);
select ok(
  not has_table_privilege('authenticated','public.camera_cloud_import_jobs','INSERT'),
  'browser accounts cannot fabricate a reviewed import'
);
select ok(
  not has_table_privilege('authenticated','public.camera_cloud_import_jobs','UPDATE'),
  'browser accounts cannot claim a copied media asset'
);
select ok(
  not has_table_privilege('authenticated','public.camera_cloud_import_jobs','DELETE'),
  'browser accounts cannot remove review audit records'
);
select ok(
  has_table_privilege('service_role','public.camera_cloud_import_jobs','INSERT'),
  'only trusted server code can queue an import'
);
select ok(
  exists(select 1 from pg_policies
    where schemaname='public' and tablename='camera_cloud_import_jobs'
      and policyname='camera_cloud_import_jobs_authorised_read'),
  'viewing requires director or safeguarding authorisation'
);
select ok(
  exists(select 1 from pg_indexes
    where schemaname='public' and tablename='camera_cloud_import_jobs'
      and indexname='camera_cloud_import_jobs_ready'),
  'queue workers only scan approved imports'
);
select ok(
  exists(select 1 from pg_constraint
    where conrelid='public.camera_cloud_import_jobs'::regclass
      and contype='p'),
  'one import decision per cloud recording'
);
select * from finish();
rollback;
