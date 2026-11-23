alter table public.camera_devices add column if not exists removed_at timestamptz;

create or replace function public.pair_camera_device(p_token text, p_device_key text, p_label text, p_angle text)
 returns public.camera_devices
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_pairing public.camera_pairing_tokens;
  v_device public.camera_devices;
  v_room public.camera_rooms;
  v_existing boolean;
  v_active integer;
begin
  if (select auth.uid()) is null then
    raise exception 'sign in before pairing a camera' using errcode = '42501';
  end if;
  select * into v_pairing from public.camera_pairing_tokens
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and expires_at > now()
    and uses_remaining > 0
  for update;
  if not found then raise exception 'pairing token is invalid or expired' using errcode = '22023'; end if;

  -- Lock the room so two phones joining at once cannot both take the last place.
  select * into v_room from public.camera_rooms where id = v_pairing.room_id for update;
  select exists (
    select 1 from public.camera_devices d
    where d.room_id = v_pairing.room_id and d.device_key = left(p_device_key, 200) and d.removed_at is null
  ) into v_existing;
  if not v_existing then
    select count(*) into v_active from public.camera_devices d where d.room_id = v_pairing.room_id and d.removed_at is null;
    if v_active >= v_room.max_devices then
      raise exception 'this camera room is full (% of % phones). Remove a phone or raise the limit.', v_active, v_room.max_devices using errcode = '53400';
    end if;
  end if;

  insert into public.camera_devices (room_id, user_id, device_key, label, angle)
  values (v_pairing.room_id, (select auth.uid()), left(p_device_key, 200), left(p_label, 100), p_angle)
  on conflict (room_id, device_key) do update
    set user_id = excluded.user_id, label = excluded.label, angle = excluded.angle, last_heartbeat_at = now(), removed_at = null
  returning * into v_device;
  insert into public.match_assignments (match_id, user_id, role, assigned_by)
  select r.match_id, (select auth.uid()), 'viewer', v_pairing.created_by
  from public.camera_rooms r where r.id = v_pairing.room_id
  on conflict (match_id, user_id, role) do nothing;
  -- Re-pairing the same phone does not use up a place.
  if not v_existing then
    update public.camera_pairing_tokens set uses_remaining = uses_remaining - 1 where id = v_pairing.id;
  end if;
  return v_device;
end;
$function$;

create or replace function public.set_camera_room_capacity(p_room_id uuid, p_max_devices integer)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_active integer;
begin
  if not public.can_direct_camera_room(p_room_id) then
    raise exception 'not allowed to change this camera room' using errcode = '42501';
  end if;
  if p_max_devices is null or p_max_devices < 1 or p_max_devices > 8 then
    raise exception 'a camera room holds 1 to 8 phones' using errcode = '22023';
  end if;
  select count(*) into v_active from public.camera_devices where room_id = p_room_id and removed_at is null;
  if p_max_devices < v_active then
    raise exception 'remove % phone(s) first', v_active - p_max_devices using errcode = '22023';
  end if;
  update public.camera_rooms set max_devices = p_max_devices where id = p_room_id;
  update public.camera_pairing_tokens
    set uses_remaining = p_max_devices - v_active
    where room_id = p_room_id and expires_at > now();
  return p_max_devices;
end;
$function$;
revoke all on function public.set_camera_room_capacity(uuid, integer) from public, anon;
grant execute on function public.set_camera_room_capacity(uuid, integer) to authenticated;

create or replace function public.remove_camera_device(p_device_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_room uuid;
begin
  select room_id into v_room from public.camera_devices where id = p_device_id;
  if v_room is null or not public.can_direct_camera_room(v_room) then
    raise exception 'not allowed to remove this phone' using errcode = '42501';
  end if;
  update public.camera_devices set removed_at = now() where id = p_device_id;
end;
$function$;
revoke all on function public.remove_camera_device(uuid) from public, anon;
grant execute on function public.remove_camera_device(uuid) to authenticated;