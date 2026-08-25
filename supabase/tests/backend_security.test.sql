begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select has_table('public', 'organisations', 'organisations table exists');
select has_table('public', 'organisation_members', 'organisation memberships table exists');
select has_table('public', 'matches', 'matches table exists');
select has_table('public', 'match_events', 'immutable match event table exists');
select has_table('public', 'video_assets', 'private video asset table exists');
select has_table('public', 'player_consents', 'player consent table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.organisations'::regclass),
  'organisations uses row-level security'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.organisation_members'::regclass),
  'organisation memberships use row-level security'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.matches'::regclass),
  'matches use row-level security'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.match_events'::regclass),
  'match events use row-level security'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.video_assets'::regclass),
  'video assets use row-level security'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.player_private_profiles'::regclass),
  'private player profiles use row-level security'
);

select ok(
  not has_function_privilege('anon', 'public.record_delivery_v2(uuid,uuid,uuid,text,jsonb,jsonb,jsonb,timestamptz)', 'EXECUTE'),
  'anonymous users cannot record deliveries'
);
select ok(
  not has_function_privilege('anon', 'public.create_match_workspace(uuid,uuid,uuid,uuid,uuid,timestamptz,public.match_visibility,uuid,integer,integer,integer,jsonb,text)', 'EXECUTE'),
  'anonymous users cannot create matches'
);
select ok(
  not has_function_privilege('anon', 'public.record_player_consent_decision(uuid,uuid,public.consent_state,public.consent_state,public.consent_state,public.consent_state,text)', 'EXECUTE'),
  'anonymous users cannot record safeguarding decisions'
);
select ok(
  has_function_privilege('anon', 'public.get_public_scoreboard(text)', 'EXECUTE'),
  'anonymous users can call only the safe public scoreboard RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.record_delivery_v2(uuid,uuid,uuid,text,jsonb,jsonb,jsonb,timestamptz)', 'EXECUTE'),
  'authenticated scorers can reach the delivery RPC before RLS checks'
);
select ok(
  not has_table_privilege('anon', 'public.matches', 'SELECT'),
  'anonymous users have no direct match-table access'
);

select * from finish();

rollback;
