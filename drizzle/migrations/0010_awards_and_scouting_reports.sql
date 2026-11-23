create table public.competition_awards (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  category text not null check (char_length(category) between 1 and 60),
  prize text check (prize is null or char_length(prize) <= 200),
  winner_player_id text check (winner_player_id is null or char_length(winner_player_id) <= 100),
  winner_name text check (winner_name is null or char_length(winner_name) <= 120),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, category)
);

grant select, insert, update, delete on public.competition_awards to authenticated;
grant all on public.competition_awards to service_role;
alter table public.competition_awards enable row level security;

create policy competition_awards_member_select on public.competition_awards
  for select to authenticated using (public.is_org_member(organisation_id));
create policy competition_awards_admin_insert on public.competition_awards
  for insert to authenticated with check (
    public.has_org_role(organisation_id, array['owner','league_admin','club_admin']::public.platform_role[])
    and exists (select 1 from public.competitions c where c.id = competition_id and c.organisation_id = competition_awards.organisation_id)
  );
create policy competition_awards_admin_update on public.competition_awards
  for update to authenticated
  using (public.has_org_role(organisation_id, array['owner','league_admin','club_admin']::public.platform_role[]))
  with check (
    public.has_org_role(organisation_id, array['owner','league_admin','club_admin']::public.platform_role[])
    and exists (select 1 from public.competitions c where c.id = competition_id and c.organisation_id = competition_awards.organisation_id)
  );
create policy competition_awards_admin_delete on public.competition_awards
  for delete to authenticated using (public.has_org_role(organisation_id, array['owner','league_admin','club_admin']::public.platform_role[]));
create trigger competition_awards_updated_at before update on public.competition_awards
  for each row execute function public.set_updated_at();

-- Current coaching consent for a player in an organisation.
create or replace function public.scouting_consent_granted(p_player_id uuid, p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.player_consents pc
    where pc.player_id = p_player_id
      and pc.organisation_id = p_organisation_id
      and pc.coaching_analysis = 'granted'
      and pc.valid_from <= now()
      and (pc.valid_until is null or pc.valid_until > now())
  )
$$;
revoke all on function public.scouting_consent_granted(uuid, uuid) from public, anon;
grant execute on function public.scouting_consent_granted(uuid, uuid) to authenticated;

create table public.scouting_reports (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_by uuid not null default auth.uid(),
  recipient text not null check (char_length(recipient) between 2 and 160),
  report jsonb not null,
  token_hash text not null unique check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.scouting_reports to authenticated;
grant all on public.scouting_reports to service_role;
alter table public.scouting_reports enable row level security;

create policy scouting_reports_staff_select on public.scouting_reports
  for select to authenticated using (
    public.has_org_role(organisation_id, array['owner','club_admin','coach','safeguarding_officer']::public.platform_role[])
  );
create policy scouting_reports_staff_insert on public.scouting_reports
  for insert to authenticated with check (
    created_by = auth.uid()
    and revoked_at is null
    and view_count = 0
    and public.has_org_role(organisation_id, array['owner','club_admin','coach','safeguarding_officer']::public.platform_role[])
    and public.scouting_consent_granted(player_id, organisation_id)
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.organisation_id = scouting_reports.organisation_id
        and (not p.is_junior or public.has_org_role(p.organisation_id, array['owner','safeguarding_officer']::public.platform_role[]))
    )
  );
create policy scouting_reports_staff_update on public.scouting_reports
  for update to authenticated
  using (public.has_org_role(organisation_id, array['owner','club_admin','coach','safeguarding_officer']::public.platform_role[]))
  with check (public.has_org_role(organisation_id, array['owner','club_admin','coach','safeguarding_officer']::public.platform_role[]));

create index scouting_reports_org_player_idx on public.scouting_reports (organisation_id, player_id, created_at desc);

-- Shares last at most 180 days; only revoking may change a share after it is sent.
create or replace function public.scouting_reports_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.expires_at <= now() or new.expires_at > now() + interval '180 days' then
      raise exception 'share must expire within 180 days' using errcode = '22023';
    end if;
  else
    if new.report is distinct from old.report or new.token_hash is distinct from old.token_hash
       or new.player_id is distinct from old.player_id or new.organisation_id is distinct from old.organisation_id
       or new.recipient is distinct from old.recipient or new.created_by is distinct from old.created_by
       or new.expires_at > old.expires_at then
      raise exception 'a sent scouting report cannot be changed, only revoked' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger scouting_reports_guard before insert or update on public.scouting_reports
  for each row execute function public.scouting_reports_guard();

-- Read a shared report by its secret link. Stops working when revoked, expired, or consent is withdrawn.
create or replace function public.get_shared_scouting_report(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.scouting_reports;
  v_club text;
begin
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 128 then
    return null;
  end if;
  select * into v_row from public.scouting_reports
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and revoked_at is null and expires_at > now();
  if not found or not public.scouting_consent_granted(v_row.player_id, v_row.organisation_id) then
    return null;
  end if;
  update public.scouting_reports set view_count = view_count + 1, last_viewed_at = now() where id = v_row.id;
  select name into v_club from public.organisations where id = v_row.organisation_id;
  return jsonb_build_object(
    'report', v_row.report,
    'recipient', v_row.recipient,
    'club', v_club,
    'sharedAt', v_row.created_at,
    'expiresAt', v_row.expires_at
  );
end;
$$;
revoke all on function public.get_shared_scouting_report(text) from public;
grant execute on function public.get_shared_scouting_report(text) to anon, authenticated;