-- CricLume staff roles (separate from club roles)
create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy user_roles_read_own on public.user_roles for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- Emails that become CricLume staff once confirmed (server-only list)
create table public.platform_admin_emails (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  created_at timestamptz not null default now()
);
grant all on public.platform_admin_emails to service_role;
alter table public.platform_admin_emails enable row level security;

create or replace function public.grant_platform_admin_on_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.email_confirmed_at is not null and new.email is not null
       and exists (select 1 from public.platform_admin_emails e where e.email = lower(new.email)) then
      insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
    end if;
  exception when others then
    -- never block sign-up or sign-in
    null;
  end;
  return new;
end;
$$;
revoke all on function public.grant_platform_admin_on_confirm() from public, anon, authenticated;
create trigger on_auth_user_platform_admin
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function public.grant_platform_admin_on_confirm();

-- Campaigns sold by CricLume
create table public.promo_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser text not null check (char_length(btrim(advertiser)) between 1 and 120),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'live', 'paused', 'ended')),
  starts_on date not null default current_date,
  ends_on date,
  price_amount numeric(12,2) not null default 0 check (price_amount >= 0),
  currency text not null default 'GBP' check (currency ~ '^[A-Z]{3}$'),
  click_url text check (click_url is null or click_url ~ '^https://[^\s]{3,500}$'),
  countries text[] not null default '{}',
  regions text[] not null default '{}',
  cities text[] not null default '{}',
  surfaces text[] not null default array['ground', 'scoreboard', 'app'],
  weight integer not null default 1 check (weight between 1 and 10),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  check (cardinality(surfaces) > 0 and surfaces <@ array['ground', 'scoreboard', 'app']),
  check (cardinality(countries) <= 60 and cardinality(regions) <= 60 and cardinality(cities) <= 100)
);
grant select, insert, update, delete on public.promo_campaigns to authenticated;
grant all on public.promo_campaigns to service_role;
alter table public.promo_campaigns enable row level security;
create policy promo_campaigns_staff on public.promo_campaigns for all to authenticated
  using (public.has_role((select auth.uid()), 'admin')) with check (public.has_role((select auth.uid()), 'admin'));

create table public.promo_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.promo_campaigns(id) on delete cascade,
  slot text not null check (slot in ('top', 'side')),
  media_path text not null unique check (media_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  media_kind text not null check (media_kind in ('image', 'video')),
  duration_seconds integer not null default 10 check (duration_seconds between 3 and 60),
  alt_text text not null default '' check (char_length(alt_text) <= 200),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index promo_creatives_campaign_idx on public.promo_creatives (campaign_id);
grant select, insert, update, delete on public.promo_creatives to authenticated;
grant all on public.promo_creatives to service_role;
alter table public.promo_creatives enable row level security;
create policy promo_creatives_staff on public.promo_creatives for all to authenticated
  using (public.has_role((select auth.uid()), 'admin')) with check (public.has_role((select auth.uid()), 'admin'));

-- Daily play counts with the club's share at the time
create table public.promo_play_counts (
  day date not null,
  campaign_id uuid not null references public.promo_campaigns(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete cascade,
  slot text not null check (slot in ('top', 'side')),
  surface text not null check (surface in ('ground', 'scoreboard', 'app')),
  plays integer not null default 0 check (plays >= 0),
  share_percent integer not null default 0 check (share_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (day, campaign_id, organisation_id, slot, surface)
);
create index promo_play_counts_org_idx on public.promo_play_counts (organisation_id, day);
grant select on public.promo_play_counts to authenticated;
grant all on public.promo_play_counts to service_role;
alter table public.promo_play_counts enable row level security;
create policy promo_play_counts_staff_read on public.promo_play_counts for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'));

-- One counted play per ad per viewer per minute (server only)
create table public.promo_play_guard (
  creative_id uuid not null,
  viewer_hash text not null,
  bucket timestamptz not null,
  primary key (creative_id, viewer_hash, bucket)
);
create index promo_play_guard_bucket_idx on public.promo_play_guard (bucket);
grant all on public.promo_play_guard to service_role;
alter table public.promo_play_guard enable row level security;

-- Revenue share: free 0%, paid plan 30%, paid plan with video add-on (full system) 50%
create or replace function public.promo_share_percent(p_organisation_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when s.plan in ('club', 'league') and s.status in ('active', 'trialing') then
        case when coalesce(s.entitlements ->> 'videoAddon', 'false') = 'true' then 50 else 30 end
      else 0 end
    from public.subscriptions s where s.organisation_id = p_organisation_id
  ), 0)
$$;
revoke all on function public.promo_share_percent(uuid) from public, anon, authenticated;
grant execute on function public.promo_share_percent(uuid) to service_role;

-- Ads that can run today on a screen type (server only; matching by place happens on the server)
create or replace function public.list_live_promos(p_surface text)
returns table (
  creative_id uuid, campaign_id uuid, slot text, media_path text, media_kind text, duration_seconds integer,
  alt_text text, advertiser text, click_url text, countries text[], regions text[], cities text[], weight integer
) language sql stable security definer set search_path = public as $$
  select c.id, a.id, c.slot, c.media_path, c.media_kind, c.duration_seconds, c.alt_text, a.advertiser, a.click_url,
         a.countries, a.regions, a.cities, a.weight
  from public.promo_creatives c
  join public.promo_campaigns a on a.id = c.campaign_id
  where c.active and a.status = 'live' and p_surface = any(a.surfaces)
    and a.starts_on <= current_date and (a.ends_on is null or a.ends_on >= current_date)
  order by a.weight desc, c.created_at
  limit 200
$$;
revoke all on function public.list_live_promos(text) from public, anon, authenticated;
grant execute on function public.list_live_promos(text) to service_role;

create or replace function public.record_promo_plays(
  p_creative_ids uuid[], p_organisation_id uuid, p_surface text, p_viewer_hash text
) returns integer language plpgsql security definer set search_path = public as $$
declare
  v_share integer := 0;
  v_counted integer := 0;
  v_rows integer;
  v_item record;
  v_bucket timestamptz := date_trunc('minute', now());
begin
  if p_surface not in ('ground', 'scoreboard', 'app') or p_viewer_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid play report';
  end if;
  if p_organisation_id is not null then
    v_share := public.promo_share_percent(p_organisation_id);
  end if;
  for v_item in
    select distinct c.id, c.campaign_id, c.slot
    from public.promo_creatives c join public.promo_campaigns a on a.id = c.campaign_id
    where c.id = any(p_creative_ids[1:20]) and c.active and a.status = 'live' and p_surface = any(a.surfaces)
      and a.starts_on <= current_date and (a.ends_on is null or a.ends_on >= current_date)
  loop
    insert into public.promo_play_guard (creative_id, viewer_hash, bucket)
      values (v_item.id, p_viewer_hash, v_bucket) on conflict do nothing;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      insert into public.promo_play_counts (day, campaign_id, organisation_id, slot, surface, plays, share_percent)
        values (current_date, v_item.campaign_id, p_organisation_id, v_item.slot, p_surface, 1, v_share)
      on conflict (day, campaign_id, organisation_id, slot, surface)
        do update set plays = public.promo_play_counts.plays + 1, share_percent = excluded.share_percent, updated_at = now();
      v_counted := v_counted + 1;
    end if;
  end loop;
  delete from public.promo_play_guard where ctid in (
    select ctid from public.promo_play_guard where bucket < now() - interval '2 days' limit 500
  );
  return v_counted;
end;
$$;
revoke all on function public.record_promo_plays(uuid[], uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_promo_plays(uuid[], uuid, text, text) to service_role;

-- Club's estimated earnings: campaign price x (club plays / all plays of that campaign) x share
create or replace function public.club_promo_earnings(p_organisation_id uuid, p_from date, p_to date)
returns table (
  campaign_id uuid, advertiser text, campaign_name text, currency text,
  club_plays bigint, share_percent integer, estimated_earnings numeric
) language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_org_role(p_organisation_id, array['owner', 'club_admin', 'league_admin', 'treasurer']::public.platform_role[])
          or public.has_role(auth.uid(), 'admin')) then
    raise exception 'Only the club owner, admins and treasurer can see ad earnings';
  end if;
  return query
  with totals as (
    select pc.campaign_id, sum(pc.plays)::numeric as all_plays from public.promo_play_counts pc group by pc.campaign_id
  ), mine as (
    select pc.campaign_id, sum(pc.plays)::bigint as plays, sum(pc.plays * pc.share_percent)::numeric as weighted
    from public.promo_play_counts pc
    where pc.organisation_id = p_organisation_id and pc.day between p_from and p_to
    group by pc.campaign_id
  )
  select a.id, a.advertiser, a.name, a.currency, m.plays,
         case when m.plays > 0 then round(m.weighted / m.plays)::integer else 0 end,
         case when t.all_plays > 0 then round(a.price_amount * m.weighted / 100 / t.all_plays, 2) else 0 end
  from mine m join totals t on t.campaign_id = m.campaign_id join public.promo_campaigns a on a.id = m.campaign_id
  order by 7 desc;
end;
$$;
revoke all on function public.club_promo_earnings(uuid, date, date) from public, anon;
grant execute on function public.club_promo_earnings(uuid, date, date) to authenticated, service_role;

-- Staff: what every club is owed
create or replace function public.admin_promo_payouts(p_from date, p_to date)
returns table (organisation_id uuid, organisation_name text, currency text, plays bigint, estimated_earnings numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'CricLume staff only'; end if;
  return query
  with totals as (
    select pc.campaign_id, sum(pc.plays)::numeric as all_plays from public.promo_play_counts pc group by pc.campaign_id
  )
  select o.id, o.name, a.currency, sum(pc.plays)::bigint,
         round(sum(a.price_amount * pc.plays * pc.share_percent / 100 / nullif(t.all_plays, 0)), 2)
  from public.promo_play_counts pc
  join public.organisations o on o.id = pc.organisation_id
  join public.promo_campaigns a on a.id = pc.campaign_id
  join totals t on t.campaign_id = pc.campaign_id
  where pc.day between p_from and p_to
  group by o.id, o.name, a.currency
  order by 5 desc nulls last;
end;
$$;
revoke all on function public.admin_promo_payouts(date, date) from public, anon;
grant execute on function public.admin_promo_payouts(date, date) to authenticated, service_role;

-- Staff: set a club's plan while payments are handled by hand
create or replace function public.admin_set_club_plan(p_organisation_id uuid, p_plan text, p_video_addon boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'CricLume staff only'; end if;
  if p_plan not in ('starter', 'club', 'league') then raise exception 'Unknown plan'; end if;
  insert into public.subscriptions (organisation_id, plan, status, entitlements)
  values (p_organisation_id, p_plan, case when p_plan = 'starter' then 'inactive' else 'active' end,
          jsonb_build_object('videoAddon', p_plan <> 'starter' and p_video_addon))
  on conflict (organisation_id) do update set
    plan = excluded.plan, status = excluded.status,
    entitlements = coalesce(public.subscriptions.entitlements, '{}'::jsonb) || excluded.entitlements,
    updated_at = now();
end;
$$;
revoke all on function public.admin_set_club_plan(uuid, text, boolean) from public, anon;
grant execute on function public.admin_set_club_plan(uuid, text, boolean) to authenticated, service_role;

create or replace function public.admin_club_plans()
returns table (organisation_id uuid, organisation_name text, kind text, plan text, status text, video_addon boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'CricLume staff only'; end if;
  return query
  select o.id, o.name, o.kind::text, coalesce(s.plan, 'starter'), coalesce(s.status, 'inactive'),
         coalesce(s.entitlements ->> 'videoAddon', 'false') = 'true'
  from public.organisations o left join public.subscriptions s on s.organisation_id = o.id
  order by o.name limit 500;
end;
$$;
revoke all on function public.admin_club_plans() from public, anon;
grant execute on function public.admin_club_plans() to authenticated, service_role;

-- Ad files: staff upload and manage; viewers get signed links from the server
create policy promo_media_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'promo-media' and public.has_role((select auth.uid()), 'admin'));
create policy promo_media_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'promo-media' and public.has_role((select auth.uid()), 'admin'));
create policy promo_media_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'promo-media' and public.has_role((select auth.uid()), 'admin'));
create policy promo_media_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'promo-media' and public.has_role((select auth.uid()), 'admin'));