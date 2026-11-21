begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_table('public','camera_cloud_auto_opt_ins','per-camera cloud auto consent is recorded');
select has_column('public','camera_cloud_auto_opt_ins','adult_only_attested','adult-only attestation is explicit');
select has_column('public','camera_cloud_auto_opt_ins','opted_in_at','opt-in timestamp is stored');
select has_column('public','camera_cloud_recordings','start_source','provider job identifies manual versus match-state start');

select ok(
  (select relrowsecurity from pg_class where oid='public.camera_cloud_auto_opt_ins'::regclass),
  'cloud auto operator preferences use RLS'
);
select ok(
  not has_table_privilege('anon','public.camera_cloud_auto_opt_ins','select'),
  'anonymous users cannot read operator consent'
);
select ok(
  not has_table_privilege('anon','public.camera_cloud_auto_opt_ins','insert'),
  'anonymous users cannot enable cloud recording'
);
select ok(
  not has_table_privilege('authenticated','public.camera_cloud_auto_opt_ins','delete'),
  'operator opt-in history cannot be destroyed directly'
);
select ok(
  exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='camera_cloud_auto_opt_ins'
      and policyname='camera_auto_opt_ins_operator_insert'
  ),
  'new opt-in is constrained to its owner and paired device'
);
select ok(
  exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='camera_cloud_auto_opt_ins'
      and policyname='camera_auto_opt_ins_operator_update'
  ),
  'operator can only edit own camera preference'
);
select ok(
  exists(
    select 1 from pg_indexes
    where schemaname='public' and tablename='camera_cloud_recordings'
      and indexname='camera_cloud_once_per_match_room_device'
  ),
  'a single match cannot endlessly restart chargeable automatic egress'
);
select ok(
  not has_table_privilege('authenticated','public.camera_cloud_recordings','insert'),
  'browser users cannot pretend an automatic cloud provider job started'
);
select ok(
  not has_table_privilege('authenticated','public.camera_cloud_recordings','update'),
  'browser users cannot forge provider archival status'
);
select * from finish();
rollback;
