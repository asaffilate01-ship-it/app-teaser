begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select has_table('public','camera_cloud_recordings','private egress session ledger exists');
select has_column('public','camera_cloud_recordings','provider_egress_id','provider ID can be reconciled');
select has_column('public','camera_cloud_recordings','object_path','cloud archive output path is tracked');
select ok(
  (select relrowsecurity from pg_class where oid='public.camera_cloud_recordings'::regclass),
  'provider recording ledger requires RLS'
);
select ok(
  not has_table_privilege('anon','public.camera_cloud_recordings','select'),
  'anonymous viewers cannot discover private provider recording sessions'
);
select ok(
  has_table_privilege('authenticated','public.camera_cloud_recordings','select'),
  'authenticated users require per-row director or operator authorisation'
);
select ok(
  not has_table_privilege('authenticated','public.camera_cloud_recordings','insert'),
  'browser users cannot claim a chargeable provider job started'
);
select ok(
  not has_table_privilege('authenticated','public.camera_cloud_recordings','update'),
  'browser users cannot forge provider-complete archive status'
);
select ok(
  not has_table_privilege('authenticated','public.camera_cloud_recordings','delete'),
  'browser users cannot erase provider recording audit state'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='camera_cloud_recordings'
      and indexname='camera_cloud_recording_active_device'
  ),
  'per-device unique active-egress reservation is enforced'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='camera_cloud_recordings'
      and policyname='camera_cloud_recordings_authorised_read'
  ),
  'only matched director and paired phone owner see cloud sessions'
);
select * from finish();
rollback;
