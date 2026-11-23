create table public.club_promos (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  sponsor text not null check (char_length(btrim(sponsor)) between 1 and 120),
  slot text not null check (slot in ('top', 'side')),
  media_path text not null unique check (media_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'),
  media_kind text not null check (media_kind in ('image', 'video')),
  duration_seconds integer not null default 10 check (duration_seconds between 3 and 60),
  alt_text text not null default '' check (char_length(alt_text) <= 200),
  click_url text check (click_url is null or click_url ~ '^https://[^\s]{3,500}$'),
  surfaces text[] not null default array['ground', 'scoreboard', 'app'],
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (split_part(media_path, '/', 1) = organisation_id::text),
  check (cardinality(surfaces) > 0 and surfaces <@ array['ground', 'scoreboard', 'app'])
);
create index club_promos_org_idx on public.club_promos (organisation_id);
grant select, insert, update, delete on public.club_promos to authenticated;
grant all on public.club_promos to service_role;
alter table public.club_promos enable row level security;
create policy club_promos_admins on public.club_promos for all to authenticated
  using (public.has_org_role(organisation_id, array['owner', 'club_admin', 'league_admin']::public.platform_role[]))
  with check (public.has_org_role(organisation_id, array['owner', 'club_admin', 'league_admin']::public.platform_role[]));

create or replace function public.list_club_promos(p_organisation_id uuid, p_surface text)
returns table (id uuid, slot text, media_path text, media_kind text, duration_seconds integer, alt_text text, sponsor text, click_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.slot, p.media_path, p.media_kind, p.duration_seconds, p.alt_text, p.sponsor, p.click_url
  from public.club_promos p
  where p.organisation_id = p_organisation_id and p.active and p_surface = any(p.surfaces)
  order by p.created_at
  limit 24
$$;
revoke all on function public.list_club_promos(uuid, text) from public, anon, authenticated;
grant execute on function public.list_club_promos(uuid, text) to service_role;

create policy club_promo_media_read on storage.objects for select to authenticated
  using (bucket_id = 'club-promo-media' and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner', 'club_admin', 'league_admin']::public.platform_role[]));
create policy club_promo_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'club-promo-media' and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner', 'club_admin', 'league_admin']::public.platform_role[]));
create policy club_promo_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'club-promo-media' and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner', 'club_admin', 'league_admin']::public.platform_role[]));