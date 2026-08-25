# Security and safeguarding model

## Trust boundaries

- The browser uses only the Supabase publishable key. It never receives Stripe, email, AI, video,
  rain-provider or Supabase secret keys.
- Postgres RLS is enabled on every exposed table. Privileged Edge Functions authenticate the user and
  re-check organisation roles before using the secret key.
- Scoring events are append-only. Corrections are new events, preserving device, user, client event ID,
  occurrence time, server time and sequence.
- Public scoreboards use a narrow security-definer RPC. Anonymous table access is not granted.
- Video objects are private and use organisation/room/asset paths. Upload is allowed only for a planned,
  consented asset belonging to the paired camera or an authorized organisation member.

## Junior data

Dates of birth, guardian details, emergency contacts and medical notes live in a separate table visible
only to the player and designated safeguarding roles. Public player profiles are opt-in. Junior video is
private by default, capped at 90 days by the client policy, never enables public biometric identity and
requires safeguarding review for release.

Recording, coaching analysis, public highlights and biometric analysis have separate consent states.
Withdrawal must prevent new processing immediately and queue affected media for review/deletion. Legal
holds override automated deletion but must identify a responsible officer and review date in the club's
external case record.

## Required production controls

- MFA for owners, league/club administrators, billing administrators and safeguarding officers.
- Short session lifetime, breached-password protection and custom SMTP with SPF, DKIM and DMARC.
- WAF/rate limits on public RPCs and Edge Functions; webhook and scheduled-job signature verification.
- Centralized logs with personal-data scrubbing, alerting and a documented incident-response procedure.
- Dependency, secret, SAST, database-lint, RLS and penetration testing before launch and after material changes.
- Daily database backup or PITR, independent Storage backup where required, quarterly restore exercises.
- Documented retention/deletion schedule, subject-access workflow and safeguarding escalation path.
