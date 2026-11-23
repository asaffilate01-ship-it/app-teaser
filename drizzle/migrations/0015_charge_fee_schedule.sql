create or replace function public.charge_fee_schedule(p_schedule_id uuid, p_player_ids uuid[])
 returns integer language plpgsql security invoker set search_path to '' as $$
declare v public.fee_schedules; v_count integer;
begin
  select * into v from public.fee_schedules where id = p_schedule_id;
  if not found then raise exception 'fee not found' using errcode = '22023'; end if;
  if coalesce(array_length(p_player_ids, 1), 0) > 500 then raise exception 'too many players at once' using errcode = '54000'; end if;
  insert into public.fee_charges (organisation_id, schedule_id, player_id, description, amount_minor, currency, due_on)
  select v.organisation_id, v.id, p.id, v.name, v.amount_minor, v.currency, v.due_on
    from public.players p
   where p.id = any(p_player_ids) and p.organisation_id = v.organisation_id
  on conflict (schedule_id, player_id, coalesce(due_on, '1900-01-01'::date)) where schedule_id is not null do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.charge_fee_schedule(uuid, uuid[]) from public, anon;
grant execute on function public.charge_fee_schedule(uuid, uuid[]) to authenticated;