ALTER TABLE public.camera_rooms DROP CONSTRAINT camera_rooms_max_devices_check;
ALTER TABLE public.camera_rooms ADD CONSTRAINT camera_rooms_max_devices_check CHECK (max_devices BETWEEN 1 AND 16);

CREATE OR REPLACE FUNCTION public.set_camera_room_capacity(p_room_id uuid, p_max_devices integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_active integer;
begin
  if not public.can_direct_camera_room(p_room_id) then
    raise exception 'not allowed to change this camera room' using errcode = '42501';
  end if;
  if p_max_devices is null or p_max_devices < 1 or p_max_devices > 16 then
    raise exception 'a camera room holds 1 to 16 phones' using errcode = '22023';
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