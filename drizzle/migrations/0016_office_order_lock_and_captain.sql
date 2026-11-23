create or replace function public.item_order_before()
 returns trigger language plpgsql security definer set search_path to '' as $$
declare v_item public.club_items; v_manager boolean;
begin
  if tg_op = 'UPDATE' and old.status = 'collected' then
    if new.status <> old.status or new.item_id <> old.item_id or new.quantity <> old.quantity or new.player_id is distinct from old.player_id then
      raise exception 'this order was already collected and cannot be changed' using errcode = '42501';
    end if;
  end if;
  select * into v_item from public.club_items where id = new.item_id for update;
  if not found then raise exception 'item not found' using errcode = '22023'; end if;
  new.organisation_id := v_item.organisation_id;
  if new.player_id is not null and not exists (select 1 from public.players p where p.id = new.player_id and p.organisation_id = v_item.organisation_id) then
    raise exception 'that player is not in this club' using errcode = '22023';
  end if;
  v_manager := public.is_store_manager(v_item.organisation_id);
  if tg_op = 'INSERT' then
    if not v_manager and (new.status <> 'requested' or not v_item.active) then
      raise exception 'this item cannot be ordered' using errcode = '42501';
    end if;
  else
    if not v_manager and (old.status <> 'requested' or new.status <> 'cancelled' or new.item_id <> old.item_id or new.quantity <> old.quantity) then
      raise exception 'only the club can change this order now' using errcode = '42501';
    end if;
    if new.status = 'collected' and old.status <> 'collected' then
      if v_item.stock < new.quantity then
        raise exception 'not enough stock' using errcode = '53400';
      end if;
      update public.club_items set stock = stock - new.quantity where id = v_item.id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.set_selection_role(p_event_id uuid, p_player_id uuid, p_field text)
 returns void language plpgsql security invoker set search_path to '' as $$
declare n integer;
begin
  if p_field = 'captain' then
    update public.event_selections set captain = false where event_id = p_event_id and captain and player_id <> p_player_id;
    update public.event_selections set captain = true where event_id = p_event_id and player_id = p_player_id;
  elsif p_field = 'wicketkeeper' then
    update public.event_selections set wicketkeeper = false where event_id = p_event_id and wicketkeeper and player_id <> p_player_id;
    update public.event_selections set wicketkeeper = true where event_id = p_event_id and player_id = p_player_id;
  else
    raise exception 'unknown role' using errcode = '22023';
  end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'that player is not in this selection, or you cannot change it' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.set_selection_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_selection_role(uuid, uuid, text) to authenticated;