# CricLume cloud build plan

The scoring preview is the first vertical slice. Its delivery records are the source of truth for the
cloud product; later releases should synchronize and enrich those records rather than replace the
scoring engine.

## Release 1 — Cloud accounts and live matches

- Organisation tenancy for clubs, schools, academies and leagues.
- Roles for owner, league administrator, club administrator, scorer, coach, player and viewer.
- Postgres match/event store with row-level access controls and an immutable edit audit.
- Offline mutation queue with idempotency keys and conflict handling.
- Realtime scoreboard subscriptions and private, opposition, league and public visibility modes.
- Managed object storage with retention rules, consent status and deletion jobs.
- Email invitation, recovery and transactional notification flows.

## Release 2 — Multi-phone capture and coaching

- A match camera room issues short-lived QR pairing tokens.
- Phones at each end and side-on record independent timestamped segments.
- Server clock-offset checks align every angle with the scorer's delivery window.
- Resumable uploads preserve local segments until integrity is confirmed.
- A review manifest links each delivery to each available angle without duplicating video.
- Frame-accurate transcoding proxies, drawing layers, tags, voice notes, clip export and sharing.
- A director view reports battery, storage, signal, dropped frames and angle health.

## Release 3 — Competitions and fixtures

- Seasons, divisions, groups, knockout brackets, venues, blackout dates and team constraints.
- Versioned rule packs: points, tie-breaks, bonus points, eligibility, overs, innings and ball count.
- Fixture generation using hard constraints first, then travel, fairness and venue preferences.
- Tables rebuilt from signed results, with administrator overrides captured in the audit log.
- Import/export adapters for governing-body systems where commercial access is permitted.

## Rain-rule adapter

Rain calculations must be selected by the competition's versioned rule pack. CricLume should store
the method, edition/version, G50 or other parameters, every suspension period, the inputs, par score,
target and the administrator who confirmed it.

Do not reproduce an unlicensed approximation and label it DLS. The current Play-Cricket guidance
shows that scorers may be offered Standard, V4 or V5 and should consult their competition when unsure;
it also requires the appropriate G50 setting. ICC playing conditions continue to identify DLS in
limited-overs cricket. The production implementation therefore needs either an authorised calculator
or a verified competition-specific rules provider before it can be enabled.

- [ECB Play-Cricket in-game calculator guidance](https://play-cricket.ecb.co.uk/hc/en-us/articles/360000280645-In-Game-Duckworth-Lewis-Calculator-PCS)
- [ICC playing conditions](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)

## Release 4 — AI analysis and audit

- Delivery anomaly detection compares score events, synchronized video and edit history.
- Shot, line, length and fielding suggestions are confidence-scored and require human confirmation.
- Batter, bowler and fielder histories aggregate only consented, correctly linked player identities.
- Coaching summaries cite the deliveries and clips that support each observation.
- Model outputs, prompts, versions, consent and reviewer decisions are retained for audit.
- Junior accounts use restricted sharing, no public biometric identification and club safeguarding.

## Production gates

- Named pilot league or club and a signed data-processing agreement.
- Authentication, storage, email and payment service accounts.
- Threat model, penetration test, backups, incident response and recovery exercise.
- Video/privacy impact assessment, junior safeguarding review and retention policy.
- Current competition rule packs and an authorised rain-rule implementation.
- App-store accounts and native capture testing if background recording is required.
