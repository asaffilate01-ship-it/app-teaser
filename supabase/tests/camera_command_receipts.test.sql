begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public', 'camera_command_receipts', 'private recording receipt ledger exists');
select has_column('public', 'camera_command_receipts', 'command_id', 'each receipt names a command');
select has_column('public', 'camera_command_receipts', 'reported_by', 'receipt identifies the phone operator');
select ok(
  (select relrowsecurity from pg_class where oid='public.camera_command_receipts'::regclass),
  'receipt table is RLS protected'
);
select ok(
  not has_table_privilege('anon','public.camera_command_receipts','SELECT'),
  'anonymous users cannot list phone confirmations'
);
select ok(
  not has_table_privilege('anon','public.camera_command_receipts','INSERT'),
  'anonymous users cannot forge phone confirmations'
);
select ok(
  has_table_privilege('authenticated','public.camera_command_receipts','INSERT'),
  'paired authenticated operators can request a receipt insert subject to RLS'
);
select ok(
  not has_table_privilege('authenticated','public.camera_command_receipts','UPDATE'),
  'receipt history cannot be edited by a browser'
);
select ok(
  not has_table_privilege('authenticated','public.camera_command_receipts','DELETE'),
  'receipt history cannot be deleted by a browser'
);
select ok(
  exists(select 1 from pg_policies
    where schemaname='public' and tablename='camera_command_receipts'
      and policyname='camera_command_receipts_operator_insert'),
  'only paired operators may append a receipt for their assigned command'
);
select ok(
  exists(select 1 from pg_constraint
    where conrelid='public.camera_command_receipts'::regclass
      and contype='p'),
  'the command id is unique, so duplicate phone confirmations cannot overwrite one another'
);
select ok(
  exists(select 1 from pg_policies
    where schemaname='public' and tablename='camera_command_receipts'
      and policyname='camera_command_receipts_read'),
  'only the paired operator or authorised director may read receipt status'
);
select * from finish();
rollback;
