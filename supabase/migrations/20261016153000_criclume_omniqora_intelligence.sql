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
