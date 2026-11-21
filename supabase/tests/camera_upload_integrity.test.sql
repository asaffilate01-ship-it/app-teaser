begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

select has_function('public', 'complete_camera_asset_upload',
  array['uuid','text'], 'scoped paired-device finalisation RPC exists');

select ok(
  not has_function_privilege('anon', 'public.complete_camera_asset_upload(uuid,text)', 'execute'),
  'anonymous camera uploads cannot be finalised'
);
select ok(
  has_function_privilege('authenticated', 'public.complete_camera_asset_upload(uuid,text)', 'execute'),
  'signed-in paired operators can request safe finalisation'
);
select ok(
  (select prosecdef from pg_proc
    where oid = 'public.complete_camera_asset_upload(uuid,text)'::regprocedure),
  'privileged media completion validates the caller internally'
);
select ok(
  exists(select 1 from pg_policies
    where schemaname = 'public' and tablename = 'video_assets'
      and policyname = 'video_assets_capture_insert'),
  'camera asset insertion has scoped RLS'
);
select ok(
  exists(select 1 from pg_policies
    where schemaname = 'public' and tablename = 'video_assets'
      and policyname = 'video_assets_member_select'),
  'paired operators can read only their own camera assets'
);
select ok(
  not has_table_privilege('anon', 'public.video_assets', 'insert'),
  'anonymous uploads cannot create asset metadata'
);
select throws_ok(
  $$select public.complete_camera_asset_upload(
    '00000000-0000-0000-0000-000000000001'::uuid,
    'unknown/unknown/unknown/source.webm'
  )$$,
  '42501',
  'Sign in as the paired camera operator',
  'unauthenticated calls are rejected before reading private assets'
);

select * from finish();
rollback;
