# CricLume launch gates — 16 October 2026

This checklist separates code committed to GitHub from verified production service.
**Do not mark CricLume live based on source code or a Lovable preview alone.**

## Release candidate: reliability and match rules

- [x] Catch generated-code formatting drift without disabling other lint rules.
- [x] Count no-balls but not wides in batter balls faced.
- [x] Calculate maiden overs from completed legal deliveries and runs conceded.
- [x] End a single-innings chase as soon as the target is reached.
- [x] Prevent advancing to the next innings before the previous innings ends.
- [x] Preserve newly queued offline deliveries during asynchronous replay.
- [x] Stop a replay batch at the first failure to maintain event order.
- [x] Avoid applying older realtime snapshots or overwriting pending local events.
- [x] Obtain a fully green scoring/security branch CI run (16 October; re-run for Omniqora change).
- [ ] Re-test a full match on Android Chrome and iOS Safari with aircraft mode toggled.
- [ ] Check simultaneous devices, queue growth, interruption, undo and reconnect.

## Infrastructure and security — blocked on environment verification

- [ ] Verify the **existing Lovable-connected CricLume** project ref `eivwnjbykohrlxavvpcr`; do not create a duplicate or deploy to a different SaaS.
- [ ] Confirm all three SQL migrations are applied on staging and production.
- [ ] Deploy and smoke-test Edge Functions with scoped credentials.
- [ ] Verify RLS across two test organisations; check anonymous scoreboard access.
- [ ] Configure production secrets and email/Auth redirects via protected settings.
- [ ] Configure the backup monitor credentials and verify recent backups or PITR.
- [x] Resolve the failing security dependency audit without suppressing findings (passed on release PR #6).
- [ ] Verify independent backup restore (database **and** video Storage).
- [ ] Confirm the public scoreboard exposes only approved player and match fields.
- [ ] Approve privacy impact, junior safeguarding, retention and incident response.

## Omniqora Intelligence activation

- [ ] Verify and apply the CricLume AI bridge migration only to the existing Lovable-bound project.
- [ ] Issue authorised Omniqora tenant/product scoped service credential; approve club-to-tenant links.
- [ ] Verify `omniqora.intelligence-runtime` entitlement, reviewed model rates, budgets, agent worker and billing receipts.
- [ ] Configure Edge secrets, approve junior privacy safeguards, run negative tenant-isolation tests.
- [ ] Run pilot with approved coach; advisory output only, no score/video writes.

## Commercial and media readiness

- [ ] Configure the Stripe product, recurring price and signed webhook endpoint.
- [ ] Test trial, payment, cancellation, reactivation and entitlement transitions.
- [ ] Verify camera capture, resumable uploads, multiple angles and provider callbacks.
- [ ] Provide licensed rain rules before enabling DLS-related features.
- [ ] Keep AI suggestions advisory and subject to coaching review.
- [ ] Check custom DNS, TLS, published privacy/terms and production monitoring.
- [ ] Run a club pilot before opening public self-service sign-up.

## Useful repository entry points

- `src/lib/cricket.ts` — cricket rules, scoring and cards
- `src/hooks/use-match-cloud-sync.ts` — realtime and offline sync UI
- `src/lib/cloud.ts` — Supabase event queue and upload clients
- `tests/scoring-rules.test.ts` — scoring regression tests
- `tests/offline-queue.test.ts` — queue reconciliation tests
- `docs/PRODUCTION_SETUP.md` and `docs/RELEASE_CHECKLIST.md` — operations

CricLume uses a Supabase connection inside Lovable. The separately connected
Supabase workspace exposes a different project. Do not treat missing direct
access to CricLume in that workspace as evidence the Lovable connection is
absent; verify migrations, functions and live data from the authorised
Lovable project. No CricLume production migrations or secrets were changed
during the source integration.
