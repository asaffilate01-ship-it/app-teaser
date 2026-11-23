create table public.match_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  scoreboard_id uuid not null references public.public_scoreboards(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 20 and 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 80 and 100),
  auth text not null check (char_length(auth) between 16 and 30),
  kinds text[] not null default array['wickets','milestones','results']::text[]
    check (kinds <@ array['wickets','milestones','results']::text[] and cardinality(kinds) between 1 and 3),
  failures integer not null default 0,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  unique (scoreboard_id, endpoint)
);

grant all on public.match_push_subscriptions to service_role;

alter table public.match_push_subscriptions enable row level security;
-- No policies: only the app's server code (after its own checks) reads or writes these rows.

create index match_push_subscriptions_board_idx on public.match_push_subscriptions (scoreboard_id);