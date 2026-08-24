# CricLume

**See every ball. Shape every game.**

CricLume is a cricket scoring and coaching platform in active development. This repository contains
the public product site and the first working scorer preview at `/app`.

The preview currently includes:

- match setup for limited-overs, school, club, custom and multi-innings games;
- offline ball-by-ball scoring with automatic timestamps and over counting;
- batters, bowlers, ends, delivery types, runs, extras and every requested dismissal;
- field locations, catch locations, fielders and scorer notes;
- undo, delivery audit trail, batting/bowling scorecards and JSON export;
- on-device video review with multiple angles, slow motion, frame stepping, zoom and drawing;
- deterministic data-quality checks ready for later model-assisted analysis.

The preview deliberately does not claim cloud accounts, live multi-phone synchronization, public
scoreboards, official rain-rule calculations, payments or cloud AI as finished. Those services need
the production backend, storage, licensing and privacy controls.

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
