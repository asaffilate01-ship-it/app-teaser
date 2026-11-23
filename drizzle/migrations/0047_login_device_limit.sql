create table public.login_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  device_key text not null check (char_length(device_key) between 16 and 80),
  label text not null default 'Device' check (char_length(label) between 1 and 80),
  first_seen_at timestamptz not null default now(),
  signed_in_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason is null or revoked_reason in ('newer_device', 'owner')),
  unique (user_id, device_key)
);
grant select on public.login_devices to authenticated;
grant all on public.login_devices to service_role;
alter table public.login_devices enable row level security;
create policy "People see their own signed-in devices" on public.login_devices
  for select to authenticated using (user_id = auth.uid());
create index login_devices_active_idx on public.login_devices (user_id, signed_in_at desc) where revoked_at is null;

-- How many devices one login may use at once. Must match deviceLimit in src/lib/device-limit.ts.
create or replace function public.login_device_limit()
 returns integer language sql immutable set search_path to '' as $$ select 2 $$;

create or replace function public.claim_login_device(p_device_key text, p_label text)
 returns jsonb language plpgsql volatile security definer set search_path to '' as $$
declare v_uid uuid := auth.uid(); v_signed_out integer := 0; v_label text;
begin
  if v_uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_device_key is null or char_length(p_device_key) not between 16 and 80 then
    raise exception 'Invalid device.' using errcode = '22023'; end if;
  v_label := left(coalesce(nullif(btrim(p_label), ''), 'Device'), 80);
  -- Serialise claims per person so two phones signing in together can't both stay in.
  perform pg_advisory_xact_lock(hashtextextended('login_devices:' || v_uid::text, 0));
  insert into public.login_devices (user_id, device_key, label)
    values (v_uid, p_device_key, v_label)
  on conflict (user_id, device_key) do update
    set label = excluded.label, signed_in_at = now(), last_seen_at = now(), revoked_at = null, revoked_reason = null;
  if not public.has_role(v_uid, 'admin') then
    with ranked as (
      select id, row_number() over (order by signed_in_at desc, id) as rn
      from public.login_devices where user_id = v_uid and revoked_at is null
    )
    update public.login_devices d set revoked_at = now(), revoked_reason = 'newer_device'
      from ranked r where d.id = r.id and r.rn > public.login_device_limit();
    get diagnostics v_signed_out = row_count;
  end if;
  return jsonb_build_object('status', 'active', 'signedOut', v_signed_out, 'limit', public.login_device_limit());
end;
$$;

create or replace function public.check_login_device(p_device_key text)
 returns text language plpgsql volatile security definer set search_path to '' as $$
declare v_uid uuid := auth.uid(); v_revoked timestamptz; v_found boolean;
begin
  if v_uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select true, revoked_at into v_found, v_revoked from public.login_devices
    where user_id = v_uid and device_key = p_device_key;
  if v_found is null then return 'unknown'; end if;
  if v_revoked is not null then return 'revoked'; end if;
  update public.login_devices set last_seen_at = now()
    where user_id = v_uid and device_key = p_device_key and last_seen_at < now() - interval '1 minute';
  return 'active';
end;
$$;

create or replace function public.sign_out_login_device(p_device_id uuid)
 returns void language plpgsql volatile security definer set search_path to '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  update public.login_devices set revoked_at = now(), revoked_reason = 'owner'
    where id = p_device_id and user_id = auth.uid() and revoked_at is null;
end;
$$;

revoke all on function public.claim_login_device(text, text) from public, anon;
revoke all on function public.check_login_device(text) from public, anon;
revoke all on function public.sign_out_login_device(uuid) from public, anon;
grant execute on function public.claim_login_device(text, text) to authenticated;
grant execute on function public.check_login_device(text) to authenticated;
grant execute on function public.sign_out_login_device(uuid) to authenticated;
grant execute on function public.login_device_limit() to authenticated, service_role;