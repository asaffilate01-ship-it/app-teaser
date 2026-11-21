begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_function('public', 'can_review_camera_asset', array['uuid'],
  'private video reviewer check exists');
select has_function('public', 'can_upload_camera_source', array['text'],
  'canonical source upload check exists');
select has_function('public', 'can_read_camera_storage_path', array['text'],
  'per-object source/variant access check exists');

select ok(
  not has_function_privilege('anon', 'public.can_review_camera_asset(uuid)', 'execute'),
  'anonymous users cannot call private video reviewer check'
);
select ok(
  not has_function_privilege('anon', 'public.can_read_camera_storage_path(text)', 'execute'),
  'anonymous users cannot sign private camera object paths'
);
select ok(
  has_function_privilege('authenticated', 'public.can_read_camera_storage_path(text)', 'execute'),
  'authenticated readers must pass server-side asset checks'
);

select ok(
  not has_table_privilege('authenticated', 'public.video_assets', 'update'),
  'ordinary users cannot change recording consent, retention or organisation'
);
select ok(
  not has_table_privilege('authenticated', 'public.video_variants', 'insert'),
  'ordinary users cannot forge processed video variants'
);
select ok(
  not has_table_privilege('authenticated', 'public.video_variants', 'update'),
  'ordinary users cannot turn unreviewed files into ready variants'
);
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'match_video_member_read'
  ),
  'broad organisation-membership access to raw video has been removed'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'match_video_authorised_read'
  ),
  'only verified video object paths are exposed'
);
select ok(
  not public.can_read_camera_storage_path('random/forged/source.webm'),
  'unknown private media is never accessible'
);
select ok(
  not public.can_upload_camera_source('bogus/other/asset/processed/blurred.mp4'),
  'a forged derivative is not an allowed source upload'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.video_assets'::regclass),
  'video records remain protected by row-level security'
);

select * from finish();
rollback;
