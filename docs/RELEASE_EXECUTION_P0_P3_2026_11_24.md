# CricLume P0–P3 release acceptance — 24 November 2026

This checklist distinguishes **merged source**, **deployed code**, **field-tested features**, and **certified launch**. No successful GitHub build or dashboard badge alone certifies a live service. The project has a Lovable-bound database; **never create a replacement or deploy CricLume to the unrelated Dishbee project**.

## Status at audit

- GitHub + Lovable source matched commit `4dbcc7a89c83c620e37b63d204e595b57834bb57` on 24 Nov; that commit's **quality workflow failed** at TypeScript `src/lib/cloud.ts:609` due to a nested Web Locks Promise. P0 fix is in PR #74; require the new commit to pass before promotion.
- Lovable SQL read-back: **125 public tables**, **all 125 RLS-enabled**, **328 policies**, **48 Drizzle migration ledger rows**, including `matches`, `match_events`, private media, live camera, billing and academy records. The connected database is real and contains **1 match, 15 match events, no subscriptions or cloud recordings** at time of inspection. RLS existence does not imply all policies are correct; negative tests remain essential.
- The separate Supabase tool exposed Dishbee, not CricLume. Treat the Lovable connection as the preferred source and reconcile its runtime URL/project ID before releasing.
- The 23 Nov backup-monitor schedule failed at the **missing monitor credential check**, not at database restore or proven backup absence. Supply a read-only `backups_read` token for the correct project or demonstrate equivalent Lovable-native backup monitoring. Test database *and* Storage restores.
- Native Android/iOS directories and signed binaries were absent. PWA installation is implemented; this is **not an approved App Store/Play Store native application**.
- User-facing plans/roadmap contain pending pricing and payment-provider decisions. Tickets, fees and merchandise use separately approved bank/wallet transfer, not automatic card checkout.

## Phase P0 — release foundation

- [ ] Require green current-head GitHub TypeScript, scoring tests, lint, production build, security, Edge and media-worker workflows.
- [ ] Verify Lovable production domain, active project ID, deployed commit, migration ledger parity and all server-function responses. Resolve any divergence *without deleting/replacing existing data*.
- [ ] Check authentication, recovery, MFA for privileged people, invites, role changes and tenant-scoped RLS from **two real clubs**.
- [ ] Verify managed backup/PITR, independent private-media backup, recent recovery point and exercise full restore to isolated infrastructure.
- [ ] Obtain approved privacy/guardian/video consent, DPIA, data-processing agreements, complaints/contact channels and incident-response drills.

## Phase P1 — working SaaS and field pilot

- [ ] Complete an entire cricket match with two scorers, including no-balls, wides, wicket, over boundaries, innings changes, tie/super-over where applicable, undo/corrections and source-of-truth scorecards.
- [ ] Repeat airplane-mode/device sleep/reconnect, lock contention, sign-in renewal and two-tab conflict; compare result against an independent hand scorebook.
- [ ] Verify public scoreboard and widget via anonymous spectator, including no private junior identifiers and lawful photos.
- [ ] Test club/league joins, fixtures/standings, academy attendance, training, guardian accounts, umpire workflows, booking requests and ticket/transfer acknowledgements.
- [ ] Test mobile Safari, Android Chrome, tablet and desktop for screen overflow, keyboard, focus, contrast and touch targets.
- [ ] Secure product-owner sign-off and documented two-organisation field pilot.

## Phase P2 — commercial, communication and advanced media

- [ ] Make an explicit business decision for **SaaS subscriptions** and country/region pricing; distinguish this from club fee/ticket transfers. Do not activate Paddle/Stripe until pricing, refunds, tax and webhook reconciliation are approved.
- [ ] Verify payment -> entitlement -> cancellation/reactivation against the real processor; only then enable paid plan locks and equivalent database/server checks for cameras and AI.
- [ ] Configure `criclume.com` sending domain, deliverability and bounce handling; provision SMS/WhatsApp provider and approved templates for paid recipients only; schedule cron jobs with scoped credentials.
- [ ] Test consented private LiveKit multi-camera capture, long recording interruptions, S3 integrity, blur, private library read, retention/withdrawal, deletion, and 2–4 camera drift.
- [ ] Keep paid AI disabled until bounded worker receipt/cost/consent checks pass; keep unlicensed DLS disabled. Verify public club custom domains, alerts, monitoring and LED controller hardware when available.
- [ ] Test sponsor/advertising consent and payout reporting before paid rollout.

## Phase P3 — native mobile distribution

- [ ] Build actual native iOS and Android capture clients or audited native bridge (not a remote WebView alone), including background/lock handling, interruption, storage pressure and media permission purpose strings.
- [ ] Verify App Store Connect and Play Console organisation accounts, provisioning identities, signed release builds and reproducible delivery.
- [ ] Complete TestFlight and closed Play testing on current devices, in-app account deletion/support, store-specific subscriptions, age rating, App Privacy/Data Safety, guardian and encryption declarations.
- [ ] Do not claim native-store approval from a PWA build or screenshots.

## Release evidence gate

The manual GitHub Action **CricLume evidence-gated release acceptance** accepts `p0`, `p1`, `p2`, or `p3` and checks all preceding phases. Configure a protected `release-acceptance` GitHub environment and a private `CRICLUME_RELEASE_EVIDENCE_JSON` secret with only **non-sensitive** approval records. Each gate entry must include `passed: true`, `checkedAt` (UTC ISO timestamp), `checkedBy` (real reviewer), and a genuine HTTPS `evidenceUrl` (CI run, internal accessible test record, or approved report). Do not include raw player data, API keys or private video links.

Example **format only** (not evidence):

```json
{
  "projectRef": "eivwnjbykohrlxavvpcr",
  "releaseSha": "REPLACE_WITH_GITHUB_40_CHARACTER_SHA",
  "checks": {
    "green_main_build": {
      "passed": true,
      "checkedAt": "REPLACE_WITH_REVIEW_TIME",
      "checkedBy": "REPLACE_WITH_REVIEWER",
      "evidenceUrl": "https://github.com/asaffilate01-ship-it/app-teaser/actions"
    }
  }
}
```

The release evaluator rejects wrong project/commit, absent tests, failed checks, missing reviewer or HTTPS reference, stale backup reports (>36h), stale acceptance evidence, and any P1/P2/P3 phase without all earlier approvals. It never writes production data. Its report can be reviewed before explicit owner-controlled deploy and publication.

**Cannot be certified from GitHub alone:** actual live subscription receipts, domain/certificate validity, onsite venue hardware, guardian documentation, real filming, Apple/Google store accounts, or provider backup restores.
