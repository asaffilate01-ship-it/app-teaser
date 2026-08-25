begin;

create extension if not exists pgcrypto with schema extensions;

create type public.organisation_kind as enum ('club', 'league', 'school', 'academy');
create type public.platform_role as enum (
  'owner',
  'league_admin',
  'club_admin',
  'safeguarding_officer',
  'scorer',
  'coach',
  'player',
  'viewer'
);
create type public.membership_status as enum ('invited', 'active', 'suspended', 'left');
create type public.match_status as enum (
  'draft', 'scheduled', 'live', 'innings_break', 'completed', 'abandoned', 'cancelled'
);
create type public.match_visibility as enum ('private', 'clubs', 'league', 'public');
create type public.fixture_status as enum ('draft', 'scheduled', 'postponed', 'live', 'completed', 'abandoned', 'cancelled');
create type public.consent_state as enum ('pending', 'granted', 'denied', 'withdrawn');
create type public.media_status as enum ('planned', 'uploading', 'uploaded', 'processing', 'ready', 'failed', 'quarantined', 'deleted');
create type public.job_status as enum ('queued', 'running', 'review_required', 'completed', 'failed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_path text,
  timezone text not null default 'Europe/London',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  kind public.organisation_kind not null,
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  default_retention_days integer not null default 90 check (default_retention_days between 1 and 3650),
  settings jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organisation_members (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.platform_role not null,
  status public.membership_status not null default 'active',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email_hash text not null,
  invited_email text not null,
  role public.platform_role not null,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.grounds (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  address jsonb not null default '{}'::jsonb,
  timezone text not null default 'Europe/London',
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, name)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  short_name text not null,
  age_group text,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, name)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  linked_user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  is_junior boolean not null default false,
  public_profile boolean not null default false,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.player_private_profiles (
  player_id uuid primary key references public.players(id) on delete cascade,
  date_of_birth date,
  guardian_name text,
  guardian_email text,
  medical_notes text,
  emergency_contact jsonb not null default '{}'::jsonb,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.player_consents (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  recording public.consent_state not null default 'pending',
  coaching_analysis public.consent_state not null default 'pending',
  public_highlights public.consent_state not null default 'pending',
  biometric_analysis public.consent_state not null default 'denied',
  consented_by uuid references auth.users(id),
  evidence_path text,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.team_players (
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  shirt_number text,
  valid_from date not null default current_date,
  valid_until date,
  primary key (team_id, player_id, valid_from)
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (organisation_id, name)
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null,
  format text not null check (format in ('league', 'groups', 'knockout', 'round_robin_knockout', 'friendly')),
  active_rule_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, name)
);

create table public.competition_rule_versions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  version integer not null check (version > 0),
  rules jsonb not null,
  rain_provider text,
  rain_method text,
  rain_edition text,
  rain_parameters jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null default now(),
  retired_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (competition_id, version),
  check (
    (rain_provider is null and rain_method is null and rain_edition is null)
    or (rain_provider is not null and rain_method is not null and rain_edition is not null)
  )
);

create table public.competition_entries (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  group_name text,
  seed integer,
  status text not null default 'active' check (status in ('active', 'withdrawn', 'disqualified')),
  primary key (competition_id, team_id)
);

create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  rule_version_id uuid not null references public.competition_rule_versions(id),
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  ground_id uuid references public.grounds(id),
  round_name text,
  starts_at timestamptz,
  status public.fixture_status not null default 'draft',
  home_points numeric(7,2),
  away_points numeric(7,2),
  result jsonb not null default '{}'::jsonb,
  signed_off_by uuid references auth.users(id),
  signed_off_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  owner_organisation_id uuid not null references public.organisations(id) on delete restrict,
  fixture_id uuid unique references public.fixtures(id) on delete set null,
  competition_id uuid references public.competitions(id) on delete set null,
  rule_version_id uuid references public.competition_rule_versions(id) on delete set null,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  ground_id uuid references public.grounds(id),
  status public.match_status not null default 'draft',
  visibility public.match_visibility not null default 'private',
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  weather jsonb not null default '{}'::jsonb,
  live_state jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create table public.match_assignments (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.platform_role not null check (role in ('scorer', 'coach', 'viewer', 'safeguarding_officer')),
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (match_id, user_id, role)
);

create table public.match_squads (
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  player_id uuid not null references public.players(id),
  captain boolean not null default false,
  wicketkeeper boolean not null default false,
  batting_position integer,
  primary key (match_id, team_id, player_id)
);

create table public.innings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  innings_number integer not null check (innings_number > 0),
  batting_team_id uuid not null references public.teams(id),
  bowling_team_id uuid not null references public.teams(id),
  status text not null default 'not_started' check (status in ('not_started', 'live', 'completed', 'declared', 'forfeited')),
  runs integer not null default 0 check (runs >= 0),
  wickets integer not null default 0 check (wickets between 0 and 10),
  legal_balls integer not null default 0 check (legal_balls >= 0),
  target integer,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, innings_number),
  check (batting_team_id <> bowling_team_id)
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  innings_id uuid not null references public.innings(id) on delete cascade,
  event_id uuid,
  sequence bigint not null,
  over_number integer not null check (over_number >= 0),
  ball_in_over integer not null check (ball_in_over > 0),
  striker_id uuid not null references public.players(id),
  non_striker_id uuid not null references public.players(id),
  bowler_id uuid not null references public.players(id),
  end_name text,
  delivery_style text,
  outcome text not null,
  batter_runs integer not null default 0 check (batter_runs >= 0),
  extras jsonb not null default '{}'::jsonb,
  total_runs integer not null default 0 check (total_runs >= 0),
  legal_ball boolean not null default true,
  wicket boolean not null default false,
  dismissal jsonb,
  shot_zone text,
  fielding_zone text,
  fielder_id uuid references public.players(id),
  notes text,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id),
  superseded_by uuid references public.deliveries(id),
  unique (match_id, sequence)
);

create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sequence bigint not null,
  client_event_id uuid not null,
  device_id text not null,
  event_type text not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id),
  unique (match_id, sequence),
  unique (match_id, client_event_id)
);

alter table public.deliveries
  add constraint deliveries_event_fk foreign key (event_id) references public.match_events(id) on delete restrict;

create table public.public_scoreboards (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  enabled boolean not null default false,
  delay_seconds integer not null default 0 check (delay_seconds between 0 and 1800),
  sponsor jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.camera_rooms (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  name text not null default 'Match camera room',
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  max_devices integer not null default 4 check (max_devices between 1 and 8),
  opened_by uuid not null references auth.users(id),
  opened_at timestamptz not null default now(),
  closes_at timestamptz,
  unique (match_id, name)
);

create table public.camera_pairing_tokens (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.camera_rooms(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  uses_remaining integer not null default 4 check (uses_remaining >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.camera_devices (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.camera_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key text not null,
  label text not null,
  angle text not null check (angle in ('pavilion_end', 'far_end', 'off_side', 'leg_side', 'roaming', 'other')),
  clock_offset_ms integer not null default 0,
  clock_round_trip_ms integer,
  status jsonb not null default '{}'::jsonb,
  last_heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (room_id, device_key)
);

create table public.video_assets (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  room_id uuid not null references public.camera_rooms(id) on delete cascade,
  device_id uuid not null references public.camera_devices(id) on delete restrict,
  storage_path text unique,
  source_sha256 text,
  content_type text not null default 'video/webm',
  size_bytes bigint check (size_bytes >= 0),
  started_at timestamptz not null,
  ended_at timestamptz,
  status public.media_status not null default 'planned',
  recording_consent public.consent_state not null default 'pending',
  publication_consent public.consent_state not null default 'pending',
  includes_junior boolean not null default false,
  blur_mode text not null default 'none' check (blur_mode in ('none', 'faces', 'people')),
  retention_expires_at timestamptz not null,
  legal_hold boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.video_variants (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.video_assets(id) on delete cascade,
  kind text not null check (kind in ('source', 'proxy', 'thumbnail', 'highlight', 'blurred')),
  storage_path text not null unique,
  width integer,
  height integer,
  duration_ms integer,
  frame_rate numeric(8,3),
  codec text,
  status public.media_status not null default 'processing',
  created_at timestamptz not null default now(),
  unique (asset_id, kind)
);

create table public.delivery_media_links (
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  asset_id uuid not null references public.video_assets(id) on delete cascade,
  offset_start_ms integer not null,
  offset_end_ms integer not null,
  confidence numeric(5,4) not null default 1 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (delivery_id, asset_id),
  check (offset_start_ms >= 0 and offset_end_ms > offset_start_ms)
);

create table public.video_annotations (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.video_assets(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  at_ms integer not null check (at_ms >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  drawing jsonb not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  asset_id uuid references public.video_assets(id) on delete cascade,
  job_type text not null check (job_type in ('scoring_audit', 'video_analysis', 'blur', 'coaching_summary')),
  model_provider text not null,
  model_name text not null,
  model_version text not null,
  input_manifest jsonb not null,
  consent_snapshot jsonb not null,
  status public.job_status not null default 'queued',
  requested_by uuid not null references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.ai_findings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_jobs(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  finding_type text not null,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  evidence jsonb not null,
  suggestion jsonb not null,
  reviewer_decision text check (reviewer_decision in ('accepted', 'rejected', 'edited')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.rain_calculations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  rule_version_id uuid not null references public.competition_rule_versions(id),
  provider text not null,
  method text not null,
  edition text not null,
  provider_calculation_id text,
  inputs jsonb not null,
  result jsonb not null,
  response_hash text not null,
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'starter',
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  entitlements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_events (
  id text primary key,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email', 'push')),
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  organisation_id uuid references public.organisations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id text not null,
  before_state jsonb,
  after_state jsonb,
  request_id text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create table public.security_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  organisation_id uuid references public.organisations(id) on delete set null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index organisation_members_user_idx on public.organisation_members (user_id, status);
create index players_org_idx on public.players (organisation_id, display_name);
create index fixtures_competition_start_idx on public.fixtures (competition_id, starts_at);
create index matches_org_status_idx on public.matches (owner_organisation_id, status, scheduled_at);
create index innings_match_idx on public.innings (match_id, innings_number);
create index deliveries_match_sequence_idx on public.deliveries (match_id, sequence);
create unique index deliveries_event_unique_idx on public.deliveries (event_id) where event_id is not null;
create index deliveries_batter_idx on public.deliveries (striker_id, occurred_at);
create index deliveries_bowler_idx on public.deliveries (bowler_id, occurred_at);
create index match_events_match_sequence_idx on public.match_events (match_id, sequence);
create index video_assets_retention_idx on public.video_assets (retention_expires_at) where legal_hold = false;
create index ai_jobs_status_idx on public.ai_jobs (status, created_at);
create index notifications_pending_idx on public.notifications (scheduled_for) where delivered_at is null and failed_at is null;
create index audit_log_org_created_idx on public.audit_log (organisation_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger organisations_updated_at before update on public.organisations for each row execute function public.set_updated_at();
create trigger grounds_updated_at before update on public.grounds for each row execute function public.set_updated_at();
create trigger teams_updated_at before update on public.teams for each row execute function public.set_updated_at();
create trigger players_updated_at before update on public.players for each row execute function public.set_updated_at();
create trigger competitions_updated_at before update on public.competitions for each row execute function public.set_updated_at();
create trigger fixtures_updated_at before update on public.fixtures for each row execute function public.set_updated_at();
create trigger matches_updated_at before update on public.matches for each row execute function public.set_updated_at();
create trigger innings_updated_at before update on public.innings for each row execute function public.set_updated_at();
create trigger public_scoreboards_updated_at before update on public.public_scoreboards for each row execute function public.set_updated_at();
create trigger video_assets_updated_at before update on public.video_assets for each row execute function public.set_updated_at();
create trigger video_annotations_updated_at before update on public.video_annotations for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_row jsonb;
  v_organisation_id uuid;
  v_entity_id text;
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
    v_row := v_after;
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_row := v_after;
  else
    v_before := to_jsonb(old);
    v_row := v_before;
  end if;
  v_organisation_id := nullif(v_row ->> tg_argv[0], '')::uuid;
  v_entity_id := coalesce(v_row ->> 'id', v_row ->> 'user_id', 'unknown');
  insert into public.audit_log (
    organisation_id, actor_id, action, entity_table, entity_id, before_state, after_state, request_id
  ) values (
    v_organisation_id,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    v_before,
    v_after,
    coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-request-id'
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger audit_organisations after insert or update or delete on public.organisations
for each row execute function public.audit_row_change('id');
create trigger audit_organisation_members after insert or update or delete on public.organisation_members
for each row execute function public.audit_row_change('organisation_id');
create trigger audit_player_consents after insert or update or delete on public.player_consents
for each row execute function public.audit_row_change('organisation_id');
create trigger audit_competitions after insert or update or delete on public.competitions
for each row execute function public.audit_row_change('organisation_id');
create trigger audit_matches after insert or update or delete on public.matches
for each row execute function public.audit_row_change('owner_organisation_id');
create trigger audit_video_assets after insert or update or delete on public.video_assets
for each row execute function public.audit_row_change('organisation_id');
create trigger audit_ai_jobs after insert or update or delete on public.ai_jobs
for each row execute function public.audit_row_change('organisation_id');
create trigger audit_subscriptions after insert or update or delete on public.subscriptions
for each row execute function public.audit_row_change('organisation_id');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.activate_confirmed_memberships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.organisation_members set status = 'active', joined_at = now()
    where user_id = new.id and status = 'invited';
    update public.invitations set accepted_at = now()
    where lower(invited_email) = lower(new.email) and accepted_at is null and expires_at > now();
  end if;
  return new;
end;
$$;

create trigger on_auth_user_confirmed
after update of email_confirmed_at on auth.users
for each row execute function public.activate_confirmed_memberships();

create or replace function public.add_organisation_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organisation_members (organisation_id, user_id, role, status)
  values (new.id, new.created_by, 'owner', 'active')
  on conflict (organisation_id, user_id) do update set role = 'owner', status = 'active';
  return new;
end;
$$;

create trigger on_organisation_created
after insert on public.organisations
for each row execute function public.add_organisation_owner();

create or replace function public.is_org_member(p_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_members m
    where m.organisation_id = p_organisation_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function public.has_org_role(p_organisation_id uuid, p_roles public.platform_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_members m
    where m.organisation_id = p_organisation_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any(p_roles)
  );
$$;

create or replace function public.can_view_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and (
        public.is_org_member(m.owner_organisation_id)
        or exists (
          select 1 from public.match_assignments a
          where a.match_id = m.id and a.user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function public.can_score_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and (
        public.has_org_role(m.owner_organisation_id, array['owner', 'league_admin', 'club_admin', 'scorer']::public.platform_role[])
        or exists (
          select 1 from public.match_assignments a
          where a.match_id = m.id
            and a.user_id = (select auth.uid())
            and a.role = 'scorer'
        )
      )
  );
$$;

create or replace function public.can_access_camera_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.camera_rooms r
    where r.id = p_room_id and public.can_view_match(r.match_id)
  );
$$;

create or replace function public.can_upload_video(p_organisation_id uuid, p_room_id uuid, p_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.video_assets a
    where a.id = p_asset_id
      and a.organisation_id = p_organisation_id
      and a.room_id = p_room_id
      and a.recording_consent = 'granted'
      and a.status in ('planned', 'uploading')
      and (
        public.has_org_role(
          p_organisation_id,
          array['owner', 'league_admin', 'club_admin', 'scorer', 'coach']::public.platform_role[]
        )
        or exists (
          select 1 from public.camera_devices d
          where d.id = a.device_id and d.user_id = (select auth.uid()) and d.room_id = p_room_id
        )
      )
  );
$$;

create or replace function public.prevent_match_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'match_events are immutable; append a correction event';
end;
$$;

create trigger match_events_immutable
before update or delete on public.match_events
for each row execute function public.prevent_match_event_mutation();

create or replace function public.append_match_event(
  p_match_id uuid,
  p_client_event_id uuid,
  p_device_id text,
  p_event_type text,
  p_payload jsonb,
  p_occurred_at timestamptz
)
returns public.match_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.match_events;
  v_sequence bigint;
  v_event public.match_events;
begin
  if not public.can_score_match(p_match_id) then
    raise exception 'not authorised to score this match' using errcode = '42501';
  end if;

  select * into v_existing
  from public.match_events
  where match_id = p_match_id and client_event_id = p_client_event_id;
  if found then return v_existing; end if;

  perform 1 from public.matches where id = p_match_id for update;
  if not found then raise exception 'match not found' using errcode = 'P0002'; end if;

  select coalesce(max(sequence), 0) + 1 into v_sequence
  from public.match_events where match_id = p_match_id;

  insert into public.match_events (
    match_id, sequence, client_event_id, device_id, event_type, payload, occurred_at, recorded_by
  ) values (
    p_match_id, v_sequence, p_client_event_id, left(p_device_id, 200), left(p_event_type, 100),
    p_payload, p_occurred_at, (select auth.uid())
  ) returning * into v_event;

  if p_payload ? 'liveState' then
    update public.matches
    set live_state = p_payload -> 'liveState',
      status = case p_payload -> 'matchSnapshot' ->> 'status'
        when 'live' then 'live'::public.match_status
        when 'innings-break' then 'innings_break'::public.match_status
        when 'completed' then 'completed'::public.match_status
        else status
      end,
      started_at = coalesce(started_at, case when p_payload -> 'matchSnapshot' ->> 'status' = 'live' then now() else null end),
      completed_at = case when p_payload -> 'matchSnapshot' ->> 'status' = 'completed' then coalesce(completed_at, now()) else completed_at end,
      updated_at = now()
    where id = p_match_id;
  end if;

  return v_event;
exception
  when unique_violation then
    select * into v_existing
    from public.match_events
    where match_id = p_match_id and client_event_id = p_client_event_id;
    return v_existing;
end;
$$;

create or replace function public.record_delivery_v1(
  p_match_id uuid,
  p_innings_id uuid,
  p_client_event_id uuid,
  p_device_id text,
  p_delivery jsonb,
  p_live_state jsonb,
  p_occurred_at timestamptz
)
returns public.deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.match_events;
  v_delivery public.deliveries;
  v_extras jsonb := coalesce(p_delivery -> 'extras', '{}'::jsonb);
  v_batter_runs integer := coalesce((p_delivery ->> 'batterRuns')::integer, 0);
  v_extra_runs integer := coalesce((v_extras ->> 'wide')::integer, 0)
    + coalesce((v_extras ->> 'noBall')::integer, 0)
    + coalesce((v_extras ->> 'bye')::integer, 0)
    + coalesce((v_extras ->> 'legBye')::integer, 0)
    + coalesce((v_extras ->> 'penalty')::integer, 0);
  v_legal boolean := coalesce((p_delivery ->> 'legal')::boolean, true);
  v_wicket boolean := p_delivery ? 'dismissal' and p_delivery -> 'dismissal' <> 'null'::jsonb;
begin
  if not public.can_score_match(p_match_id) then
    raise exception 'not authorised to score this match' using errcode = '42501';
  end if;
  if not exists (select 1 from public.innings where id = p_innings_id and match_id = p_match_id) then
    raise exception 'innings does not belong to match' using errcode = '23503';
  end if;
  if not exists (
    select 1 from public.match_squads
    where match_id = p_match_id and player_id = (p_delivery ->> 'strikerId')::uuid
  ) or not exists (
    select 1 from public.match_squads
    where match_id = p_match_id and player_id = (p_delivery ->> 'nonStrikerId')::uuid
  ) or not exists (
    select 1 from public.match_squads
    where match_id = p_match_id and player_id = (p_delivery ->> 'bowlerId')::uuid
  ) then
    raise exception 'delivery players must belong to the match squad' using errcode = '23503';
  end if;
  if nullif(p_delivery ->> 'fielderId', '') is not null and not exists (
    select 1 from public.match_squads
    where match_id = p_match_id and player_id = (p_delivery ->> 'fielderId')::uuid
  ) then
    raise exception 'fielder must belong to the match squad' using errcode = '23503';
  end if;

  select d.* into v_delivery from public.deliveries d
  join public.match_events e on e.id = d.event_id
  where e.match_id = p_match_id and e.client_event_id = p_client_event_id;
  if found then return v_delivery; end if;

  v_event := public.append_match_event(
    p_match_id,
    p_client_event_id,
    p_device_id,
    'delivery.recorded',
    jsonb_build_object('delivery', p_delivery, 'liveState', p_live_state),
    p_occurred_at
  );

  insert into public.deliveries (
    match_id, innings_id, event_id, sequence, over_number, ball_in_over,
    striker_id, non_striker_id, bowler_id, end_name, delivery_style, outcome,
    batter_runs, extras, total_runs, legal_ball, wicket, dismissal,
    shot_zone, fielding_zone, fielder_id, notes, occurred_at, recorded_by
  ) values (
    p_match_id,
    p_innings_id,
    v_event.id,
    v_event.sequence,
    coalesce((p_delivery ->> 'over')::integer, 0),
    coalesce((p_delivery ->> 'ball')::integer, 1),
    (p_delivery ->> 'strikerId')::uuid,
    (p_delivery ->> 'nonStrikerId')::uuid,
    (p_delivery ->> 'bowlerId')::uuid,
    p_delivery ->> 'end',
    p_delivery ->> 'deliveryStyle',
    coalesce(p_delivery ->> 'outcome', 'not-recorded'),
    v_batter_runs,
    v_extras,
    v_batter_runs + v_extra_runs,
    v_legal,
    v_wicket,
    p_delivery -> 'dismissal',
    p_delivery ->> 'shotZone',
    p_delivery ->> 'fieldingZone',
    nullif(p_delivery ->> 'fielderId', '')::uuid,
    p_delivery ->> 'note',
    p_occurred_at,
    (select auth.uid())
  ) returning * into v_delivery;

  update public.innings set
    runs = runs + v_batter_runs + v_extra_runs,
    wickets = wickets + case when v_wicket then 1 else 0 end,
    legal_balls = legal_balls + case when v_legal then 1 else 0 end,
    status = 'live',
    started_at = coalesce(started_at, p_occurred_at),
    updated_at = now()
  where id = p_innings_id;

  return v_delivery;
end;
$$;

create or replace function public.create_camera_room(p_match_id uuid, p_name text default 'Match camera room')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.camera_rooms;
  v_token text;
  v_expires_at timestamptz := now() + interval '30 minutes';
begin
  if not public.can_score_match(p_match_id) then
    raise exception 'not authorised to create a camera room' using errcode = '42501';
  end if;
  insert into public.camera_rooms (match_id, name, opened_by, closes_at)
  values (p_match_id, coalesce(nullif(trim(p_name), ''), 'Match camera room'), (select auth.uid()), now() + interval '8 hours')
  returning * into v_room;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.camera_pairing_tokens (room_id, token_hash, expires_at, uses_remaining, created_by)
  values (v_room.id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expires_at, v_room.max_devices, (select auth.uid()));
  return jsonb_build_object('roomId', v_room.id, 'pairingToken', v_token, 'expiresAt', v_expires_at);
end;
$$;

create or replace function public.pair_camera_device(
  p_token text,
  p_device_key text,
  p_label text,
  p_angle text
)
returns public.camera_devices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pairing public.camera_pairing_tokens;
  v_device public.camera_devices;
begin
  if (select auth.uid()) is null then
    raise exception 'sign in before pairing a camera' using errcode = '42501';
  end if;
  select * into v_pairing from public.camera_pairing_tokens
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and expires_at > now()
    and uses_remaining > 0
  for update;
  if not found then raise exception 'pairing token is invalid or expired' using errcode = '22023'; end if;

  insert into public.camera_devices (room_id, user_id, device_key, label, angle)
  values (v_pairing.room_id, (select auth.uid()), left(p_device_key, 200), left(p_label, 100), p_angle)
  on conflict (room_id, device_key) do update
    set user_id = excluded.user_id, label = excluded.label, angle = excluded.angle, last_heartbeat_at = now()
  returning * into v_device;
  insert into public.match_assignments (match_id, user_id, role, assigned_by)
  select r.match_id, (select auth.uid()), 'viewer', v_pairing.created_by
  from public.camera_rooms r where r.id = v_pairing.room_id
  on conflict (match_id, user_id, role) do nothing;
  update public.camera_pairing_tokens set uses_remaining = uses_remaining - 1 where id = v_pairing.id;
  return v_device;
end;
$$;

create or replace function public.get_public_scoreboard(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'matchId', m.id,
    'status', m.status,
    'scheduledAt', m.scheduled_at,
    'startedAt', m.started_at,
    'weather', m.weather,
    'homeTeam', jsonb_build_object('id', ht.id, 'name', ht.name, 'shortName', ht.short_name),
    'awayTeam', jsonb_build_object('id', at.id, 'name', at.name, 'shortName', at.short_name),
    'ground', case when g.id is null then null else jsonb_build_object('id', g.id, 'name', g.name) end,
    'liveState', m.live_state,
    'updatedAt', m.updated_at,
    'sponsor', s.sponsor
  )
  from public.public_scoreboards s
  join public.matches m on m.id = s.match_id
  join public.teams ht on ht.id = m.home_team_id
  join public.teams at on at.id = m.away_team_id
  left join public.grounds g on g.id = m.ground_id
  where s.slug = p_slug
    and s.enabled = true
    and m.visibility = 'public'
    and m.updated_at + make_interval(secs => s.delay_seconds) <= now();
$$;

create or replace view public.player_career_stats
with (security_invoker = true)
as
with batting as (
  select striker_id as player_id,
    count(*) filter (where legal_ball) as balls_faced,
    sum(batter_runs)::bigint as runs,
    count(*) filter (where batter_runs = 4) as fours,
    count(*) filter (where batter_runs = 6) as sixes
  from public.deliveries where superseded_by is null group by striker_id
), bowling as (
  select bowler_id as player_id,
    count(*) filter (where legal_ball) as balls_bowled,
    sum(total_runs)::bigint as runs_conceded,
    count(*) filter (where wicket and coalesce(dismissal ->> 'creditedToBowler', 'false') = 'true') as wickets
  from public.deliveries where superseded_by is null group by bowler_id
), fielding as (
  select fielder_id as player_id,
    count(*) filter (where dismissal ->> 'type' = 'caught') as catches,
    count(*) filter (where dismissal ->> 'type' = 'stumped') as stumpings,
    count(*) filter (where dismissal ->> 'type' = 'run-out') as run_outs
  from public.deliveries where fielder_id is not null and superseded_by is null group by fielder_id
), ids as (
  select player_id from batting union select player_id from bowling union select player_id from fielding
)
select ids.player_id,
  coalesce(batting.runs, 0) as runs,
  coalesce(batting.balls_faced, 0) as balls_faced,
  coalesce(batting.fours, 0) as fours,
  coalesce(batting.sixes, 0) as sixes,
  coalesce(bowling.balls_bowled, 0) as balls_bowled,
  coalesce(bowling.runs_conceded, 0) as runs_conceded,
  coalesce(bowling.wickets, 0) as wickets,
  coalesce(fielding.catches, 0) as catches,
  coalesce(fielding.stumpings, 0) as stumpings,
  coalesce(fielding.run_outs, 0) as run_outs
from ids
left join batting using (player_id)
left join bowling using (player_id)
left join fielding using (player_id);

alter table public.profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;
alter table public.invitations enable row level security;
alter table public.grounds enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.player_private_profiles enable row level security;
alter table public.player_consents enable row level security;
alter table public.team_players enable row level security;
alter table public.seasons enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_rule_versions enable row level security;
alter table public.competition_entries enable row level security;
alter table public.fixtures enable row level security;
alter table public.matches enable row level security;
alter table public.match_assignments enable row level security;
alter table public.match_squads enable row level security;
alter table public.innings enable row level security;
alter table public.deliveries enable row level security;
alter table public.match_events enable row level security;
alter table public.public_scoreboards enable row level security;
alter table public.camera_rooms enable row level security;
alter table public.camera_pairing_tokens enable row level security;
alter table public.camera_devices enable row level security;
alter table public.video_assets enable row level security;
alter table public.video_variants enable row level security;
alter table public.delivery_media_links enable row level security;
alter table public.video_annotations enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.ai_findings enable row level security;
alter table public.rain_calculations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;
alter table public.security_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.organisations to authenticated;
grant select, insert, update, delete on public.organisation_members to authenticated;
grant select on public.invitations to authenticated;
grant select, insert, update, delete on public.grounds, public.teams, public.players, public.team_players to authenticated;
grant select, insert, update on public.player_private_profiles, public.player_consents to authenticated;
grant select, insert, update, delete on public.seasons, public.competitions, public.competition_rule_versions, public.competition_entries, public.fixtures to authenticated;
grant select, insert, update on public.matches, public.match_assignments, public.match_squads, public.innings, public.deliveries to authenticated;
grant select on public.match_events to authenticated;
grant select, insert, update on public.public_scoreboards, public.camera_rooms, public.camera_devices to authenticated;
grant select, insert, update on public.video_assets, public.video_variants, public.delivery_media_links, public.video_annotations to authenticated;
grant select, insert, update on public.ai_jobs, public.ai_findings, public.rain_calculations to authenticated;
grant select on public.subscriptions to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.audit_log, public.security_events, public.player_career_stats to authenticated;

create policy profiles_select_self_or_member on public.profiles for select to authenticated
using (
  id = (select auth.uid()) or exists (
    select 1 from public.organisation_members mine
    join public.organisation_members theirs on theirs.organisation_id = mine.organisation_id
    where mine.user_id = (select auth.uid()) and mine.status = 'active' and theirs.user_id = profiles.id and theirs.status = 'active'
  )
);
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy organisations_select_member on public.organisations for select to authenticated using (public.is_org_member(id));
create policy organisations_insert_authenticated on public.organisations for insert to authenticated with check (created_by = (select auth.uid()));
create policy organisations_update_admin on public.organisations for update to authenticated
using (public.has_org_role(id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]))
with check (public.has_org_role(id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]));

create policy organisation_members_select_member on public.organisation_members for select to authenticated
using (public.is_org_member(organisation_id));
create policy organisation_members_insert_admin on public.organisation_members for insert to authenticated
with check (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]));
create policy organisation_members_update_admin on public.organisation_members for update to authenticated
using (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]))
with check (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]));
create policy organisation_members_delete_admin on public.organisation_members for delete to authenticated
using (public.has_org_role(organisation_id, array['owner']::public.platform_role[]) and user_id <> (select auth.uid()));

create policy invitations_admin_select on public.invitations for select to authenticated
using (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]));

create policy grounds_member_select on public.grounds for select to authenticated using (public.is_org_member(organisation_id));
create policy grounds_admin_insert on public.grounds for insert to authenticated
with check (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]));
create policy grounds_admin_update on public.grounds for update to authenticated
using (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]))
with check (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]));
create policy grounds_admin_delete on public.grounds for delete to authenticated
using (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]));

create policy teams_member_select on public.teams for select to authenticated using (public.is_org_member(organisation_id));
create policy teams_admin_insert on public.teams for insert to authenticated
with check (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]));
create policy teams_admin_update on public.teams for update to authenticated
using (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]))
with check (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]));
create policy teams_admin_delete on public.teams for delete to authenticated
using (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]));

create policy players_member_select on public.players for select to authenticated using (public.is_org_member(organisation_id));
create policy players_admin_insert on public.players for insert to authenticated
with check (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin', 'coach']::public.platform_role[]));
create policy players_admin_update on public.players for update to authenticated
using (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin', 'coach']::public.platform_role[]))
with check (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin', 'coach']::public.platform_role[]));
create policy players_admin_delete on public.players for delete to authenticated
using (public.has_org_role(organisation_id, array['owner', 'club_admin']::public.platform_role[]));

create policy private_player_select_safeguarding on public.player_private_profiles for select to authenticated
using (exists (
  select 1 from public.players p where p.id = player_id and (
    p.linked_user_id = (select auth.uid()) or public.has_org_role(p.organisation_id, array['owner', 'safeguarding_officer']::public.platform_role[])
  )
));
create policy private_player_insert_safeguarding on public.player_private_profiles for insert to authenticated
with check (exists (
  select 1 from public.players p where p.id = player_id and public.has_org_role(p.organisation_id, array['owner', 'safeguarding_officer']::public.platform_role[])
));
create policy private_player_update_safeguarding on public.player_private_profiles for update to authenticated
using (exists (
  select 1 from public.players p where p.id = player_id and public.has_org_role(p.organisation_id, array['owner', 'safeguarding_officer']::public.platform_role[])
)) with check (exists (
  select 1 from public.players p where p.id = player_id and public.has_org_role(p.organisation_id, array['owner', 'safeguarding_officer']::public.platform_role[])
));

create policy consents_select_member on public.player_consents for select to authenticated using (public.is_org_member(organisation_id));
create policy consents_insert_safeguarding on public.player_consents for insert to authenticated
with check (public.has_org_role(organisation_id, array['owner', 'safeguarding_officer']::public.platform_role[]));
create policy consents_update_safeguarding on public.player_consents for update to authenticated
using (public.has_org_role(organisation_id, array['owner', 'safeguarding_officer']::public.platform_role[]))
with check (public.has_org_role(organisation_id, array['owner', 'safeguarding_officer']::public.platform_role[]));

create policy team_players_member_select on public.team_players for select to authenticated
using (exists (select 1 from public.teams t where t.id = team_id and public.is_org_member(t.organisation_id)));
create policy team_players_admin_insert on public.team_players for insert to authenticated
with check (exists (select 1 from public.teams t where t.id = team_id and public.has_org_role(t.organisation_id, array['owner', 'club_admin', 'coach']::public.platform_role[])));
create policy team_players_admin_update on public.team_players for update to authenticated
using (exists (select 1 from public.teams t where t.id = team_id and public.has_org_role(t.organisation_id, array['owner', 'club_admin', 'coach']::public.platform_role[])))
with check (exists (select 1 from public.teams t where t.id = team_id and public.has_org_role(t.organisation_id, array['owner', 'club_admin', 'coach']::public.platform_role[])));
create policy team_players_admin_delete on public.team_players for delete to authenticated
using (exists (select 1 from public.teams t where t.id = team_id and public.has_org_role(t.organisation_id, array['owner', 'club_admin', 'coach']::public.platform_role[])));

create policy seasons_member_select on public.seasons for select to authenticated using (public.is_org_member(organisation_id));
create policy seasons_admin_insert on public.seasons for insert to authenticated
with check (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]));
create policy seasons_admin_update on public.seasons for update to authenticated
using (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]))
with check (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]));
create policy seasons_admin_delete on public.seasons for delete to authenticated
using (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin']::public.platform_role[]));

create policy competitions_member_select on public.competitions for select to authenticated using (public.is_org_member(organisation_id));
create policy competitions_admin_insert on public.competitions for insert to authenticated
with check (public.has_org_role(organisation_id, array['owner', 'league_admin']::public.platform_role[]));
create policy competitions_admin_update on public.competitions for update to authenticated
using (public.has_org_role(organisation_id, array['owner', 'league_admin']::public.platform_role[]))
with check (public.has_org_role(organisation_id, array['owner', 'league_admin']::public.platform_role[]));
create policy competitions_admin_delete on public.competitions for delete to authenticated
using (public.has_org_role(organisation_id, array['owner', 'league_admin']::public.platform_role[]));

create policy rules_member_select on public.competition_rule_versions for select to authenticated
using (exists (select 1 from public.competitions c where c.id = competition_id and public.is_org_member(c.organisation_id)));
create policy rules_admin_insert on public.competition_rule_versions for insert to authenticated
with check (exists (select 1 from public.competitions c where c.id = competition_id and public.has_org_role(c.organisation_id, array['owner', 'league_admin']::public.platform_role[])));
create policy rules_admin_update on public.competition_rule_versions for update to authenticated
using (exists (select 1 from public.competitions c where c.id = competition_id and public.has_org_role(c.organisation_id, array['owner', 'league_admin']::public.platform_role[])))
with check (exists (select 1 from public.competitions c where c.id = competition_id and public.has_org_role(c.organisation_id, array['owner', 'league_admin']::public.platform_role[])));
create policy rules_admin_delete on public.competition_rule_versions for delete to authenticated
using (exists (select 1 from public.competitions c where c.id = competition_id and public.has_org_role(c.organisation_id, array['owner', 'league_admin']::public.platform_role[])));

create policy entries_member_select on public.competition_entries for select to authenticated
using (exists (select 1 from public.competitions c where c.id = competition_id and public.is_org_member(c.organisation_id)));
create policy entries_admin_insert on public.competition_entries for insert to authenticated
with check (exists (select 1 from public.competitions c where c.id = competition_id and public.has_org_role(c.organisation_id, array['owner', 'league_admin']::public.platform_role[])));
create policy entries_admin_update on public.competition_entries for update to authenticated
using (exists (select 1 from public.competitions c where c.id = competition_id and public.has_org_role(c.organisation_id, array['owner', 'league_admin']::public.platform_role[])))
with check (exists (select 1 from public.competitions c where c.id = competition_id and public.has_org_role(c.organisation_id, array['owner', 'league_admin']::public.platform_role[])));
create policy entries_admin_delete on public.competition_entries for delete to authenticated
using (exists (select 1 from public.competitions c where c.id = competition_id and public.has_org_role(c.organisation_id, array['owner', 'league_admin']::public.platform_role[])));

create policy fixtures_member_select on public.fixtures for select to authenticated
using (exists (select 1 from public.competitions c where c.id = competition_id and public.is_org_member(c.organisation_id)));
create policy fixtures_admin_insert on public.fixtures for insert to authenticated
with check (exists (select 1 from public.competitions c where c.id = competition_id and public.has_org_role(c.organisation_id, array['owner', 'league_admin']::public.platform_role[])));
create policy fixtures_admin_update on public.fixtures for update to authenticated
using (exists (select 1 from public.competitions c where c.id = competition_id and public.has_org_role(c.organisation_id, array['owner', 'league_admin']::public.platform_role[])))
with check (exists (select 1 from public.competitions c where c.id = competition_id and public.has_org_role(c.organisation_id, array['owner', 'league_admin']::public.platform_role[])));
create policy fixtures_admin_delete on public.fixtures for delete to authenticated
using (exists (select 1 from public.competitions c where c.id = competition_id and public.has_org_role(c.organisation_id, array['owner', 'league_admin']::public.platform_role[])));

create policy matches_member_select on public.matches for select to authenticated using (public.can_view_match(id));
create policy matches_scorer_insert on public.matches for insert to authenticated
with check (public.has_org_role(owner_organisation_id, array['owner', 'league_admin', 'club_admin', 'scorer']::public.platform_role[]));
create policy matches_scorer_update on public.matches for update to authenticated
using (public.can_score_match(id)) with check (public.can_score_match(id));

create policy assignments_match_select on public.match_assignments for select to authenticated using (public.can_view_match(match_id));
create policy assignments_match_insert on public.match_assignments for insert to authenticated
with check (public.can_score_match(match_id));
create policy assignments_match_update on public.match_assignments for update to authenticated
using (public.can_score_match(match_id)) with check (public.can_score_match(match_id));

create policy squads_match_select on public.match_squads for select to authenticated using (public.can_view_match(match_id));
create policy squads_match_insert on public.match_squads for insert to authenticated with check (public.can_score_match(match_id));
create policy squads_match_update on public.match_squads for update to authenticated using (public.can_score_match(match_id)) with check (public.can_score_match(match_id));

create policy innings_match_select on public.innings for select to authenticated using (public.can_view_match(match_id));
create policy innings_match_insert on public.innings for insert to authenticated with check (public.can_score_match(match_id));
create policy innings_match_update on public.innings for update to authenticated using (public.can_score_match(match_id)) with check (public.can_score_match(match_id));

create policy deliveries_match_select on public.deliveries for select to authenticated using (public.can_view_match(match_id));
create policy deliveries_match_insert on public.deliveries for insert to authenticated with check (public.can_score_match(match_id) and recorded_by = (select auth.uid()));
create policy deliveries_match_update on public.deliveries for update to authenticated using (public.can_score_match(match_id)) with check (public.can_score_match(match_id));

create policy match_events_match_select on public.match_events for select to authenticated using (public.can_view_match(match_id));

create policy scoreboards_match_select on public.public_scoreboards for select to authenticated using (public.can_view_match(match_id));
create policy scoreboards_match_insert on public.public_scoreboards for insert to authenticated with check (public.can_score_match(match_id));
create policy scoreboards_match_update on public.public_scoreboards for update to authenticated using (public.can_score_match(match_id)) with check (public.can_score_match(match_id));

create policy camera_rooms_match_select on public.camera_rooms for select to authenticated using (public.can_view_match(match_id));
create policy camera_rooms_match_insert on public.camera_rooms for insert to authenticated with check (public.can_score_match(match_id));
create policy camera_rooms_match_update on public.camera_rooms for update to authenticated using (public.can_score_match(match_id)) with check (public.can_score_match(match_id));

create policy camera_devices_room_select on public.camera_devices for select to authenticated using (public.can_access_camera_room(room_id));
create policy camera_devices_self_insert on public.camera_devices for insert to authenticated
with check (user_id = (select auth.uid()) and public.can_access_camera_room(room_id));
create policy camera_devices_self_update on public.camera_devices for update to authenticated
using (user_id = (select auth.uid()) or public.can_access_camera_room(room_id))
with check (user_id = (select auth.uid()) or public.can_access_camera_room(room_id));

create policy video_assets_member_select on public.video_assets for select to authenticated using (public.is_org_member(organisation_id));
create policy video_assets_capture_insert on public.video_assets for insert to authenticated
with check (
  public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin', 'scorer', 'coach']::public.platform_role[])
  or exists (
    select 1 from public.camera_devices d
    where d.id = video_assets.device_id
      and d.user_id = (select auth.uid())
      and d.room_id = video_assets.room_id
  )
);
create policy video_assets_capture_update on public.video_assets for update to authenticated
using (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin', 'scorer', 'coach', 'safeguarding_officer']::public.platform_role[]))
with check (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin', 'scorer', 'coach', 'safeguarding_officer']::public.platform_role[]));

create policy video_variants_member_select on public.video_variants for select to authenticated
using (exists (select 1 from public.video_assets a where a.id = asset_id and public.is_org_member(a.organisation_id)));
create policy video_variants_admin_insert on public.video_variants for insert to authenticated
with check (exists (select 1 from public.video_assets a where a.id = asset_id and public.has_org_role(a.organisation_id, array['owner', 'club_admin', 'coach', 'safeguarding_officer']::public.platform_role[])));
create policy video_variants_admin_update on public.video_variants for update to authenticated
using (exists (select 1 from public.video_assets a where a.id = asset_id and public.has_org_role(a.organisation_id, array['owner', 'club_admin', 'coach', 'safeguarding_officer']::public.platform_role[])))
with check (exists (select 1 from public.video_assets a where a.id = asset_id and public.has_org_role(a.organisation_id, array['owner', 'club_admin', 'coach', 'safeguarding_officer']::public.platform_role[])));

create policy media_links_match_select on public.delivery_media_links for select to authenticated
using (exists (select 1 from public.deliveries d where d.id = delivery_id and public.can_view_match(d.match_id)));
create policy media_links_match_insert on public.delivery_media_links for insert to authenticated
with check (exists (select 1 from public.deliveries d where d.id = delivery_id and public.can_score_match(d.match_id)));
create policy media_links_match_update on public.delivery_media_links for update to authenticated
using (exists (select 1 from public.deliveries d where d.id = delivery_id and public.can_score_match(d.match_id)))
with check (exists (select 1 from public.deliveries d where d.id = delivery_id and public.can_score_match(d.match_id)));

create policy annotations_asset_select on public.video_annotations for select to authenticated
using (exists (select 1 from public.video_assets a where a.id = asset_id and public.is_org_member(a.organisation_id)));
create policy annotations_author_insert on public.video_annotations for insert to authenticated
with check (author_id = (select auth.uid()) and exists (select 1 from public.video_assets a where a.id = asset_id and public.is_org_member(a.organisation_id)));
create policy annotations_author_update on public.video_annotations for update to authenticated
using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

create policy ai_jobs_member_select on public.ai_jobs for select to authenticated using (public.is_org_member(organisation_id));
create policy ai_jobs_coach_insert on public.ai_jobs for insert to authenticated
with check (requested_by = (select auth.uid()) and public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin', 'coach', 'safeguarding_officer']::public.platform_role[]));
create policy ai_jobs_reviewer_update on public.ai_jobs for update to authenticated
using (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin', 'coach', 'safeguarding_officer']::public.platform_role[]))
with check (public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin', 'coach', 'safeguarding_officer']::public.platform_role[]));

create policy ai_findings_member_select on public.ai_findings for select to authenticated
using (exists (select 1 from public.ai_jobs j where j.id = job_id and public.is_org_member(j.organisation_id)));
create policy ai_findings_reviewer_update on public.ai_findings for update to authenticated
using (exists (select 1 from public.ai_jobs j where j.id = job_id and public.has_org_role(j.organisation_id, array['owner', 'club_admin', 'coach', 'safeguarding_officer']::public.platform_role[])))
with check (exists (select 1 from public.ai_jobs j where j.id = job_id and public.has_org_role(j.organisation_id, array['owner', 'club_admin', 'coach', 'safeguarding_officer']::public.platform_role[])));

create policy rain_match_select on public.rain_calculations for select to authenticated using (public.can_view_match(match_id));
create policy rain_scorer_insert on public.rain_calculations for insert to authenticated with check (public.can_score_match(match_id) and created_by = (select auth.uid()));
create policy rain_scorer_update on public.rain_calculations for update to authenticated using (public.can_score_match(match_id)) with check (public.can_score_match(match_id));

create policy subscriptions_admin_select on public.subscriptions for select to authenticated
using (public.has_org_role(organisation_id, array['owner', 'club_admin', 'league_admin']::public.platform_role[]));

create policy notifications_self_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_self_update on public.notifications for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy audit_admin_select on public.audit_log for select to authenticated
using (organisation_id is not null and public.has_org_role(organisation_id, array['owner', 'league_admin', 'club_admin', 'safeguarding_officer']::public.platform_role[]));
create policy security_owner_select on public.security_events for select to authenticated
using (user_id = (select auth.uid()) or (organisation_id is not null and public.has_org_role(organisation_id, array['owner']::public.platform_role[])));

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.platform_role[]) to authenticated;
grant execute on function public.can_view_match(uuid) to authenticated;
grant execute on function public.can_score_match(uuid) to authenticated;
grant execute on function public.can_access_camera_room(uuid) to authenticated;
grant execute on function public.append_match_event(uuid, uuid, text, text, jsonb, timestamptz) to authenticated;
grant execute on function public.record_delivery_v1(uuid, uuid, uuid, text, jsonb, jsonb, timestamptz) to authenticated;
grant execute on function public.create_camera_room(uuid, text) to authenticated;
grant execute on function public.pair_camera_device(text, text, text, text) to authenticated;
grant execute on function public.get_public_scoreboard(text) to anon, authenticated;

create policy camera_realtime_read on realtime.messages for select to authenticated
using (
  (select realtime.topic()) ~ '^camera:[0-9a-fA-F-]{36}$'
  and realtime.messages.extension in ('broadcast', 'presence')
  and public.can_access_camera_room(split_part((select realtime.topic()), ':', 2)::uuid)
);
create policy camera_realtime_write on realtime.messages for insert to authenticated
with check (
  (select realtime.topic()) ~ '^camera:[0-9a-fA-F-]{36}$'
  and realtime.messages.extension in ('broadcast', 'presence')
  and public.can_access_camera_room(split_part((select realtime.topic()), ':', 2)::uuid)
);

alter table public.match_events replica identity full;
alter table public.matches replica identity full;
alter table public.innings replica identity full;
alter table public.camera_devices replica identity full;
alter publication supabase_realtime add table public.match_events, public.matches, public.innings, public.camera_devices, public.ai_jobs, public.notifications;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'match-video',
  'match-video',
  false,
  21474836480,
  array['video/webm', 'video/mp4', 'video/quicktime', 'image/jpeg', 'image/png']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy match_video_member_read on storage.objects for select to authenticated
using (
  bucket_id = 'match-video'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);
create policy match_video_consented_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'match-video'
  and array_length(storage.foldername(name), 1) >= 3
  and public.can_upload_video(
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[2])::uuid,
    ((storage.foldername(name))[3])::uuid
  )
);
create policy match_video_admin_update on storage.objects for update to authenticated
using (
  bucket_id = 'match-video'
  and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner', 'club_admin', 'league_admin', 'safeguarding_officer']::public.platform_role[])
)
with check (
  bucket_id = 'match-video'
  and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner', 'club_admin', 'league_admin', 'safeguarding_officer']::public.platform_role[])
);
create policy match_video_admin_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'match-video'
  and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner', 'safeguarding_officer']::public.platform_role[])
);

commit;
