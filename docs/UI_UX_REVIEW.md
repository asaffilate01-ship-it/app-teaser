# CricLume UI/UX review — 28 October 2026

Reference: [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), inspected at commit `28b3b8dee8c976df4fa3e94aed4e092ad43fcb03`. Applied its web accessibility, navigation and error-recovery guidance to the existing burgundy/gold CricLume design. The upstream skill is a design reference, not an installed runtime dependency; no hooks or external executable setup were added.

## Delivered in this phase

- Public and club workspace sections use validated URL query state, supporting bookmarks, reload and browser history. Unknown sections explicitly fall back to Home/Overview so raw invalid query values cannot reach rendering.
- The public mobile bar has five primary destinations; Screens remains available through Home and the footer. Workspace sections use a labelled select on smaller screens and full buttons on desktop.
- Shared visible keyboard focus, a skip-to-content link, larger mobile controls, mobile input sizing, reduced-motion support and accessible navigation labels.
- Scorer header wraps and exposes the club workspace link on mobile.
- Initial dashboard and analysis failures offer retry. Analysis waits for evidence instead of displaying zero statistics during loading.
- Organisation/role changes remount the workspace; pending dashboard requests are invalidated during cleanup.
- Analysis filters have a reset action, fielding rows display the fielder, clip controls expose multiple linked camera views, and uploads/notes/removal show success feedback. Empty matches explain how to begin.

## Validation

- `npm run check`: TypeScript, unit tests, lint and production build.
- `npm run test:database`: all migrations, tenant isolation, coaching permissions, object access, expiry, anonymous denial and atomic media completion.
- Chromium at 390px and 1440px: public navigation and real analysis components with synthetic fixtures. Analysis retry/loading, fielding player selection, filter reset, camera source/offset switching, CSV download and responsive navigation pass; neither layout overflows the viewport.
- Browser fixtures are local only. They do not test live provider inference, storage playback or authenticated production services. Lovable-hosted logo assets are not served by a standalone local Vite server.

## Next phases and acceptance gates

| Phase                 | Remaining work                                                                                                                                   | Acceptance gate                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Service activation    | Apply reviewed migrations and configure server-side integration secrets, Stripe and video worker endpoints                                       | Staging sign-in, subscription lifecycle and signed worker callback succeed; tenant boundaries remain enforced                   |
| Media AI              | Implement consent-aware raw photo/video dispatch through Omniqora, frame/audio preparation, provider capability routing and asynchronous results | Adult consent enforced, junior/uncertain media blocked, provider budgets enforced, results traceable to source and time offsets |
| Analysis presentation | Reviewable AI observations, confidence and provenance; line/length, shot and fielding-action filters backed by validated annotations             | No fabricated measurements, human corrections retained, official scoring unchanged                                              |
| Release readiness     | Hosted logo/image checks, real-device accessibility review, signed media playback and operational monitoring                                     | Staging end-to-end review, backup/restore verification and explicit publication decision                                        |

Existing OpenAI/Claude/Gemini routing works on aggregate cricket data; this phase does not claim that raw photos or videos are sent to those providers. No paid inference or live deployment was performed.

## Evidence preview follow-up

Applied the same pinned UI UX Pro Max reference to keyboard interaction and mobile evidence review. Private previews now use the existing Radix dialog: accessible title/description, focus containment, Escape dismissal and focus return to the initiating control. Camera responses arriving after dismissal cannot reopen the preview. Loading/failure feedback remains inside the dialog. The existing 60-second timeout is explained and announces closure.

Evidence filenames wrap, actions identify their source file to assistive technology, and file actions/dialog close controls provide 44px minimum touch targets. No new runtime dependency or provider call was added.

Validated the real components with synthetic fixtures at 375px, 844px and 1440px: keyboard opening, repeated Tab containment, Escape, focus restoration, source selection and no horizontal overflow. This does not validate live signed-media playback or claim a native mobile build.

### Remaining priorities after the review releases

1. Staging service activation: migrations, authentication, billing and signed video callbacks, followed by real-device/media checks.
2. Raw-media AI: resolve server-side provider credential configuration; implement consent-aware dispatch, budgets, asynchronous results and provenance through Omniqora.
3. Human review lifecycle: correction/version history and reviewed AI results. Structured manual observations, archive search and downloadable reports are already implemented.
4. Broader form accessibility: field-linked validation summaries and inline errors across onboarding/scoring flows; test with assistive technology.
5. Publication: hosted asset checks and operational/backup verification before a live release.

## Coaching form validation follow-up

Applied UI UX Pro Max's `error summary validation` guidance to the coaching observation form. Save is now an actual form submission with a focused, linked error summary and inline errors connected through `aria-describedby`/`aria-invalid`. Coaches can discover why short/blank notes, invalid video offsets and stale source/delivery selections cannot be saved. Character guidance stays visible before submission.

A failed server save retains all draft fields and offers retry in the same form. Fields are disabled during requests to prevent edits from being cleared by completion of an earlier save. Existing database permissions remain authoritative; this change does not weaken access checks or introduce provider calls.

Validation: boundary tests for meaningful note lengths, video offsets and stale associations; real-component Chromium checks for summary focus, field links, corrected errors, draft retention after a simulated network failure, successful retry and no overflow at 375/844/1440px. Broader onboarding/scoring validation, assistive-technology review and live-service acceptance remain pending.

## Organisation access recovery

Membership lookup failures no longer fall through to the create-organisation form. The initial account lookup stays in a loading state until it completes; failed requests show an explicit access error and retry. A confirmed creation followed by missing or failed membership loading retries access only, preventing another creation attempt in that page session. Request generations discard late results after account changes/unmounts. Browser storage is optional, so blocked local storage cannot turn successful membership loading into an access failure.

This is client-side recovery, not server-side creation idempotency: an ambiguous network failure during the create request itself, or a full page reload, still requires server-side idempotency/reconciliation work. No live database or provider changes are included.

Validated with `npm run check` (56 tests, typecheck, lint and production build) and real-component Chromium using synthetic authentication/membership responses: initial failure, retry to confirmed empty account, confirmed creation followed by empty membership, repeated access retry without another creation, delayed old-account rejection and mobile/desktop overflow checks. These checks do not establish live authentication or provisioning readiness.

## Idempotent organisation setup

The setup form now keeps a creator-scoped request ID and original name/type for retries. Pending details are restored from browser storage after reload; blocked storage falls back to the current page session with an explicit warning. Details remain locked once submitted so an ambiguous result cannot silently turn a retry into a different creation request.

`create_organisation_once` is a security-invoker database function. It uses the authenticated user, existing INSERT/SELECT policies and owner-membership trigger. A unique creator/request constraint serialises retries; a replay returns the existing accessible organisation only when name/type match. Creation identity cannot be changed after insertion. Inserts finish before the subsequent SELECT, fixing the previous immediate-return path that could hit SELECT RLS before owner membership existed. Anonymous execution is revoked.

Validation: 58 unit tests, typecheck, lint and production build; all migrations and embedded PostgreSQL tests for replay, changed payload rejection, creator isolation, immutable identity, automatic owner membership and revoked/anonymous access; browser simulation of a lost response, reload, identical request ID and access-only retry. Real PostgreSQL CI also checks the function's invoker mode and execution grants.

Release requires the new migration before this frontend. No live migration was applied. The guarantee covers retries with the same ID while the organisation exists; separate browser profiles/tabs that independently begin setup, cleared browser storage, deleted organisations and older clients using direct inserts are not globally deduplicated. This replaces the earlier ambiguous-timeout gap for the supported same-request flow; it is not a claim of global name-based deduplication.

## Scoped intelligence and readiness recovery

Omniqora panel state is now isolated by organisation, role and match. Switching scope clears connection readiness, receipts and history immediately; late connection/advisory responses are ignored. Already-submitted server work is not cancelled by navigation. Readiness copy distinguishes verified scoped access from budgeted-worker readiness.

History can be refreshed independently without starting a run. A confirmed receipt/report remains visible if a later history lookup fails, with its request reference and a direct refresh action. Initial loading no longer displays a false empty-history message. Configuration readiness also resets on club changes and clears old results before another check. Missing/unavailable statuses no longer use success green; configuration presence still does not claim working provider execution.

Validation: `npm run check` (58 tests, typecheck, lint, production build); real-component Chromium with synthetic gateway responses for delayed verification across matches, history failure after confirmed admission, history-only retry with unchanged run count, late report after club switch, stale readiness clearing and 375/1440px overflow checks. No AI model calls or live integration checks were made. These are browser state/recovery fixes; staging activation, raw-media dispatch and observation correction history remain separate work.

## Scorer storage recovery

The scorer no longer treats arbitrary parsed JSON as a valid match list or overwrites unreadable saved data with an empty array. It validates the persisted scorer structure and team references, preserves unknown fields, and leaves the original key untouched when reading/validation fails. Current-session scoring can continue in memory.

Storage failures are visible rather than silently claiming successful device saving. The recovery banner downloads the current match list and, when available, the exact unreadable original. Quota/write failures offer retry without clearing in-memory scores. Unsaved edits enable the browser's normal leave-page warning. If initial reading fails, writes stay disabled to protect unseen existing data. Cloud linkage does not imply completed synchronisation.

Validation: parser tests cover recorded deliveries, forward fields, malformed/partial data, duplicate IDs and invalid innings/team references; Chromium against the actual scorer covers preserved corrupt storage, exact backup download, quota failure, retained match backup, successful retry and mobile/desktop overflow. No live cloud data or database schema changes.

Remaining storage work: a validated user-facing backup import/restore flow and conflict handling for simultaneous edits in separate tabs/devices. Downloading a backup does not itself restore it. Keep player names and private notes in exported files private.

## Validated backup import — 29 October 2026

The local scorer dashboard now accepts both single-match JSON exports and multi-match backups. Files are bounded to 10 MB/100 matches and validated as a complete batch before a keyboard-focusable preview is shown. Invalid files import nothing. Confirmation creates independent copies with new `restored-` IDs and a visible restored-copy label; existing matches are never replaced. Cancelling or choosing a different file clears the pending preview, and late file reads cannot replace a newer selection.

The importer is unavailable within a cloud-linked scorer session. Imported copies are local and do not restore server scores or cloud event queues. Existing storage protections still apply: unreadable device data stays untouched, restored copies can be used/downloaded in memory, and quota failures use the existing retry/backup flow. Re-importing intentionally creates additional copies.

Validation: 63 unit tests including single/list imports, empty/partial/oversized rejection, batch limits, independent identities and deep-copy isolation; TypeScript, lint and production build. Chromium against the actual scorer checked invalid files, focused previews, cancellation, preserving existing matches, successful import, unreadable-storage memory recovery, downloading the restored copy and 375/1440px layouts. Live cloud services were not called.

Remaining: controlled replacement/merge of existing versions and simultaneous-edit conflict handling. The original file is not repaired by importing copies; cloud restoration remains an authenticated server workflow. Staging activation, raw-media AI and coaching correction history remain separate phases.

### Dependency check follow-up

The production audit detected two Seroval advisories in the previous 1.6.9 lock entry during this release. The override now pins 1.6.11, covering [GHSA-f86p-h4j2-7qgj](https://github.com/advisories/GHSA-f86p-h4j2-7qgj) and [GHSA-9wx9-5pv9-3349](https://github.com/advisories/GHSA-9wx9-5pv9-3349). Dependency audit, build and browser verification are repeated with the patched lockfile before merge.

## Device scorer tab-conflict protection — 29 October 2026

Device saves now acquire an exclusive same-origin Web Lock and compare the live stored snapshot with the tab's last known version before writing. A different value, removal or clear blocks the stale tab from saving. Storage events also surface conflicts promptly without replacing the tab's in-memory matches. Queued saves are invalidated when newer edits arrive or the scorer unmounts; waiting for a lock times out with retry guidance rather than waiting indefinitely. Initial reads no longer rewrite unchanged data.

The recovery banner keeps current-tab and latest-device downloads available and offers a clearly labelled reload to use the latest device data. Reload replaces the in-memory version; the existing leave-page warning protects unsaved/conflicting state. Quota failures remain retryable against the unchanged baseline. If the browser lacks Web Locks, edits remain in memory with an explicit explanation and backup action rather than making uncoordinated writes.

Validation: 65 unit tests, typecheck, lint and production build. Chromium with multiple real scorer tabs checked sequential and near-simultaneous saves, a losing tab's independent downloaded backup, reloading the winner's data, device-data removal, unsupported-lock fallback, multiple edits queued behind a lock, quota failure/retry and 375/1440px layout.

Limits: coordination applies to this updated scorer on the same browser origin. Older app versions or unrelated code that writes the key without taking the lock can still race. No cross-device/server conflict resolution or automatic score merging is claimed. Users can retain both versions via backups and import them as independent copies. Staging activation, raw-media AI and coaching correction history remain separate phases.

## Ordered cloud scoring replay — 29 October 2026

Online scorer updates now enter the persisted event queue before network dispatch. Previously a newly recorded online delivery could bypass an older offline delivery, and simultaneous reconnect/publish calls could run overlapping replays. One drain per match in the current browser context now sends the queue head, acknowledges it, then reads the latest queue again. New scores join behind older events. A failed head blocks subsequent events until a later retry; retained client event IDs preserve the server's existing idempotency behavior. Queue acknowledgement write failures stop replay rather than advancing to newer events. Reconnect receipts also update the displayed server sequence, and disposed subscriptions ignore late callbacks.

Validation: `npm run check` passes 69 tests, TypeScript, lint (eight existing warnings) and the production build. Chromium exercised the actual sync hook and cloud queue with synthetic Supabase RPC responses: persist before send, simultaneous reconnects, new events during an upload, failed-head blocking, retry identities and acknowledgement cleanup. No live match data or paid AI services were used.

Limits and next phases: this serializes one browser context, not independent tabs or devices. Server revision checks and explicit reconciliation remain necessary for cross-device scoring conflicts. Malformed/unavailable cloud-queue storage recovery, authentication-scoped queue ownership and raw-media AI remain open work. Coaching correction history and staging activation are also pending. No database migration or live deployment is included.

## Three.js Match Observatory — 29 October 2026

The analysis room now includes a Three.js ground driven by the same filtered, current delivery rows as the scorecards. Batting uses recorded shot zones and batter runs; bowling shows shot destinations and team runs; fielding uses recorded fielding zones. Delivery counts, runs and wicket-event measures are selectable. Numbered zone controls provide exact summaries alongside the ground; overhead, overview and end cameras change the view without changing the data.

This is a schematic zone visualisation, not ball tracking. Unknown/unrecorded zones are counted explicitly and never assigned invented coordinates. Voided and superseded rows are excluded. Wicket events include run-outs and are labelled separately from bowler wickets or fielding credits. There are no demonstration deliveries in production and no new AI calls.

The renderer is dynamically imported only by the mounted analysis view (about 135 KB gzip), renders on demand, caps pixel ratio at 1.5, and disposes geometry, materials, textures, observers and the WebGL context on exit. No continuous animation runs. Native keyboard-accessible controls and an equivalent 2D ground preserve access without WebGL, including after context loss. Exact numeric zone summaries are always available outside the canvas. Existing filters, delivery tables, private evidence and exports remain in the analysis workflow.

Validation: 72 unit tests, typecheck, lint and production build; production dependency audit has no findings. Chromium rendered the actual component with synthetic fixtures and checked desktop/mobile layouts, measure and discipline updates, camera selection, zone controls, keyboard selection, 2D/3D switching, empty data, startup WebGL denial and context-loss fallback. Visual inspection corrected mobile framing and marker readability. Three.js and its type definitions are pinned in the package manifest and Bun lockfile. No deployment or database changes.

Next spatial phases: coaching-tag bowling line/length summaries, field-setting scenarios with explicit hypothetical labels, and video-linked delivery inspection. Measured trajectories, speed, release points and player movement require calibrated source data and a validated analysis pipeline before displaying them as facts. Operational/admin dashboards should retain ordinary tables and forms where 3D adds no analytical value.

## Bowling line-and-length review — 29 October 2026

The bowling analysis tab now has a coach-classified line/length matrix using the same current, filtered delivery rows as the scorecards and 3D observatory. Users can switch between delivery counts, team runs and wicket events, select a cell, and inspect paginated deliveries with the existing authorised clip-preview flow. Coverage categories also expose conflicting and unclassified deliveries for review. Innings labels use the full match's available innings order, not the filtered subset. Mobile horizontal scrolling keeps length headings visible, native buttons support keyboard selection, and clearing selection returns focus to the matrix.

A delivery contributes once even if duplicate observations agree. A complete, supported line/length pair must exist within one bowling observation; separate partial notes are not combined into an invented classification. Any disagreement in recorded line or length excludes that delivery from matrix totals, regardless of note order. Whole-match notes, other disciplines and no-longer-current deliveries do not contribute. Full tosses have their own no-bounce category. These are human categories rather than measured coordinates; team runs include extras, and wicket events include run-outs.

Validation: 77 unit tests, typecheck, lint (eight existing warnings) and production build. Chromium with the actual component and synthetic fixtures checked measure changes, keyboard selection, conflict/unclassified review, correct clip ID dispatch and disabled controls, pagination, stable innings numbering, clear-selection focus, empty filters and mobile scrolling without page overflow. No schema changes, paid AI calls or live deployment.

Next: append-only coaching correction history to resolve conflicting classifications explicitly; field-setting scenarios; video-linked spatial inspection. Measured ball trajectories and cross-device scoring reconciliation remain separate work. This matrix does not silently pick a winning observation or change official scores.
