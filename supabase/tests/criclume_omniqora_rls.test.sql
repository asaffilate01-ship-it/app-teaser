begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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

select * from finish();
rollback;
