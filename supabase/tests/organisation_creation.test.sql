begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
select has_column('public','organisations','creation_request_id','organisation requests can be replayed');
select ok(not has_function_privilege('anon','public.create_organisation_once(uuid,text,public.organisation_kind)','execute'),'anonymous creation denied');
select ok(has_function_privilege('authenticated','public.create_organisation_once(uuid,text,public.organisation_kind)','execute'),'authenticated creation available');
select ok(not (select prosecdef from pg_proc where oid='public.create_organisation_once(uuid,text,public.organisation_kind)'::regprocedure),'creation runs with caller RLS');
select * from finish();
rollback;
