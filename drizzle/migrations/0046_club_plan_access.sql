create or replace function public.club_plan_access(p_org uuid)
 returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_plan text := 'starter'; v_video boolean := false;
begin
  if not public.is_org_member(p_org) then raise exception 'You are not a member of this club.' using errcode = '42501'; end if;
  select case when s.status in ('active','trialing') and s.plan in ('club','league') then s.plan else 'starter' end,
         s.status in ('active','trialing') and s.plan in ('club','league') and coalesce(s.entitlements ->> 'videoAddon', 'false') = 'true'
    into v_plan, v_video
    from public.subscriptions s where s.organisation_id = p_org;
  return jsonb_build_object('plan', coalesce(v_plan, 'starter'), 'videoAddon', coalesce(v_video, false));
end;
$$;
revoke all on function public.club_plan_access(uuid) from public, anon;
grant execute on function public.club_plan_access(uuid) to authenticated, service_role;