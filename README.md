# CricLume

**See every ball. Shape every game.**

CricLume is a cricket scoring and coaching platform in active development. This repository contains
the public product site, the working scorer at `/app`, the cloud control centre at `/platform`, public
scoreboards and the production Supabase backend definition.

The preview currently includes:

- match setup for limited-overs, school, club, custom and multi-innings games;
- offline ball-by-ball scoring with automatic timestamps and over counting;
- batters, bowlers, ends, delivery types, runs, extras and every requested dismissal;
- field locations, catch locations, fielders and scorer notes;
- undo, delivery audit trail, batting/bowling scorecards and JSON export;
- on-device video review with multiple angles, slow motion, frame stepping, zoom and drawing;
- deterministic data-quality checks ready for later model-assisted analysis.

The production layer now includes:

- Supabase Auth/Postgres tenancy for clubs, schools, academies and leagues, with role-based RLS;
- idempotent append-only scoring events, offline queueing and realtime synchronization between phones;
- private multi-phone camera rooms and resumable video uploads with retention, consent and blur policy;
- live public scoreboard RPC/routes, fixtures, round-robin/knockout generation and versioned rule packs;
- batter, bowler and fielder career aggregation;
- server-side adapters for Stripe, email, licensed rain rules, video processing and advisory AI review;
- PWA installation, security headers, CodeQL/dependency/database checks and managed-backup monitoring.

External integrations remain disabled until the owner's Supabase, Stripe, email, video, AI,
monitoring and authorised rain-rule credentials are configured. Native app-store binaries still need
native capture work, signing identities and store accounts; see `docs/PRODUCTION_SETUP.md` and
`docs/RELEASE_CHECKLIST.md`.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://app-teaser.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4fdd88f7-86ce-40f6-8f36-03dbb58cdac2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? Use Bun (matching the committed lockfile) and Node.js 24 for the scoring
engine test command.

```sh
git clone https://github.com/asaffilate01-ship-it/app-teaser.git
cd app-teaser
bun install
cp .env.example .env.local
bun run dev
```

## Quality checks

```sh
bun run typecheck
bun run test
bun run lint
bun run build
```

GitHub Actions runs the same checks on pushes and pull requests.
