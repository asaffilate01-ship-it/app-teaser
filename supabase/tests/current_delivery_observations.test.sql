begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
select ok(exists(select 1 from pg_policy where polrelid='public.criclume_analysis_notes'::regclass and polname='analysis_notes_current_delivery' and not polpermissive),'current delivery requirement is restrictive');
select ok(not has_table_privilege('authenticated','public.criclume_analysis_notes','update'),'historical observations remain immutable');
select ok(not has_table_privilege('anon','public.criclume_analysis_notes','select'),'historical review is private');
select * from finish();
rollback;
