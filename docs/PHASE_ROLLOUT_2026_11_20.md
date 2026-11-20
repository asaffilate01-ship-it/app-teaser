# CricLume — staged P0 to P5 release implementation (20 November 2026)

Owner-approved scope: improve the existing `asaffilate01-ship-it/app-teaser` and published Lovable project. **Never create or use a replacement Supabase project.** Reference: `eivwnjbykohrlxavvpcr`.

## P0 — reliability / release gates

Implemented in this branch:
- Rename deprecated `[inbucket]` to `[local_smtp]`, update GitHub database security CI to use Mailpit and Supabase CLI v3.
- Make the *manual* production backend workflow explicit about `--remote`, `--yes` and target project identity. This branch does not run the production deploy.
- Keep daily backup monitoring fail-closed and scoped to CricLume; the existing GitHub Actions run requires operator-provisioned `SUPABASE_ACCESS_TOKEN` (minimum `backups_read`) and `SUPABASE_PROJECT_REF`.
- Provide a versioned public offline fallback page for the PWA. No private dashboards, personal video, coaching notes or authentication responses are cached by the service worker.
- Add a checked-in SVG icon fallback; existing Lovable-managed PNG logo and PWA icon assets must still be checked for parity with the GitHub source and on the deployed custom domain.

**Still required before production sign-off:**
1. Confirm the Lovable-connected database is healthy and migration history matches the release. Do not use the separately connected Dishbee Supabase project.
2. Verify Edge Functions and signed callbacks, service credentials, storage access controls, remote RLS, MFA, email and Stripe lifecycle.
3. Configure backup-monitor credentials; verify an actual *database and private media* restore, not merely backup presence.
4. Check logo and icon URLs at both Lovable and the approved public domain; validate DNS, canonical URLs, consent/privacy and error monitoring.
5. Run iPhone Safari and Android Chrome offline scoring pilots. A generic offline navigation fallback is **not** equivalent to a certified cold-start offline scorer.
6. Review GitHub Actions database tests, typecheck, lint, unit tests, build and production dependency audit. Keep release blocked when a required job fails.

## P1 — mobile + desktop usability

Implemented in this branch:
- The club workspace replaces its mobile-only section dropdown with four one-tap actions: Overview, Competitions, Capture and Analysis. The remaining sections stay accessible through an accessible keyboard-operated More menu, and the selected section is visible.
- The mobile scoring view keeps runs/wickets, overs, striker, bowler and exact device/cloud sync status visible when scrolling through controls.
- Reserve space for mobile safe-area and navigation to avoid hiding the final dashboard content.
- Keep the existing desktop workspace navigation and full scoring engine unchanged.

Acceptance:
- Tap through all eight role-based sections using keyboard, VoiceOver and TalkBack; use `Back` and URL reload; test short, long and translated labels.
- Score and undo an entire innings at widths 320/375/390/768/1024/1440px, check landscape orientation, soft keyboard, zoom and safe-area.
- Verify no duplicate ball events, obscured controls, falsely positive sync labels or accidental data loss.
- Review the public homepage and complex analysis page visually against the live deployment; component/source review does not substitute for device testing.

## P2 — authoritative scoring and match reliability (next gate)

- Reproduce two-device scorer conflicts, including concurrent offline edits, stale tabs, innings transitions, undo and scoring handover.
- Define server-owned match revision and a reconciliation UX: accept canonical events, pause conflicting writes, retain user work for review, never silently overwrite authoritative scores.
- Version cricket rule packs and regression tests for all formats, extras, run outs, super overs, interruptions and scorecard corrections.
- Verify load and accessibility of public scoreboards with anonymous, club and guardian accounts.
- Do not deploy a conflict migration until staging replay and backward compatibility pass.

## P3 — video and coaching evidence

- Validate consent and junior safeguarding before storing, sharing or processing video. Respect withdrawal and retention.
- Align multi-angle camera timestamps with validated deliveries and attach correction/version history to human observations.
- Generate reviewable clip proposals, reports and highlights; separate official match facts from suggested analysis.
- Never claim measured speed, trajectory or automated video inference without calibrated evidence.

## P4 — budgeted, read-only agentic AI

- Activate only through reviewed CricLume↔Omniqora club/tenant mappings with server-side secrets.
- Build and certify a dedicated, bounded `criclume.budgeted.readonly` worker; no generic writable model agent.
- Compare model suggestions with trusted delivery evidence and human corrections; record model version, confidence, source revision and usage receipts.
- Test cross-tenant access denial, junior/PII minimisation, prompt injection, rate limits and rollback.
- Keep `OMNIQORA_CRICLUME_PAID_ENABLED=false` until approval and real receipt reconciliation.

## P5 — league and academy scale

- Pilot with named clubs, coaches, scorers and a league: fixtures, results, training plans, safeguarding, parent/guardian access and billing entitlements.
- Add permitted external governing-body integrations and broadcast/stream overlays after consent and licence review.
- Track activation, successful complete-match rate, offline replay failures, time-per-delivery, analysis task completion and support tickets by platform/device.

**No production deployment, paid AI, media processing or unreviewed schema change is authorised by this plan.** Keep source-complete, staging-proven and production-live statuses separate.
