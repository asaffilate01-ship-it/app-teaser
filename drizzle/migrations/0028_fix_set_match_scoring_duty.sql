create or replace function public.set_match_scoring_duty(p_match_id uuid, p_user_id uuid, p_duty text, p_enabled boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare v_org uuid; v_manager boolean; v_lead boolean;
begin
  if p_duty not in ('lead','batting','bowling','video') then
    raise exception 'unknown duty' using errcode = '22023';
  end if;
  select owner_organisation_id into v_org from public.matches where id = p_match_id;
  if v_org is null then raise exception 'match not found' using errcode = 'P0002'; end if;
  v_manager := public.is_match_manager(p_match_id);
  v_lead := exists (
    select 1 from public.match_scoring_duties d
    where d.match_id = p_match_id and d.user_id = (select auth.uid()) and d.duty = 'lead'
  ) and exists (
    select 1 from public.organisation_members om
    where om.organisation_id = v_org and om.user_id = (select auth.uid()) and om.status = 'active'
  );
  -- Club admins can give any duty; a lead scorer can add helpers but never another lead.
  if not v_manager and not (v_lead and p_duty <> 'lead') then
    raise exception 'only club admins or the lead scorer can hand out scoring duties' using errcode = '42501';
  end if;
  if p_enabled then
    if not exists (
      select 1 from public.organisation_members om
      where om.organisation_id = v_org and om.user_id = p_user_id and om.status = 'active'
    ) then
      raise exception 'scorers must be active members of the club' using errcode = '23503';
    end if;
    insert into public.match_scoring_duties (match_id, user_id, duty, assigned_by)
    values (p_match_id, p_user_id, p_duty, (select auth.uid()))
    on conflict do nothing;
  else
    delete from public.match_scoring_duties
    where match_id = p_match_id and user_id = p_user_id and duty = p_duty;
  end if;
end;
$$;