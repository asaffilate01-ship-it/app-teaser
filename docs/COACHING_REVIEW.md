# Structured coaching review

This release adds human-authored classifications to CricLume's existing analysis workspace. It does not run AI inference or modify official scoring.

## Coach workflow

1. Select a match and a batting, bowling or fielding discipline.
2. Record a coaching observation, optionally associated with a current delivery.
3. Select shot type, bowling line, bowling length and/or fielding action. Leave unknown values unrecorded.
4. Optionally link one of the latest 100 private evidence files. Video sources can carry a whole-second position from 0 to 86400; the player seeks to that position. The input is an observation reference, not a verified video-duration measurement.
5. Use the observation filters together with existing player, innings, over, outcome, zone and clip filters. Classifications must occur together in one observation for the chosen discipline and delivery. Missing classifications do not match a selected classification filter. Conflicting observations remain separate records.
6. Export filtered deliveries or export the matching human observations as separate CSV files. Observation export includes classification, delivery/source IDs, source time and creation time, but never signed storage URLs.

Whole-match observations remain visible alongside filtered delivery observations and respect classification/text filters. Delivery notes for superseded score events are not included in the current-delivery review. Notes are paginated in the UI, with all fetched matching notes included in export. Up to 10,000 notes are fetched in deterministic batches; a boundary error prevents silently filtering a partial dataset. Evidence browsing still shows the latest 100 files.

## Database and deployment

Apply `supabase/migrations/20261028091454_structured_coaching_review.sql` before enabling the new interface in a live environment. Existing notes remain valid with null optional fields. If the schema/access is unavailable, the interface explains that coaching storage is unavailable and disables saving and classification filters.

Existing coach-role, author, tenant, match and delivery policies continue to apply. An additional restrictive insert policy requires a linked source to belong to the same organisation and match, have coaching consent and be unexpired. Only video sources accept timestamps. PostgreSQL constraints enforce the fixed classifications and timestamp range independently of the UI. Notes remain append-only; explicit grants exclude anonymous access, updates, deletes and truncation. Deleting an evidence file clears its foreign key while retaining the note and recorded timestamp. An unavailable source cannot produce a new signed URL.

No provider credentials, live migrations, publication or paid inference were used in this release. OpenAI/Claude/Gemini aggregate routing through Omniqora is unchanged. Raw photo/video inference still requires the separate consent, provider and budget workflow.

## Validation

- `npm run check`: TypeScript, 45 unit tests, lint and production build.
- `npm run test:database`: all migrations and behavioural tests for tenant/match/source isolation, invalid categories, image timestamp rejection, expired evidence, append-only notes and source deletion; existing media lifecycle checks remain covered.
- `supabase/tests/structured_coaching_review.test.sql`: hosted-stack schema, RLS, grant and restrictive-policy assertions in CI.
- Chromium with actual analysis components and local synthetic fixtures at 390px and 1440px: classification filters, source timestamp selection, saving/resetting a note, exported CSV contents, no viewport overflow and no runtime errors. This does not validate production storage playback or external model execution.
