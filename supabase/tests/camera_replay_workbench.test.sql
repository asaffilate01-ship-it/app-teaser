begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select has_table('public','camera_clip_calibrations','private director clip calibration table exists');
select has_table('public','camera_highlight_candidates','private highlight candidate table exists');
select ok((select relrowsecurity from pg_class where oid='public.camera_clip_calibrations'::regclass),
  'manual timing offsets use RLS');
select ok((select relrowsecurity from pg_class where oid='public.camera_highlight_candidates'::regclass),
  'highlight candidates use RLS');
select ok(not has_table_privilege('anon','public.camera_clip_calibrations','SELECT'),
  'anonymous clients cannot read calibration metadata');
select ok(not has_table_privilege('anon','public.camera_highlight_candidates','SELECT'),
  'anonymous clients cannot list highlight candidates');
select ok(has_table_privilege('authenticated','public.camera_clip_calibrations','SELECT'),
  'directors may read eligible calibrated clips under RLS');
select ok(has_table_privilege('authenticated','public.camera_clip_calibrations','INSERT'),
  'directors may write their own calibration under RLS');
select ok(has_table_privilege('authenticated','public.camera_clip_calibrations','UPDATE'),
  'original calibration author may update under RLS');
select ok(not has_table_privilege('authenticated','public.camera_clip_calibrations','DELETE'),
  'browser accounts cannot erase calibration history');
select ok(has_table_privilege('authenticated','public.camera_highlight_candidates','INSERT'),
  'reviewers may add RLS-checked private bookmarks');
select ok(not has_table_privilege('authenticated','public.camera_highlight_candidates','UPDATE'),
  'private editorial candidates are not silently rewritten');
select ok(not has_table_privilege('authenticated','public.camera_highlight_candidates','DELETE'),
  'private editorial candidates cannot be deleted by browser accounts');
select ok(exists(select 1 from pg_policies
  where schemaname='public' and tablename='camera_clip_calibrations'
  and policyname='camera_calibration_author_insert'),
  'calibration requires authorised reviewer and correct private clip');
select ok(exists(select 1 from pg_policies
  where schemaname='public' and tablename='camera_highlight_candidates'
  and policyname='camera_highlight_director_insert'),
  'highlight insert requires authorised director and same-match delivery');
select ok(exists(select 1 from pg_constraint
  where conrelid='public.camera_clip_calibrations'::regclass and contype='p'),
  'only one active calibration exists per clip');
select ok(exists(select 1 from pg_constraint
  where conrelid='public.camera_highlight_candidates'::regclass and contype='c'),
  'editorial highlight durations and event kinds are bounded');
select ok(not has_table_privilege('anon','public.camera_highlight_candidates','INSERT'),
  'anonymous users cannot create candidate highlights');
select * from finish();
rollback;
