alter table public.club_site_domains
  add column if not exists kind text not null default 'own';
alter table public.club_site_domains drop constraint if exists club_site_domains_kind_check;
alter table public.club_site_domains add constraint club_site_domains_kind_check check (kind in ('own', 'criclume'));

-- Names CricLume keeps for itself under criclume.com. Keep in step with reservedClubLabels in src/lib/club-domain-records.ts.
create or replace function public.is_reserved_club_label(p_label text)
returns boolean language sql immutable set search_path = '' as $$
  select lower(coalesce(p_label, '')) = any (array[
    'www','app','apps','api','admin','staff','auth','login','signin','account','accounts','billing','pay','payments',
    'mail','email','smtp','imap','pop','ftp','mx','ns','ns1','ns2','ns3','dns','cdn','static','assets','media','img','images',
    'video','videos','stream','live','help','support','status','docs','blog','news','shop','store','tickets',
    'dev','test','staging','preview','beta','demo','platform','dashboard','club','clubs','league','leagues',
    'ground','overlay','scoreboard','umpire','umpires','sponsor','sponsors','promo','ads','ad','m','mobile',
    'criclume','lovable','official','security','legal','privacy','terms'
  ]);
$$;

-- League plan: a free <name>.criclume.com website address for clubs that don't own a domain.
create or replace function public.request_club_criclume_address(p_organisation_id uuid, p_label text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_label text := lower(btrim(coalesce(p_label, '')));
  v_host text;
  v_existing public.club_site_domains%rowtype;
  v_id uuid;
begin
  if not public.is_site_editor(p_organisation_id) then
    raise exception 'Only the club owner or an admin can set the website address';
  end if;
  if not public.club_custom_domain_allowed(p_organisation_id) then
    raise exception 'A club web address comes with the League plan';
  end if;
  if v_label !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' or v_label like '%--%' then
    raise exception 'Use 3 to 40 letters, numbers or dashes, like riverside-cc';
  end if;
  if public.is_reserved_club_label(v_label) then
    raise exception 'That name is kept by CricLume. Try another, like your club name';
  end if;
  v_host := v_label || '.criclume.com';
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

  insert into public.club_site_domains (organisation_id, hostname, kind, requested_by)
  values (p_organisation_id, v_host, 'criclume', auth.uid()) returning id into v_id;
  return v_id;
end $$;

drop function if exists public.admin_club_site_domains();
create function public.admin_club_site_domains()
returns table (
  id uuid, organisation_id uuid, organisation_name text, site_slug text, hostname text, kind text, status text,
  dns_a_target text, dns_txt_value text, staff_note text, plan_allowed boolean, site_published boolean,
  created_at timestamptz, live_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'CricLume staff only'; end if;
  return query
    select d.id, d.organisation_id, o.name, coalesce(cs.web_slug, o.slug), d.hostname, d.kind, d.status,
           d.dns_a_target, d.dns_txt_value, d.staff_note, public.club_custom_domain_allowed(d.organisation_id),
           coalesce(cs.published, false), d.created_at, d.live_at
      from public.club_site_domains d
      join public.organisations o on o.id = d.organisation_id
      left join public.club_sites cs on cs.organisation_id = d.organisation_id
     order by (d.status = 'requested') desc, d.created_at desc;
end $$;

revoke all on function public.request_club_criclume_address(uuid, text) from public, anon;
revoke all on function public.admin_club_site_domains() from public, anon;
grant execute on function public.request_club_criclume_address(uuid, text) to authenticated;
grant execute on function public.admin_club_site_domains() to authenticated;
grant execute on function public.is_reserved_club_label(text) to authenticated;