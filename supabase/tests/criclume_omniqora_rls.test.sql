begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select has_table('public', 'criclume_omniqora_links', 'CricLume tenant binding is present');
select has_table('public', 'criclume_omniqora_runs', 'CricLume AI run ledger is present');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.criclume_omniqora_links'::regclass),
  'tenant bindings require RLS'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.criclume_omniqora_runs'::regclass),
  'AI run ledger requires RLS'
);
select ok(
  not has_table_privilege('anon', 'public.criclume_omniqora_links', 'SELECT'),
  'anonymous users cannot inspect tenant bindings'
);
select ok(
  not has_table_privilege('authenticated', 'public.criclume_omniqora_links', 'SELECT'),
  'club members cannot inspect external tenant bindings'
);
select ok(
  not has_table_privilege('anon', 'public.criclume_omniqora_runs', 'SELECT'),
  'anonymous users cannot read AI request history'
);
select ok(
  not has_table_privilege('authenticated', 'public.criclume_omniqora_runs', 'SELECT'),
  'club members must use the role-checked gateway to read AI history'
);
select ok(
  not has_table_privilege('authenticated', 'public.criclume_omniqora_links', 'INSERT'),
  'browser clients cannot activate the Omniqora tenant link'
);
select ok(
  not has_table_privilege('authenticated', 'public.criclume_omniqora_runs', 'INSERT'),
  'browser clients cannot fabricate paid AI requests'
);
select ok(
  has_table_privilege('service_role', 'public.criclume_omniqora_links', 'SELECT'),
  'the server-side service role can read approved mappings'
);
select ok(
  has_table_privilege('service_role', 'public.criclume_omniqora_runs', 'INSERT'),
  'the server-side service role can record an approved AI request'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_criclume_omniqora_run(uuid,uuid,uuid,text,timestamptz,uuid)',
    'EXECUTE'
  ),
  'anonymous users cannot reserve Omniqora AI requests'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_criclume_omniqora_run(uuid,uuid,uuid,text,timestamptz,uuid)',
    'EXECUTE'
  ),
  'browser sessions cannot bypass the role-gated Edge Function'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.claim_criclume_omniqora_run(uuid,uuid,uuid,text,timestamptz,uuid)',
    'EXECUTE'
  ),
  'the reviewed service-role caller can claim the atomic request'
);
select ok(
  (select not prosecdef from pg_proc
   where oid = to_regprocedure(
     'public.claim_criclume_omniqora_run(uuid,uuid,uuid,text,timestamptz,uuid)'
   )),
  'the quota and dedupe RPC runs with invoker permissions'
);

select * from finish();
rollback;
