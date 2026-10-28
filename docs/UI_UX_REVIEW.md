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
