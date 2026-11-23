
alter table public.club_sites add column if not exists logo_path text;

create table public.club_site_domains (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  hostname text not null,
  status text not null default 'requested' check (status in ('requested','setting_up','live','paused','declined')),
  dns_a_target text,
  dns_txt_value text,
  staff_note text,
  requested_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  live_at timestamptz,
  constraint club_site_domains_hostname_format check (
    hostname = lower(hostname)
    and length(hostname) between 4 and 253
    and hostname ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$'
  )
);
create unique index club_site_domains_hostname_key on public.club_site_domains (hostname) where status <> 'declined';
create unique index club_site_domains_one_per_org on public.club_site_domains (organisation_id) where status <> 'declined';

grant select on public.club_site_domains to authenticated;
grant all on public.club_site_domains to service_role;
alter table public.club_site_domains enable row level security;

create policy "site editors and staff read club domains" on public.club_site_domains
  for select to authenticated
  using (public.is_site_editor(organisation_id) or public.has_role(auth.uid(), 'admin'));

-- Which clubs may use their own domain. Keep in step with canUseFeature(…, "customDomain") in src/lib/plans.ts.
create or replace function public.club_custom_domain_allowed(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
    where s.organisation_id = p_org and s.plan = 'league' and s.status in ('active', 'trialing')
  );
$$;

create or replace function public.normalise_club_hostname(p_input text)
returns text language plpgsql immutable set search_path = '' as $$
declare v text;
begin
  v := lower(btrim(coalesce(p_input, '')));
  v := regexp_replace(v, '^[a-z]+://', '');
  v := split_part(split_part(split_part(v, '/', 1), '?', 1), '#', 1);
  v := split_part(v, ':', 1);
  v := regexp_replace(v, '\.$', '');
  v := regexp_replace(v, '^www\.', '');
  return v;
end $$;

create or replace function public.request_club_site_domain(p_organisation_id uuid, p_hostname text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_host text := public.normalise_club_hostname(p_hostname);
  v_existing public.club_site_domains%rowtype;
  v_id uuid;
begin
  if not public.is_site_editor(p_organisation_id) then
    raise exception 'Only the club owner or an admin can set the website address';
  end if;
  if not public.club_custom_domain_allowed(p_organisation_id) then
    raise exception 'Your own domain comes with the League plan';
  end if;
  if length(v_host) < 4 or length(v_host) > 253
     or v_host !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$' then
    raise exception 'Enter a web address like yourclub.com';
  end if;
  if v_host = 'criclume.com' or v_host like '%.criclume.com'
     or v_host ~ '(^|\.)(lovable\.app|lovable\.dev|lovableproject\.com|supabase\.co|localhost|local|test|example|invalid)$' then
    raise exception 'Use a domain your club owns';
  end if;
  if exists (select 1 from public.club_site_domains d where d.hostname = v_host and d.status <> 'declined' and d.organisation_id <> p_organisation_id) then
    raise exception 'That web address is already linked to another club';
  end if;

  select * into v_existing from public.club_site_domains d
   where d.organisation_id = p_organisation_id and d.status <> 'declined';
  if found then
    if v_existing.hostname = v_host then return v_existing.id; end if;
    if v_existing.status = 'live' then
      raise exception 'Your current address is live. Remove it first, then add the new one';
    end if;
    delete from public.club_site_domains where id = v_existing.id;
  end if;

  insert into public.club_site_domains (organisation_id, hostname, requested_by)
  values (p_organisation_id, v_host, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.remove_club_site_domain(p_organisation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_site_editor(p_organisation_id) then
    raise exception 'Only the club owner or an admin can change the website address';
  end if;
  delete from public.club_site_domains where organisation_id = p_organisation_id and status <> 'declined';
end $$;

create or replace function public.admin_update_club_site_domain(
  p_id uuid, p_status text, p_dns_a_target text, p_dns_txt_value text, p_staff_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'CricLume staff only'; end if;
  if p_status not in ('requested','setting_up','live','paused','declined') then raise exception 'Unknown status'; end if;
  update public.club_site_domains set
    status = p_status,
    dns_a_target = nullif(btrim(coalesce(p_dns_a_target, '')), ''),
    dns_txt_value = nullif(btrim(coalesce(p_dns_txt_value, '')), ''),
    staff_note = nullif(btrim(coalesce(p_staff_note, '')), ''),
    live_at = case when p_status = 'live' then coalesce(live_at, now()) else live_at end,
    updated_at = now()
  where id = p_id;
  if not found then raise exception 'Domain request not found'; end if;
end $$;

create or replace function public.admin_club_site_domains()
returns table (
  id uuid, organisation_id uuid, organisation_name text, site_slug text, hostname text, status text,
  dns_a_target text, dns_txt_value text, staff_note text, plan_allowed boolean, site_published boolean,
  created_at timestamptz, live_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'CricLume staff only'; end if;
  return query
    select d.id, d.organisation_id, o.name, coalesce(cs.web_slug, o.slug), d.hostname, d.status,
           d.dns_a_target, d.dns_txt_value, d.staff_note, public.club_custom_domain_allowed(d.organisation_id),
           coalesce(cs.published, false), d.created_at, d.live_at
      from public.club_site_domains d
      join public.organisations o on o.id = d.organisation_id
      left join public.club_sites cs on cs.organisation_id = d.organisation_id
     order by (d.status = 'requested') desc, d.created_at desc;
end $$;

-- Public: which published club website lives at this web address (root or www.).
create or replace function public.resolve_club_site_domain(p_host text)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(cs.web_slug, o.slug)
    from public.club_site_domains d
    join public.organisations o on o.id = d.organisation_id
    join public.club_sites cs on cs.organisation_id = d.organisation_id
   where d.status = 'live' and cs.published
     and public.club_custom_domain_allowed(d.organisation_id)
     and (d.hostname = lower(p_host) or 'www.' || d.hostname = lower(p_host))
   limit 1;
$$;

revoke all on function public.request_club_site_domain(uuid, text) from public, anon;
revoke all on function public.remove_club_site_domain(uuid) from public, anon;
revoke all on function public.admin_update_club_site_domain(uuid, text, text, text, text) from public, anon;
revoke all on function public.admin_club_site_domains() from public, anon;
grant execute on function public.request_club_site_domain(uuid, text) to authenticated;
grant execute on function public.remove_club_site_domain(uuid) to authenticated;
grant execute on function public.admin_update_club_site_domain(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_club_site_domains() to authenticated;
grant execute on function public.club_custom_domain_allowed(uuid) to authenticated;
grant execute on function public.resolve_club_site_domain(text) to anon, authenticated;

-- Published logos are public like the hero photo.
create or replace function public.club_site_file_public(p_name text)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.club_sites s
    where s.organisation_id = public.club_site_path_org(p_name)
      and s.published
      and (s.hero_path = p_name or s.logo_path = p_name
        or exists (select 1 from public.club_site_photos ph where ph.organisation_id = s.organisation_id and ph.path = p_name)
        or exists (select 1 from public.club_site_posts p where p.organisation_id = s.organisation_id and p.file_path = p_name
                   and p.published_at is not null and p.published_at <= now()))
  );
$$;

CREATE OR REPLACE FUNCTION public.get_club_site(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_org public.organisations%ROWTYPE;
  v_site public.club_sites%ROWTYPE;
  v_team_ids uuid[];
  v_allowed boolean;
  v_domain text;
BEGIN
  SELECT o.* INTO v_org FROM public.club_sites s JOIN public.organisations o ON o.id = s.organisation_id WHERE s.web_slug = p_slug;
  IF NOT FOUND THEN
    SELECT * INTO v_org FROM public.organisations WHERE slug = p_slug;
    IF NOT FOUND THEN RETURN NULL; END IF;
  END IF;
  SELECT * INTO v_site FROM public.club_sites WHERE organisation_id = v_org.id;
  IF NOT FOUND OR NOT v_site.published THEN
    RETURN jsonb_build_object('published', false, 'name', v_org.name, 'kind', v_org.kind, 'slug', coalesce(v_site.web_slug, v_org.slug));
  END IF;
  SELECT coalesce(array_agg(id), '{}') INTO v_team_ids FROM public.teams WHERE organisation_id = v_org.id;
  v_allowed := public.club_custom_domain_allowed(v_org.id);
  SELECT d.hostname INTO v_domain FROM public.club_site_domains d
   WHERE d.organisation_id = v_org.id AND d.status = 'live' AND v_allowed LIMIT 1;

  RETURN jsonb_build_object(
    'published', true,
    'name', v_org.name, 'kind', v_org.kind, 'slug', coalesce(v_site.web_slug, v_org.slug),
    'domain', v_domain,
    'coBranded', v_allowed,
    'site', jsonb_build_object(
      'tagline', v_site.tagline, 'about', v_site.about, 'accent', v_site.accent,
      'contactEmail', v_site.contact_email, 'contactPhone', v_site.contact_phone,
      'address', v_site.address, 'mapUrl', v_site.map_url, 'socials', v_site.socials,
      'sponsors', v_site.sponsors, 'heroPath', v_site.hero_path, 'logoPath', v_site.logo_path,
      'updatedAt', v_site.updated_at),
    'teams', coalesce((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'shortName', t.short_name, 'ageGroup', t.age_group) ORDER BY t.name)
      FROM public.teams t WHERE t.organisation_id = v_org.id), '[]'::jsonb),
    'matches', coalesce((SELECT jsonb_agg(x.j ORDER BY x.sort_at DESC) FROM (
      SELECT jsonb_build_object(
        'id', m.id, 'status', m.status,
        'scheduledAt', m.scheduled_at, 'startedAt', m.started_at, 'completedAt', m.completed_at,
        'home', ht.name, 'away', at.name, 'ground', g.name,
        'runs', m.live_state->'runs', 'wickets', m.live_state->'wickets', 'overs', m.live_state->'overs',
        'target', m.live_state->'target', 'battingIsHome', m.live_state->'battingIsHome',
        'result', m.live_state->'result',
        'scoreboard', (SELECT s.slug FROM public.public_scoreboards s WHERE s.match_id = m.id AND s.enabled LIMIT 1)
      ) AS j, coalesce(m.started_at, m.scheduled_at, m.created_at) AS sort_at
      FROM public.matches m
      JOIN public.teams ht ON ht.id = m.home_team_id
      JOIN public.teams at ON at.id = m.away_team_id
      LEFT JOIN public.grounds g ON g.id = m.ground_id
      WHERE m.visibility = 'public'
        AND m.status IN ('scheduled','live','innings_break','completed','abandoned')
        AND (m.owner_organisation_id = v_org.id OR m.home_team_id = ANY(v_team_ids) OR m.away_team_id = ANY(v_team_ids))
      ORDER BY coalesce(m.started_at, m.scheduled_at, m.created_at) DESC
      LIMIT 60) x), '[]'::jsonb),
    'fixtures', coalesce((SELECT jsonb_agg(x.j ORDER BY x.starts_at) FROM (
      SELECT jsonb_build_object(
        'id', f.id, 'competitionId', f.competition_id, 'competition', c.name,
        'round', f.round_name, 'startsAt', f.starts_at, 'status', f.status,
        'homeTeamId', f.home_team_id, 'awayTeamId', f.away_team_id,
        'home', ht.name, 'away', at.name, 'ground', g.name,
        'result', CASE WHEN f.signed_off_at IS NOT NULL THEN f.result ELSE NULL END,
        'signedOff', f.signed_off_at IS NOT NULL, 'signedOffAt', f.signed_off_at,
        'ruleVersionId', f.rule_version_id
      ) AS j, f.starts_at
      FROM public.fixtures f
      JOIN public.competitions c ON c.id = f.competition_id
      JOIN public.teams ht ON ht.id = f.home_team_id
      JOIN public.teams at ON at.id = f.away_team_id
      LEFT JOIN public.grounds g ON g.id = f.ground_id
      WHERE f.status NOT IN ('draft','cancelled')
        AND (c.organisation_id = v_org.id OR f.home_team_id = ANY(v_team_ids) OR f.away_team_id = ANY(v_team_ids))
      ORDER BY f.starts_at NULLS LAST
      LIMIT 300) x), '[]'::jsonb),
    'competitions', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'format', c.format, 'season', s.name,
        'ruleVersionId', r.id, 'rules', r.rules) ORDER BY c.created_at DESC)
      FROM public.competitions c
      LEFT JOIN public.seasons s ON s.id = c.season_id
      LEFT JOIN LATERAL (SELECT rv.id, rv.rules FROM public.competition_rule_versions rv
        WHERE rv.competition_id = c.id AND rv.retired_at IS NULL ORDER BY rv.version DESC LIMIT 1) r ON true
      WHERE c.organisation_id = v_org.id), '[]'::jsonb),
    'posts', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'kind', p.kind, 'title', p.title, 'body', p.body, 'filePath', p.file_path,
        'linkUrl', p.link_url, 'pinned', p.pinned, 'publishedAt', p.published_at)
        ORDER BY p.pinned DESC, p.published_at DESC)
      FROM (SELECT * FROM public.club_site_posts WHERE organisation_id = v_org.id AND published_at IS NOT NULL AND published_at <= now()
        ORDER BY pinned DESC, published_at DESC LIMIT 60) p), '[]'::jsonb),
    'photos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', ph.id, 'path', ph.path, 'caption', ph.caption) ORDER BY ph.created_at DESC)
      FROM (SELECT * FROM public.club_site_photos WHERE organisation_id = v_org.id ORDER BY created_at DESC LIMIT 60) ph), '[]'::jsonb)
  );
END $function$;
