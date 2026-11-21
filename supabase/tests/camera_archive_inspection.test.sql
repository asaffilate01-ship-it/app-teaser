begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_column('public','camera_cloud_recordings','archive_check_status',
  'private object inspection state exists');
select has_column('public','camera_cloud_recordings','archive_check_attempts',
  'object inspection attempts are bounded');
select has_column('public','camera_cloud_recordings','archive_object_bytes',
  'actual S3 object byte length is recorded');
select has_column('public','camera_cloud_recordings','archive_object_etag',
  'provider ETag metadata is retained without exposing a URL');
select has_column('public','camera_cloud_recordings','archive_checked_at',
  'inspection timestamps are auditable');
select has_column('public','camera_cloud_recordings','archive_object_confirmed_at',
  'object presence confirmation is distinct from provider completion');

select ok(
  not has_table_privilege('authenticated','public.camera_cloud_recordings','UPDATE'),
  'browsers cannot fake a confirmed private archive'
);
select ok(
  not has_table_privilege('anon','public.camera_cloud_recordings','SELECT'),
  'anonymous viewers cannot enumerate S3 object checks'
);
select ok(
  (select relrowsecurity from pg_class
    where oid='public.camera_cloud_recordings'::regclass),
  'archive metadata stays behind camera provider ledger RLS'
);
select ok(
  exists(select 1 from pg_indexes
    where schemaname='public'
      and tablename='camera_cloud_recordings'
      and indexname='camera_cloud_archive_inspection_pending'),
  'only pending provider-completed jobs are eligible for bounded inspection'
);
select ok(
  exists(select 1 from pg_constraint
    where conrelid='public.camera_cloud_recordings'::regclass
      and conname='cloud_archive_confirmed_only_with_evidence'),
  'confirmed objects require evidence metadata'
);
select ok(
  has_table_privilege('service_role','public.camera_cloud_recordings','UPDATE'),
  'trusted server code can write object check evidence'
);
select ok(
  not has_table_privilege('authenticated','public.camera_cloud_recordings','INSERT'),
  'public clients cannot fabricate camera archive entries'
);
select * from finish();
rollback;
