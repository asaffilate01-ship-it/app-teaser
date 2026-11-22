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
