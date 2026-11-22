-- ==== 20261016153000_criclume_omniqora_intelligence.sql
-- CricLume retains its Lovable-linked Supabase project as the source of truth.
-- Omniqora operates a separate control plane. No Omniqora secrets or customer
-- player/video records are stored in these integration tables.
--
-- This is a source migration only. Apply through the existing Lovable-managed
-- Supabase release process after reviewing the exact project and migration history.

create table if not exists public.criclume_omniqora_links (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  omniqora_tenant_id uuid not null,
  enabled boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint criclume_omniqora_links_enabled_review
    check (not enabled or (approved_by is not null and approved_at is not null))
);

create unique index if not exists criclume_omniqora_links_tenant_key
  on public.criclume_omniqora_links (omniqora_tenant_id);

create table if not exists public.criclume_omniqora_runs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  omniqora_tenant_id uuid not null,
  omniqora_run_id uuid unique,
  task text not null check (task in (
    'match_insights', 'batting_coach', 'bowling_coach',
    'fielding_review', 'training_plan', 'analyst_agent'
  )),
  source_version timestamptz not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'starting' check (status in (
    'starting', 'queued', 'running', 'waiting_review',
    'completed', 'failed', 'cancelled', 'stale'
  )),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint criclume_omniqora_runs_one_per_score unique (
    organisation_id, match_id, task, source_version
  )
);

create index if not exists criclume_omniqora_runs_recent
  on public.criclume_omniqora_runs (organisation_id, requested_at desc);
create index if not exists criclume_omniqora_runs_match
  on public.criclume_omniqora_runs (match_id, requested_at desc);

-- Both tables are backend-only control-plane mapping and audit ledgers.
-- Frontend clients must never assign Omniqora tenant IDs or create runs directly.
alter table public.criclume_omniqora_links enable row level security;
alter table public.criclume_omniqora_runs enable row level security;
revoke all on public.criclume_omniqora_links from public, anon, authenticated;
revoke all on public.criclume_omniqora_runs from public, anon, authenticated;
grant select, insert, update, delete on public.criclume_omniqora_links to service_role;
grant select, insert, update, delete on public.criclume_omniqora_runs to service_role;

comment on table public.criclume_omniqora_links is
  'Back-office-approved mapping from one CricLume club to one Omniqora tenant; no browser access';
comment on table public.criclume_omniqora_runs is
  'Read-only advisory Omniqora requests bound to a specific organisation, match and score revision';

-- ==== 20261016180000_criclume_omniqora_atomic_requests.sql
-- Use the existing Lovable-connected CricLume Supabase database.
-- Atomic, idempotent reservations for an AI request; does NOT authorise spend.
-- Only the reviewed service-role Edge Function may call this helper.
CREATE OR REPLACE FUNCTION public.claim_criclume_omniqora_run(
  _organisation_id uuid,
  _match_id uuid,
  _tenant_id uuid,
  _task text,
  _source_version timestamptz,
  _requested_by uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  existing_id uuid;
  existing_status text;
  request_id uuid;
  request_status text;
  hour_count bigint;
BEGIN
  IF _organisation_id IS NULL OR _match_id IS NULL OR _tenant_id IS NULL
    OR _source_version IS NULL OR _requested_by IS NULL THEN
    RAISE EXCEPTION 'CRICLUME_AI_INVALID_SCOPE';
  END IF;

  IF _task NOT IN (
    'match_insights', 'batting_coach', 'bowling_coach',
    'fielding_review', 'training_plan', 'analyst_agent'
  ) THEN
    RAISE EXCEPTION 'CRICLUME_AI_INVALID_TASK';
  END IF;

  -- A single club must not race its own 12/hour limit from different devices.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_organisation_id::text, 0)
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.criclume_omniqora_links AS l
    WHERE l.organisation_id = _organisation_id
      AND l.omniqora_tenant_id = _tenant_id
      AND l.enabled = true
      AND l.approved_by IS NOT NULL
      AND l.approved_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'CRICLUME_AI_LINK_INACTIVE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.matches AS m
    WHERE m.id = _match_id
      AND m.owner_organisation_id = _organisation_id
      AND m.updated_at = _source_version
  ) THEN
    RAISE EXCEPTION 'CRICLUME_AI_MATCH_CHANGED';
  END IF;

  SELECT r.id, r.status INTO existing_id, existing_status
  FROM public.criclume_omniqora_runs AS r
  WHERE r.organisation_id = _organisation_id
    AND r.match_id = _match_id
    AND r.task = _task
    AND r.source_version = _source_version;

  IF existing_id IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'requestId', existing_id, 'status', existing_status, 'reused', true
    );
  END IF;

  SELECT count(*) INTO hour_count
  FROM public.criclume_omniqora_runs AS r
  WHERE r.organisation_id = _organisation_id
    AND r.requested_at >= pg_catalog.clock_timestamp() - interval '1 hour';

  IF hour_count >= 12 THEN
    RAISE EXCEPTION 'CRICLUME_AI_HOURLY_QUOTA';
  END IF;

  INSERT INTO public.criclume_omniqora_runs(
    organisation_id, match_id, omniqora_tenant_id, task,
    source_version, requested_by
  ) VALUES (
    _organisation_id, _match_id, _tenant_id, _task,
    _source_version, _requested_by
  ) RETURNING id, status INTO request_id, request_status;

  RETURN pg_catalog.jsonb_build_object(
    'requestId', request_id, 'status', request_status, 'reused', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_criclume_omniqora_run(
  uuid, uuid, uuid, text, timestamptz, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_criclume_omniqora_run(
  uuid, uuid, uuid, text, timestamptz, uuid
) TO service_role;

COMMENT ON FUNCTION public.claim_criclume_omniqora_run(
  uuid, uuid, uuid, text, timestamptz, uuid
) IS 'Only the authenticated CricLume Edge Function may atomically reserve an advisory request; billable model costs require a separate Omniqora budget reservation.';

-- ==== 20261025091500_criclume_budgeted_receipts_v1.sql
-- CricLume: prepare a source-owned receipt ledger for the separate
-- Omniqora budgeted Agent Factory. Additive; existing Lovable Supabase only.
-- This migration DOES NOT enable a paid model, create an Omniqora tenant,
-- change official scoring or call an external service.
ALTER TABLE public.criclume_omniqora_runs
 ADD COLUMN IF NOT EXISTS omniqora_reservation_id uuid,
 ADD COLUMN IF NOT EXISTS omniqora_reserved_minor bigint
  CHECK(omniqora_reserved_minor IS NULL OR omniqora_reserved_minor BETWEEN 1 AND 10000),
 ADD COLUMN IF NOT EXISTS omniqora_currency text
  CHECK(omniqora_currency IS NULL OR omniqora_currency IN('GBP','EUR','USD')),
 ADD COLUMN IF NOT EXISTS admission_mode text NOT NULL DEFAULT 'legacy'
  CHECK(admission_mode IN('legacy','budgeted')),
 ADD COLUMN IF NOT EXISTS reconciliation_note text;

ALTER TABLE public.criclume_omniqora_runs
 DROP CONSTRAINT IF EXISTS criclume_omniqora_runs_status_check;

ALTER TABLE public.criclume_omniqora_runs
 ADD CONSTRAINT criclume_omniqora_runs_status_check
 CHECK(status IN(
  'starting','queued','running','waiting_review','completed',
  'failed','cancelled','stale','reconcile_required'
 ));

COMMENT ON COLUMN public.criclume_omniqora_runs.omniqora_reservation_id IS
 'Omniqora verified, atomic Agent Factory cost reservation UUID; not an invoice';
COMMENT ON COLUMN public.criclume_omniqora_runs.reconciliation_note IS
 'Operator-only receipt reconciliation state for ambiguous upstream timeouts';

-- ==== 20261026133906_analysis_workspace.sql
create table public.criclume_analysis_files (
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null references public.organisations(id),match_id uuid not null references public.matches(id),
 kind text not null check(kind in ('image','video')),storage_path text unique not null,label text not null check(length(label) between 1 and 150),
 analysis_consent boolean not null default false,includes_junior boolean not null default true,
 retention_expires_at timestamptz not null default now()+interval '90 days',created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 check(storage_path like organisation_id::text||'/'||match_id::text||'/'||id::text||'.%')
);
create table public.criclume_analysis_notes (
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null references public.organisations(id),match_id uuid not null references public.matches(id),
 discipline text not null check(discipline in ('batting','bowling','fielding')),delivery_id uuid references public.deliveries(id),
 note text not null check(length(btrim(note)) between 3 and 3000),tags text not null default '' check(length(tags)<=300),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index criclume_analysis_files_scope on public.criclume_analysis_files(organisation_id,match_id,created_at desc);
create index criclume_analysis_notes_scope on public.criclume_analysis_notes(organisation_id,match_id,created_at desc);
alter table public.criclume_analysis_files enable row level security;
alter table public.criclume_analysis_notes enable row level security;
grant select,insert,delete on public.criclume_analysis_files to authenticated;
grant select,insert on public.criclume_analysis_notes to authenticated;
create policy analysis_files_read on public.criclume_analysis_files for select to authenticated using (
 retention_expires_at>now() and public.has_org_role(organisation_id,array['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[]));
create policy analysis_files_insert on public.criclume_analysis_files for insert to authenticated with check (
 created_by=(select auth.uid()) and analysis_consent and retention_expires_at between now() and now()+interval '90 days'
 and public.has_org_role(organisation_id,array['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[])
 and exists(select 1 from public.matches m where m.id=match_id and m.owner_organisation_id=organisation_id));
create policy analysis_files_delete on public.criclume_analysis_files for delete to authenticated using (
 created_by=(select auth.uid()) and public.has_org_role(organisation_id,array['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[]));
create policy analysis_notes_read on public.criclume_analysis_notes for select to authenticated using (
 public.has_org_role(organisation_id,array['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[]));
create policy analysis_notes_insert on public.criclume_analysis_notes for insert to authenticated with check (
 created_by=(select auth.uid()) and public.has_org_role(organisation_id,array['owner','club_admin','league_admin','coach','safeguarding_officer']::public.platform_role[])
 and exists(select 1 from public.matches m where m.id=match_id and m.owner_organisation_id=organisation_id)
 and (delivery_id is null or exists(select 1 from public.deliveries d where d.id=delivery_id and d.match_id=criclume_analysis_notes.match_id and d.superseded_by is null)));
create policy analysis_object_read on storage.objects for select to authenticated using(bucket_id='criclume-evidence' and exists(select 1 from public.criclume_analysis_files f where f.storage_path=name));
create policy analysis_object_insert on storage.objects for insert to authenticated with check(bucket_id='criclume-evidence' and exists(select 1 from public.criclume_analysis_files f where f.storage_path=name and f.created_by=(select auth.uid())));
create policy analysis_object_delete on storage.objects for delete to authenticated using(bucket_id='criclume-evidence' and exists(select 1 from public.criclume_analysis_files f where f.storage_path=name and f.created_by=(select auth.uid())));
create trigger audit_analysis_files after insert or update or delete on public.criclume_analysis_files for each row execute function public.audit_row_change('organisation_id');
create trigger audit_analysis_notes after insert on public.criclume_analysis_notes for each row execute function public.audit_row_change('organisation_id');

-- ==== 20261026135453_media_completion.sql
create table public.video_processing_jobs (
 id uuid primary key default gen_random_uuid(),asset_id uuid not null unique references public.video_assets(id) on delete cascade,
 status text not null default 'processing' check(status in ('processing','ready','failed')),output_prefix text not null,kinds text[] not null,
 created_at timestamptz not null default now(),completed_at timestamptz
);
alter table public.video_processing_jobs enable row level security;
revoke all on public.video_processing_jobs from public,anon,authenticated;
grant all on public.video_processing_jobs to service_role;
create function public.claim_video_processing(p_asset uuid,p_user uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.video_assets;j public.video_processing_jobs;prefix text;kinds text[];
begin
 select * into a from public.video_assets where id=p_asset for update;
 if not found or not exists(select 1 from public.organisation_members where organisation_id=a.organisation_id and user_id=p_user and status='active' and role in ('owner','league_admin','club_admin','coach','safeguarding_officer')) then raise exception 'Video processing permission denied';end if;
 select * into j from public.video_processing_jobs where asset_id=p_asset;
 if found then return jsonb_build_object('jobId',j.id,'reused',true,'status',j.status);end if;
 if a.status<>'uploaded' or a.recording_consent<>'granted' or a.storage_path is null or a.retention_expires_at<=now() then raise exception 'Consented current upload required';end if;
 if not exists(select 1 from storage.objects where bucket_id='match-video' and name=a.storage_path) then raise exception 'Source object missing';end if;
 prefix:=a.organisation_id::text||'/'||a.room_id::text||'/'||a.id::text||'/processed/';
 kinds:=case when a.blur_mode='none' then array['proxy','thumbnail'] else array['proxy','thumbnail','blurred'] end;
 insert into public.video_processing_jobs(asset_id,output_prefix,kinds) values(a.id,prefix,kinds) returning * into j;
 update public.video_assets set status='processing' where id=a.id;
 return jsonb_build_object('jobId',j.id,'reused',false,'status','processing','prefix',prefix,'kinds',to_jsonb(kinds));
end $$;
create function public.complete_video_processing(p_job uuid,p_status text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.video_processing_jobs;a public.video_assets;k text;path text;
begin
 if p_status not in ('ready','failed') or p_status is null then raise exception 'Invalid callback state';end if;
 select a0.* into a from public.video_assets a0 join public.video_processing_jobs j0 on j0.asset_id=a0.id where j0.id=p_job for update of a0;
 if not found then raise exception 'Unknown media job';end if;
 select * into j from public.video_processing_jobs where id=p_job for update;
 if j.status<>'processing' then if j.status<>p_status then raise exception 'Conflicting completion';end if;return jsonb_build_object('jobId',j.id,'status',j.status,'reused',true);end if;
 if a.status<>'processing' or a.recording_consent<>'granted' or a.retention_expires_at<=now() then raise exception 'Media consent, retention or state changed';end if;
 if p_status='ready' then foreach k in array j.kinds loop
  path:=j.output_prefix||k||case when k='thumbnail' then '.jpg' else '.mp4' end;
  if not exists(select 1 from storage.objects where bucket_id='match-video' and name=path) then raise exception 'Completed output missing from private storage';end if;
  insert into public.video_variants(asset_id,kind,storage_path,status) values(a.id,k,path,'ready');
 end loop;end if;
 update public.video_assets set status=p_status::public.media_status where id=a.id;
 update public.video_processing_jobs set status=p_status,completed_at=now() where id=j.id;
 return jsonb_build_object('jobId',j.id,'status',p_status,'reused',false);
end $$;
revoke all on function public.claim_video_processing(uuid,uuid) from public,anon,authenticated;
revoke all on function public.complete_video_processing(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_video_processing(uuid,uuid) to service_role;
grant execute on function public.complete_video_processing(uuid,text) to service_role;

-- ==== 20261028091454_structured_coaching_review.sql
-- Explicit grants also cover projects with permissive default table privileges.
revoke all on public.criclume_analysis_notes from anon, authenticated;
grant select, insert on public.criclume_analysis_notes to authenticated;
-- Append-only human annotations. Existing notes remain valid with null classifications.
alter table public.criclume_analysis_notes
 add column shot_type text check (shot_type in ('drive','cut','pull','hook','sweep','reverse_sweep','defence','glance','lofted','other')),
 add column bowling_line text check (bowling_line in ('outside_off','off_stump','middle_stump','leg_stump','outside_leg')),
 add column bowling_length text check (bowling_length in ('yorker','full','good','short','full_toss')),
 add column fielding_action text check (fielding_action in ('catch','drop','stop','misfield','throw','run_out','stumping')),
 add column evidence_file_id uuid references public.criclume_analysis_files(id) on delete set null,
 add column evidence_time_seconds integer check (evidence_time_seconds between 0 and 86400);
create index criclume_analysis_notes_evidence on public.criclume_analysis_notes(evidence_file_id) where evidence_file_id is not null;
-- Restrictive policy composes with the existing coach, author, tenant, match and delivery checks.
-- A retained timestamp after source deletion is provenance only, never a playable URL.
create policy analysis_notes_evidence_scope on public.criclume_analysis_notes as restrictive
 for insert to authenticated with check (
 (evidence_file_id is null and evidence_time_seconds is null)
 or exists (
   select 1 from public.criclume_analysis_files f
   where f.id=evidence_file_id and f.organisation_id=criclume_analysis_notes.organisation_id
     and f.match_id=criclume_analysis_notes.match_id and f.analysis_consent
     and f.retention_expires_at>now()
     and (evidence_time_seconds is null or f.kind='video')
 )
);
-- No updates/deletes or provider access added: source classifications cannot change scores.

-- ==== 20261028092521_match_workspace_status_cast.sql
-- CASE resolves string literals to text; cast explicitly to the match_status enum.
create or replace function public.create_match_workspace(
  p_organisation_id uuid,
  p_home_team_id uuid,
  p_away_team_id uuid,
  p_ground_id uuid,
  p_competition_id uuid,
  p_scheduled_at timestamptz,
  p_visibility public.match_visibility,
  p_batting_first_team_id uuid,
  p_overs_per_innings integer,
  p_innings_per_side integer,
  p_balls_per_over integer,
  p_weather jsonb,
  p_public_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
  v_innings public.innings;
  v_rule_id uuid;
  v_scoreboard_slug text;
  v_home_players integer;
  v_away_players integer;
begin
  if not public.has_org_role(
    p_organisation_id,
    array['owner', 'league_admin', 'club_admin', 'scorer']::public.platform_role[]
  ) then
    raise exception 'not authorised to create matches' using errcode = '42501';
  end if;
  if p_home_team_id = p_away_team_id then
    raise exception 'home and away teams must be different' using errcode = '22023';
  end if;
  if p_batting_first_team_id is null
    or p_batting_first_team_id not in (p_home_team_id, p_away_team_id) then
    raise exception 'batting-first team must play in this match' using errcode = '22023';
  end if;
  if p_overs_per_innings is not null and p_overs_per_innings < 1 then
    raise exception 'overs must be positive' using errcode = '22023';
  end if;
  if p_innings_per_side is null
    or p_innings_per_side not between 1 and 2
    or p_balls_per_over is null
    or p_balls_per_over not between 4 and 8 then
    raise exception 'innings or balls-per-over setting is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.teams
    where id = p_home_team_id and organisation_id = p_organisation_id
  ) or not exists (
    select 1 from public.teams
    where id = p_away_team_id and organisation_id = p_organisation_id
  ) then
    raise exception 'both teams must belong to the selected organisation' using errcode = '23503';
  end if;
  if p_ground_id is not null and not exists (
    select 1 from public.grounds
    where id = p_ground_id and organisation_id = p_organisation_id
  ) then
    raise exception 'ground must belong to the selected organisation' using errcode = '23503';
  end if;
  if p_competition_id is not null then
    select rv.id into v_rule_id
    from public.competitions c
    join public.competition_rule_versions rv
      on rv.competition_id = c.id and rv.version = c.active_rule_version
    where c.id = p_competition_id and c.organisation_id = p_organisation_id;
    if not found then
      raise exception 'competition or active rule version was not found' using errcode = '23503';
    end if;
  end if;

  select count(*) into v_home_players
  from public.team_players
  where team_id = p_home_team_id
    and valid_from <= current_date
    and (valid_until is null or valid_until >= current_date);
  select count(*) into v_away_players
  from public.team_players
  where team_id = p_away_team_id
    and valid_from <= current_date
    and (valid_until is null or valid_until >= current_date);
  if v_home_players < 2 or v_away_players < 2 then
    raise exception 'each team needs at least two active registered players' using errcode = '23514';
  end if;

  insert into public.matches (
    owner_organisation_id,
    competition_id,
    rule_version_id,
    home_team_id,
    away_team_id,
    ground_id,
    status,
    visibility,
    scheduled_at,
    weather,
    live_state,
    created_by
  ) values (
    p_organisation_id,
    p_competition_id,
    v_rule_id,
    p_home_team_id,
    p_away_team_id,
    p_ground_id,
    (case when p_scheduled_at is null then 'draft' else 'scheduled' end)::public.match_status,
    p_visibility,
    p_scheduled_at,
    coalesce(p_weather, '{}'::jsonb),
    jsonb_build_object(
      'runs', 0,
      'wickets', 0,
      'overs', '0.0',
      'settings', jsonb_build_object(
        'oversPerInnings', p_overs_per_innings,
        'inningsPerSide', p_innings_per_side,
        'ballsPerOver', p_balls_per_over
      )
    ),
    (select auth.uid())
  ) returning * into v_match;

  insert into public.match_squads (match_id, team_id, player_id)
  select v_match.id, tp.team_id, tp.player_id
  from public.team_players tp
  where tp.team_id in (p_home_team_id, p_away_team_id)
    and tp.valid_from <= current_date
    and (tp.valid_until is null or tp.valid_until >= current_date);

  insert into public.innings (
    match_id,
    innings_number,
    batting_team_id,
    bowling_team_id,
    status
  ) values (
    v_match.id,
    1,
    p_batting_first_team_id,
    case when p_batting_first_team_id = p_home_team_id then p_away_team_id else p_home_team_id end,
    'not_started'
  ) returning * into v_innings;

  if p_visibility = 'public' then
    v_scoreboard_slug := lower(trim(coalesce(nullif(p_public_slug, ''), encode(extensions.gen_random_bytes(8), 'hex'))));
    if v_scoreboard_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
      raise exception 'public scoreboard slug is invalid' using errcode = '22023';
    end if;
    insert into public.public_scoreboards (match_id, slug, enabled)
    values (v_match.id, v_scoreboard_slug, true);
  end if;

  return jsonb_build_object(
    'matchId', v_match.id,
    'inningsId', v_innings.id,
    'scoreboardSlug', v_scoreboard_slug
  );
end;
$$;

-- ==== 20261028115016_current_delivery_observations.sql
-- Compose with the existing author, coach-role, tenant, match and source checks.
create policy analysis_notes_current_delivery on public.criclume_analysis_notes as restrictive
 for insert to authenticated with check (
   delivery_id is null or exists (
     select 1 from public.deliveries d
     where d.id=delivery_id and d.match_id=criclume_analysis_notes.match_id
       and d.superseded_by is null and d.voided_by_event_id is null
   )
 );
-- Existing observations remain readable for historical review; no writes to scores.

-- ==== 20261028152814_idempotent_organisation_creation.sql
-- Nullable for existing organisations and older clients. Retries are scoped to the creator.
alter table public.organisations add column creation_request_id uuid;
alter table public.organisations add constraint organisations_creator_request_key unique (created_by, creation_request_id);

create function public.preserve_organisation_creation_request()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.creation_request_id is distinct from new.creation_request_id
     or (old.creation_request_id is not null and old.created_by is distinct from new.created_by) then
    raise exception 'Organisation creation identity cannot be changed.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger preserve_organisation_creation_request before update on public.organisations
for each row execute function public.preserve_organisation_creation_request();
revoke all on function public.preserve_organisation_creation_request() from public, anon, authenticated;

create function public.create_organisation_once(p_request_id uuid, p_name text, p_kind public.organisation_kind)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(p_name);
  v_existing public.organisations%rowtype;
  v_constraint text;
begin
  if v_user is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_request_id is null or p_kind is null or v_name is null or char_length(v_name) not between 2 and 120 then
    raise exception 'A request ID, organisation type and name of 2 to 120 characters are required.' using errcode = '22023';
  end if;
  begin
    insert into public.organisations(kind, name, slug, created_by, creation_request_id)
  values(p_kind, v_name, 'org-' || gen_random_uuid()::text, v_user, p_request_id)
    ;
  exception when unique_violation then
    -- The unique request constraint serialises concurrent retries. RLS is
    -- checked when the winning row is read below; never return a hidden row.
    get stacked diagnostics v_constraint = CONSTRAINT_NAME;
    if v_constraint <> 'organisations_creator_request_key' then raise; end if;
  end;
  -- This statement runs after any conflicting insert commits. RLS still applies.
  select * into v_existing from public.organisations
    where created_by = v_user and creation_request_id = p_request_id;
  if not found then raise exception 'Organisation access is unavailable.' using errcode = '42501'; end if;
  if v_existing.name <> v_name or v_existing.kind <> p_kind then
    raise exception 'This request was already used for different organisation details.' using errcode = '22023';
  end if;
  return v_existing.id;
end;
$$;
revoke all on function public.create_organisation_once(uuid,text,public.organisation_kind) from public, anon;
grant execute on function public.create_organisation_once(uuid,text,public.organisation_kind) to authenticated;
