create table public.match_check_scorers (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  added_by uuid not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirm_note text check (confirm_note is null or char_length(confirm_note) <= 500),
  primary key (match_id, user_id)
);
grant select on public.match_check_scorers to authenticated;
grant all on public.match_check_scorers to service_role;
alter table public.match_check_scorers enable row level security;

create table public.match_check_flags (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete set null,
  innings_number integer,
  ball_label text check (ball_label is null or char_length(ball_label) <= 12),
  note text not null check (char_length(trim(note)) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'fixed', 'kept')),
  raised_by uuid not null,
  raised_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz,
  reply text check (reply is null or char_length(reply) <= 500)
);
create index match_check_flags_match_idx on public.match_check_flags (match_id, raised_at);
grant select on public.match_check_flags to authenticated;
grant all on public.match_check_flags to service_role;
alter table public.match_check_flags enable row level security;

create or replace function public.is_check_scorer(p_match_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.match_check_scorers c
    where c.match_id = p_match_id and c.user_id = (select auth.uid())
  );
$$;

create or replace function public.match_away_organisation(p_match_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select t.organisation_id from public.matches m join public.teams t on t.id = m.away_team_id where m.id = p_match_id;
$$;

create or replace function public.is_home_scoring_side(p_match_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_match_manager(p_match_id) or public.has_match_duty(p_match_id, array['lead','batting','bowling']);
$$;

create or replace function public.can_name_check_scorer(p_match_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_org_role(public.match_away_organisation(p_match_id), array['owner','league_admin','club_admin','team_manager']::public.platform_role[])
    or public.is_match_manager(p_match_id)
    or public.has_match_duty(p_match_id, array['lead']);
$$;

create policy match_check_scorers_select on public.match_check_scorers for select to authenticated
  using (user_id = (select auth.uid()) or public.can_name_check_scorer(match_id) or public.is_home_scoring_side(match_id));

create policy match_check_flags_select on public.match_check_flags for select to authenticated
  using (public.is_check_scorer(match_id) or public.is_home_scoring_side(match_id) or public.can_name_check_scorer(match_id));

create or replace function public.my_match_duties(p_match_id uuid)
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_duties text[];
begin
  if v_uid is null then return array[]::text[]; end if;
  if exists (select 1 from public.match_check_scorers c where c.match_id = p_match_id and c.user_id = v_uid) then
    return array[]::text[];
  end if;
  select owner_organisation_id into v_org from public.matches where id = p_match_id;
  if v_org is null then return array[]::text[]; end if;
  if public.has_org_role(v_org, array['owner','league_admin','club_admin']::public.platform_role[]) then
    return array['lead','batting','bowling','video'];
  end if;
  if not exists (
    select 1 from public.organisation_members om
    where om.organisation_id = v_org and om.user_id = v_uid and om.status = 'active'
  ) then
    return array[]::text[];
  end if;
  select coalesce(array_agg(d.duty order by d.duty), array[]::text[]) into v_duties
  from public.match_scoring_duties d where d.match_id = p_match_id and d.user_id = v_uid;
  if exists (
    select 1 from public.match_assignments a
    where a.match_id = p_match_id and a.user_id = v_uid and a.role = 'scorer'
  ) then
    v_duties := v_duties || array['lead'];
  end if;
  if cardinality(v_duties) = 0
    and public.has_org_role(v_org, array['scorer']::public.platform_role[])
    and not exists (select 1 from public.match_scoring_duties d where d.match_id = p_match_id)
  then
    v_duties := array['lead'];
  end if;
  if 'lead' = any(v_duties) then
    return array['lead','batting','bowling','video'];
  end if;
  return v_duties;
end;
$$;

create or replace function public.add_match_check_scorer(p_match_id uuid, p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_away uuid;
  v_owner uuid;
  v_status public.match_status;
  v_user uuid;
begin
  if v_uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select m.owner_organisation_id, m.status into v_owner, v_status from public.matches m where m.id = p_match_id;
  if v_owner is null then raise exception 'match not found' using errcode = 'P0002'; end if;
  if not public.can_name_check_scorer(p_match_id) then
    raise exception 'only the away club''s admins or team managers, or the host''s admins or lead scorer, can name a check scorer' using errcode = '42501';
  end if;
  if v_status in ('abandoned', 'cancelled') then raise exception 'this match is closed' using errcode = '22023'; end if;
  v_away := public.match_away_organisation(p_match_id);
  select u.id into v_user from auth.users u
   where lower(u.email) = lower(trim(p_email)) and u.email_confirmed_at is not null limit 1;
  if v_user is null then raise exception 'no CricLume account with that email' using errcode = 'P0002'; end if;
  if not exists (
    select 1 from public.organisation_members om
    where om.organisation_id = v_away and om.user_id = v_user and om.status = 'active'
  ) then
    raise exception 'the check scorer must be an active member of the away club' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.organisation_members om
    where om.organisation_id = v_owner and om.user_id = v_user and om.status = 'active'
      and om.role in ('owner', 'league_admin', 'club_admin')
  ) or exists (
    select 1 from public.match_scoring_duties d where d.match_id = p_match_id and d.user_id = v_user
  ) or exists (
    select 1 from public.match_assignments a where a.match_id = p_match_id and a.user_id = v_user and a.role = 'scorer'
  ) then
    raise exception 'that person already scores this match, so they can''t also check it' using errcode = '22023';
  end if;
  if (select count(*) from public.match_check_scorers c where c.match_id = p_match_id and c.user_id <> v_user) >= 2 then
    raise exception 'a match can have at most two check scorers' using errcode = '22023';
  end if;
  insert into public.match_check_scorers (match_id, user_id, organisation_id, added_by)
  values (p_match_id, v_user, v_away, v_uid)
  on conflict (match_id, user_id) do nothing;
  return v_user;
end;
$$;

create or replace function public.remove_match_check_scorer(p_match_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_user_id <> (select auth.uid()) and not public.can_name_check_scorer(p_match_id) then
    raise exception 'your role doesn''t allow that' using errcode = '42501';
  end if;
  delete from public.match_check_scorers where match_id = p_match_id and user_id = p_user_id;
end;
$$;

create or replace function public.raise_check_flag(p_match_id uuid, p_delivery_id uuid, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_innings integer;
  v_label text;
begin
  if not public.is_check_scorer(p_match_id) then
    raise exception 'only this match''s check scorer can raise a query' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_note, ''))) < 3 then raise exception 'say what looks wrong' using errcode = '22023'; end if;
  if (select count(*) from public.match_check_flags f where f.match_id = p_match_id and f.status = 'open') >= 50 then
    raise exception 'too many open queries — wait for the scorer to answer some' using errcode = '22023';
  end if;
  if p_delivery_id is not null then
    select i.innings_number, d.over_number::text || '.' || d.ball_in_over::text
      into v_innings, v_label
      from public.deliveries d join public.innings i on i.id = d.innings_id
     where d.id = p_delivery_id and d.match_id = p_match_id;
    if v_label is null then raise exception 'that ball isn''t part of this match' using errcode = '22023'; end if;
  end if;
  insert into public.match_check_flags (match_id, delivery_id, innings_number, ball_label, note, raised_by)
  values (p_match_id, p_delivery_id, v_innings, v_label, trim(p_note), (select auth.uid()))
  returning id into v_id;
  update public.match_check_scorers set confirmed_at = null, confirm_note = null where match_id = p_match_id;
  return v_id;
end;
$$;

create or replace function public.resolve_check_flag(p_flag_id uuid, p_status text, p_reply text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_match uuid;
begin
  select match_id into v_match from public.match_check_flags where id = p_flag_id;
  if v_match is null then raise exception 'query not found' using errcode = 'P0002'; end if;
  if not public.is_home_scoring_side(v_match) then
    raise exception 'only the match''s scorers or the host club''s admins can answer a query' using errcode = '42501';
  end if;
  if p_status not in ('fixed', 'kept') then raise exception 'choose fixed or kept' using errcode = '22023'; end if;
  update public.match_check_flags
     set status = p_status, reply = nullif(trim(coalesce(p_reply, '')), ''), resolved_by = (select auth.uid()), resolved_at = now()
   where id = p_flag_id and status = 'open';
end;
$$;

create or replace function public.confirm_check_scorecard(p_match_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_check_scorer(p_match_id) then
    raise exception 'only this match''s check scorer can confirm' using errcode = '42501';
  end if;
  if exists (select 1 from public.match_check_flags f where f.match_id = p_match_id and f.status = 'open') then
    raise exception 'there are still open queries on this scorecard' using errcode = '22023';
  end if;
  update public.match_check_scorers
     set confirmed_at = now(), confirm_note = nullif(trim(coalesce(p_note, '')), '')
   where match_id = p_match_id and user_id = (select auth.uid());
end;
$$;

create or replace function public.check_scoring_view(p_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if not (public.is_check_scorer(p_match_id) or public.is_home_scoring_side(p_match_id) or public.can_name_check_scorer(p_match_id)) then
    raise exception 'you are not checking this match' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'match', (select jsonb_build_object(
        'id', m.id, 'status', m.status, 'scheduled_at', m.scheduled_at, 'completed_at', m.completed_at,
        'home', ht.name, 'away', at.name, 'home_team_id', m.home_team_id, 'away_team_id', m.away_team_id)
      from public.matches m join public.teams ht on ht.id = m.home_team_id join public.teams at on at.id = m.away_team_id
      where m.id = p_match_id),
    'innings', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'number', i.innings_number, 'batting_team_id', i.batting_team_id,
        'runs', i.runs, 'wickets', i.wickets, 'legal_balls', i.legal_balls, 'target', i.target, 'status', i.status)
        order by i.innings_number) from public.innings i where i.match_id = p_match_id), '[]'::jsonb),
    'balls', coalesce((select jsonb_agg(jsonb_build_object(
        'id', d.id, 'innings_id', d.innings_id, 'sequence', d.sequence, 'over', d.over_number, 'ball', d.ball_in_over,
        'outcome', d.outcome, 'batter_runs', d.batter_runs, 'extras', d.extras, 'total_runs', d.total_runs,
        'legal', d.legal_ball, 'wicket', d.wicket, 'dismissal', d.dismissal,
        'striker', case when ps.id is null then null when ps.is_junior then
            upper(left(ps.display_name, 1)) || '. ' || upper(left(split_part(ps.display_name, ' ', 2), 1)) else ps.display_name end,
        'bowler', case when pb.id is null then null when pb.is_junior then
            upper(left(pb.display_name, 1)) || '. ' || upper(left(split_part(pb.display_name, ' ', 2), 1)) else pb.display_name end)
        order by d.sequence)
      from public.deliveries d
      left join public.players ps on ps.id = d.striker_id
      left join public.players pb on pb.id = d.bowler_id
      where d.match_id = p_match_id and d.superseded_by is null and d.voided_by_event_id is null), '[]'::jsonb),
    'flags', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.id, 'delivery_id', f.delivery_id, 'innings_number', f.innings_number, 'ball_label', f.ball_label,
        'note', f.note, 'status', f.status, 'raised_at', f.raised_at, 'reply', f.reply, 'resolved_at', f.resolved_at)
        order by f.raised_at desc) from public.match_check_flags f where f.match_id = p_match_id), '[]'::jsonb),
    'checkers', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', c.user_id, 'name', coalesce(nullif(trim(p.display_name), ''), 'Away scorer'),
        'confirmed_at', c.confirmed_at, 'confirm_note', c.confirm_note) order by c.created_at)
      from public.match_check_scorers c left join public.profiles p on p.id = c.user_id
      where c.match_id = p_match_id), '[]'::jsonb),
    'me', jsonb_build_object(
      'checker', public.is_check_scorer(p_match_id),
      'home', public.is_home_scoring_side(p_match_id),
      'can_name', public.can_name_check_scorer(p_match_id))
  ) into v;
  return v;
end;
$$;

create or replace function public.list_my_check_matches()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.when_at desc nulls last), '[]'::jsonb) from (
    select m.id as match_id, ht.name as home, at.name as away, m.status, coalesce(m.started_at, m.scheduled_at, m.created_at) as when_at,
      exists (select 1 from public.match_check_scorers c where c.match_id = m.id and c.user_id = (select auth.uid())) as checker,
      (select count(*) from public.match_check_flags f where f.match_id = m.id and f.status = 'open') as open_flags,
      (select count(*) from public.match_check_scorers c where c.match_id = m.id) as checkers,
      coalesce((select bool_or(c.confirmed_at is not null) from public.match_check_scorers c where c.match_id = m.id), false) as confirmed
    from public.matches m
    join public.teams ht on ht.id = m.home_team_id
    join public.teams at on at.id = m.away_team_id
    where (select auth.uid()) is not null
      and m.status not in ('cancelled')
      and (
        exists (select 1 from public.match_check_scorers c where c.match_id = m.id and c.user_id = (select auth.uid()))
        or (
          at.organisation_id <> m.owner_organisation_id
          and public.has_org_role(at.organisation_id, array['owner','league_admin','club_admin','team_manager']::public.platform_role[])
          and coalesce(m.started_at, m.scheduled_at, m.created_at) > now() - interval '30 days'
        )
      )
    limit 100
  ) x;
$$;

revoke execute on function public.is_check_scorer(uuid), public.match_away_organisation(uuid), public.is_home_scoring_side(uuid),
  public.can_name_check_scorer(uuid), public.add_match_check_scorer(uuid, text), public.remove_match_check_scorer(uuid, uuid),
  public.raise_check_flag(uuid, uuid, text), public.resolve_check_flag(uuid, text, text), public.confirm_check_scorecard(uuid, text),
  public.check_scoring_view(uuid), public.list_my_check_matches() from public, anon;
grant execute on function public.is_check_scorer(uuid), public.match_away_organisation(uuid), public.is_home_scoring_side(uuid),
  public.can_name_check_scorer(uuid), public.add_match_check_scorer(uuid, text), public.remove_match_check_scorer(uuid, uuid),
  public.raise_check_flag(uuid, uuid, text), public.resolve_check_flag(uuid, text, text), public.confirm_check_scorecard(uuid, text),
  public.check_scoring_view(uuid), public.list_my_check_matches() to authenticated;