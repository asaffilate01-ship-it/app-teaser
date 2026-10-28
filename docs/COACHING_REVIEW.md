# Structured coaching review

This release adds human-authored classifications to CricLume's existing analysis workspace. It does not run AI inference or modify official scoring.

## Coach workflow

1. Select a match and a batting, bowling or fielding discipline.
2. Record a coaching observation, optionally associated with a current delivery.
3. Select shot type, bowling line, bowling length and/or fielding action. Leave unknown values unrecorded.
4. Optionally link a private evidence file from the recent-source selector or choose **Use in observation** in the paginated evidence library. Video sources can carry a whole-second position from 0 to 86400; the player seeks to that position. The input is an observation reference, not a verified video-duration measurement.
5. Use the observation filters together with existing player, innings, over, outcome, zone and clip filters. Classifications must occur together in one observation for the chosen discipline and delivery. Missing classifications do not match a selected classification filter. Conflicting observations remain separate records.
6. Export filtered deliveries or export the matching human observations as separate CSV files. Observation export includes classification, delivery/source IDs, source time and creation time, but never signed storage URLs.

Whole-match observations remain visible alongside filtered delivery observations and respect classification/text filters. Delivery notes for superseded score events are not included in the current-delivery review. Notes are paginated in the UI, with all fetched matching notes included in export. Up to 10,000 notes are fetched in deterministic batches; a boundary error prevents silently filtering a partial dataset. The evidence library uses separate server-side pagination; the recent-source selector loads 100 files plus the selected older source, if still accessible.

## Database and deployment

Apply `supabase/migrations/20261028091454_structured_coaching_review.sql` before enabling the new interface in a live environment. Existing notes remain valid with null optional fields. If the schema/access is unavailable, the interface explains that coaching storage is unavailable and disables saving and classification filters.

Existing coach-role, author, tenant, match and delivery policies continue to apply. An additional restrictive insert policy requires a linked source to belong to the same organisation and match, have coaching consent and be unexpired. Only video sources accept timestamps. PostgreSQL constraints enforce the fixed classifications and timestamp range independently of the UI. Notes remain append-only; explicit grants exclude anonymous access, updates, deletes and truncation. Deleting an evidence file clears its foreign key while retaining the note and recorded timestamp. An unavailable source cannot produce a new signed URL.

No provider credentials, live migrations, publication or paid inference were used in this release. OpenAI/Claude/Gemini aggregate routing through Omniqora is unchanged. Raw photo/video inference still requires the separate consent, provider and budget workflow.

The follow-up migration `20261028092521_match_workspace_status_cast.sql` fixes an existing match-creation RPC error: a CASE expression returned text instead of the `match_status` enum. Draft and scheduled match creation, squad copying and initial innings creation are covered by regression tests, including cross-club denial.

## Validation

- `npm run check`: TypeScript, 45 unit tests, lint and production build.
- `npm run test:database`: all migrations and behavioural tests for tenant/match/source isolation, invalid categories, image timestamp rejection, expired evidence, append-only notes and source deletion; existing media lifecycle checks remain covered.
- `supabase/tests/structured_coaching_review.test.sql`: hosted-stack schema, RLS, grant and restrictive-policy assertions in CI.
- Chromium with actual analysis components and local synthetic fixtures at 390px and 1440px: classification filters, source timestamp selection, saving/resetting a note, exported CSV contents, no viewport overflow and no runtime errors. This does not validate production storage playback or external model execution.

## Current-delivery integrity and historical review

The follow-up `20261028115016_current_delivery_observations.sql` adds a restrictive insert policy: new delivery-linked observations require a delivery that is neither superseded nor voided. Existing observations are retained when a scorer subsequently undoes or replaces a delivery. The browser query, local filtering, summary and delivery CSV also exclude voided deliveries.

Use **Refresh match evidence** after scoring changes. The loaded-at time identifies the last successful fetch; this is a manually refreshed snapshot, not a live subscription. Refresh resets pagination and closes signed media previews while preserving unsaved note text, classifications and selections. If a selected delivery or source disappears, the draft remains visible and Save is disabled until the coach explicitly chooses a valid replacement or whole-match/no-source association.

**Observation history** defaults to current deliveries and whole-match notes. Historical mode shows notes linked to deliveries absent from the current match snapshot; All combines both groups. Historical notes respect discipline, classification and text search. Current player, innings, over and outcome filters apply only to current-delivery notes because historical delivery details are not fetched. Neither historical mode nor historical exports change the score statistics. Observation CSV now includes `delivery_state` (`current`, `whole_match` or `no_longer_current`); the last value does not claim whether a delivery was undone, replaced or otherwise removed from the current snapshot.

Regression coverage includes voided/replaced filtering and export exclusion, historical-versus-filtered-current distinction, database rejection of new notes on undone deliveries, and continued authorised access to historical notes. Chromium checks cover refresh with a preserved draft, stale-selection save blocking, historical notes/export, preview closure and mobile/desktop layouts.

## Searchable evidence library

The private media library fetches 24 files per page plus one look-ahead row. It orders by creation time and ID and scopes every request to the selected organisation and match. Only unexpired records with coaching consent are requested; existing database and storage RLS remain authoritative. No new migration or grant is introduced in this phase.

Submit **Search evidence** to combine a literal filename substring with photo/video and recorded age-category filters. Percent, underscore and backslash characters are escaped as literal SQL-pattern characters. The age flag is uploader-supplied metadata, not an inferred age or approval for external processing. Reset returns to the first unfiltered page. Loading and error states clear old cards; Retry reruns the same request. Uploads/deletions/refresh reload the library. If a page becomes empty after deletion, Previous remains available.

**Use in observation** adds a library file to the draft's source selector. Refresh revalidates an older selected source outside the recent 100; if missing or expired, the existing stale-source guard requires an explicit replacement. Existing observation links resolve the source directly by ID with organisation/match/consent/expiry constraints before requesting a short-lived URL. They no longer depend on the file appearing in the recent-source list.

This uses offset pagination, not an immutable snapshot: simultaneous uploads/removals can shift pages. No signed URLs are prefetched or exported. Production media playback and live deployment are not exercised by the synthetic browser tests.

Validation for this phase: 49 unit tests, TypeScript, lint, production build; PostgreSQL fixtures with 125 files verify access beyond the old cap, combined filters and cross-club denial. Chromium at 390px/1440px covers pagination/end-of-list, search/type/age filters, error/retry/reset, selecting and refreshing older sources, direct note-source playback URL and overflow/runtime checks.

## Downloadable coaching report

**Download review report** produces a standalone HTML file from the loaded analysis data and current review filters. It records both evidence-load and export times in UTC, shows the current delivery totals, lists filter criteria, and includes saved matching observations with delivery/source references and recorded video positions. Unsaved drafts are excluded. Open the download in a browser and use Print / Save as PDF.

The document contains up to 250 delivery rows and 100 observations, with explicit shown/total counts. Aggregate totals cover all matching current deliveries; existing CSV exports remain the complete matching row exports. Historical observations are labelled and do not affect score totals. The report intentionally does not add player names from the roster. Coach-authored text may still contain personal information, so downloads should remain within authorised coaching recipients.

All inserted text is HTML-escaped. The generated file has no scripts, embedded images/video, automatically generated media access URLs or external styles/fonts, and a restrictive content security policy. It is generated locally without a provider request, database write or new service requirement. A downloaded copy is a static private document: it does not refresh and cannot be revoked through storage permissions.

Validation for the report phase: 53 unit tests, TypeScript, lint and production build; browser download checks confirm saved-only notes and source references without media URLs. Desktop/mobile HTML and A4 browser print output are inspected. Tests cover current versus historical statistics, filter scope, hostile text escaping, empty reports and labelled excerpt limits.
