# CricLume analysis and connectors — 26 October 2026

This release rebuilds the analysis and central connector work from current GitHub source after the previous local-only checkouts became unavailable. Only the files in this PR constitute the release; earlier local commit IDs were never uploaded and are not release evidence.

## Implemented

- Analysis room inside the existing authenticated platform, restricted to club coaching/administrative roles.
- Combined discipline, player, innings, bowling style, zone, outcome, over-range and linked-clip filters. Delivery pagination, recorded metrics and safe filtered CSV export. Superseded deliveries are excluded; team runs and wicket events are not labelled individual batting/bowling statistics.
- Private photo/video upload (50 MB), junior/uncertain flag, 60-second signed previews, linked clip playback and uploader removal. 90-day retention is enforced on reads, with physical deletion through `cleanup-media` when scheduled. Latest 100 files displayed.
- Human coaching observations, optional delivery link, tags and search. Notes are separate from official scores and append-only. Latest 100 notes displayed.
- Default-off user-delegated MCP endpoint for score aggregates and media inventory, with current membership and match ownership checks. No score writes, identities, SQL, media bytes or signed URLs cross MCP.
- Companion Omniqora worker with OpenAI/Claude/Gemini aggregate adapters, scoped claim/settlement, reviewed central credentials, genuine usage metering and held reservations for ambiguous outcomes.

## Deployment and verification

Apply the `analysis_workspace` migration to the existing Lovable-connected Supabase project; deploy `criclume-mcp` and the updated `cleanup-media`; deploy the frontend through the normal release process. Confirm the cleanup scheduler and private bucket rules. Do not replace the existing project. `CRICLUME_MCP_ENABLED` defaults false. Provider paid switches remain disabled until reviewed tenant/model/rate configuration and a bounded hosted pilot.

Run `npm run check` and `npm run test:database`. The latter applies the full source migration chain in disposable embedded PostgreSQL with Supabase infrastructure stubs and tests club isolation, actual coaching writes, Storage access, expiration and anonymous denial. This does not certify hosted Supabase infrastructure, signed URL behaviour or cleanup scheduling. UI preview fixtures do not certify live login or upload.

MCP clients initialise protocol `2025-06-18`, send `notifications/initialized`, then call `criclume_match_summary` or `criclume_media_inventory` with `organisationId` and `matchId`. Use a current source-user JWT. The companion central client validates an expiring reviewed exact-host/tool/club binding. Inventory is capped at 100 with `hasMore`.

## Remaining work

Raw uploaded media is not connected to AI inference. Add separately budgeted media admission, consent/revocation rechecks, model-specific image/video token estimates, provider dispatch, saved findings and human result review before activation. General model outputs cannot establish calibrated ball speed or biomechanics. Junior or uncertain media is not authorised for external analysis.

Billing portal, atomic video completion and administrator readiness checks are restored in the operational-completion follow-up. Existing backup-monitor credentials, live database access and external provider configuration must be verified independently. Merging these PRs is not evidence of production deployment or successful paid calls.

GitHub candidates previously reviewed: [MediaPipe](https://github.com/google-ai-edge/mediapipe), [SAM 2](https://github.com/facebookresearch/sam2), [Supervision](https://github.com/roboflow/supervision). None has been installed or certified as a cricket tracker. Pin code/model versions, review licenses and benchmark representative cricket footage before integration.

Rollback: disable MCP/worker switches and revert frontend source if required; preserve evidence, notes, leases and receipts. Use a reviewed forward migration rather than deleting customer evidence or possibly-spent reservations.

## Operational completion follow-up

Apply the media_completion migration and deploy transcode-video, video-callback, create-billing-portal, create-checkout-session and integration-readiness. Existing billed clubs open Stripe's portal; active/trialing/delinquent subscriptions are blocked from another checkout. Configure the Stripe portal and test the real billing workflow separately. The existing-subscription guard does not serialize two simultaneous first-time checkout requests.

The configured transcoder receives a POST with jobId, assetId, sourceUrl, outputs [{kind,path,uploadUrl}], blurMode and callbackUrl, plus an idempotency-key header equal to jobId. Source links last one hour; output links are signed Supabase upload capabilities. The provider must honour blurMode, upload all required private outputs, then POST exactly {jobId,status: ready|failed}. Send x-video-timestamp (Unix seconds) and x-video-signature (lowercase HMAC-SHA256 of timestamp + dot + exact raw body), using a separately provisioned VIDEO_CALLBACK_SECRET of at least 32 characters. The dispatch never includes that secret. Callback JWT verification is disabled because it authenticates with HMAC. Five-minute timestamp window, idempotent same-state completion, conflict rejection, retention/consent recheck, and output existence validation. No provider output is trusted as a published highlight.

A claimed job is not automatically replayed after timeout or failure; inspect the provider and stored job before recovery. Setup failures after claiming can also leave a processing job requiring operator reconciliation. No automatic retry/reset is implemented. The readiness panel checks schema and configuration presence only; paid AI, backups and provider acceptance are separate evidence.

## Spatial analysis expansion — 29 October 2026

The analysis workspace now opens the Three.js spatial lab. It includes a zone-based wagon wheel, a close-up pitch with classified bowling deliveries, runs-by-over columns, cumulative filtered scoring progression, recorded fielding-event positions, and an eleven-position field planner. The zone-total observatory remains available beside it. Only one scene is mounted at a time.

All evidence plots follow the existing filters, exclude superseded/voided deliveries, and retain innings identity across filtering. Selecting a delivery opens its page in the evidence table and focuses the highlighted row, where linked clips remain available. Bowling disagreements and missing classifications are counted but not guessed. Cumulative charts include extras and describe filtered totals, not necessarily the complete innings.

Zone centres and line/length categories are schematic, not measured trajectories or player tracking. Full tosses are raised at the batting end, not presented as bounce locations. Field plans are separate session-only scenarios, can be renamed/repositioned within the drawn boundary, and export as JSON; they do not alter evidence or validate field restrictions. No historical full-field positions are inferred from individual fielding events.

Orbit/zoom and camera presets render on demand. Mobile pixel density is capped, marks are capped at 500 with an explicit notice and complete paginated list, and GPU resources are released on view changes/unmount/context loss. A 2D plot and keyboard-accessible list remain usable without WebGL. Synthetic browser fixtures exercise the renderer, camera, selection, planner/export, mobile sizing, view switching, context-loss fallback and empty filters; no production match records were changed.

## Club dashboard presentation

The default analysis view now follows the Club dashboard reference: three contribution cards, simultaneous Three.js run-rate and segmented wagon-wheel panels, and player contribution lists. The wheel uses equal category sectors with heights for delivery counts and percentages of mapped deliveries; it is explicitly a zone-distribution summary. Pitch, raised ball paths and field planning remain in the detailed explorer with a return-to-dashboard action.

Run-rate calculations accumulate filtered team runs including extras and divide by legal balls/6, retaining separate innings. A zero legal-ball denominator displays unavailable rather than an invented rate. Targets/projections are not inferred. Zone review uses the shared delivery filters. Both panels have exact accessible figures and a 2D alternative with independent WebGL failure handling. Browser verification uses synthetic fixtures and does not assert live deployment.

## Field-plan continuity and filtered-chart fixes

Field plans now remain in match-level component state when switching among the club dashboard, zone totals and detailed explorer. They are still session-only: export before changing match or leaving the page. The existing JSON export format can now be imported, with a 64 KB limit, supported version/type checks, exactly eleven named positions and finite coordinates within the schematic field boundary. Invalid imports retain the current plan; imports never write match evidence. Export also validates the plan so its own files can be reopened.

The club dashboard shows the active zone filter and a clear action. The bounded spatial renderer keeps a selected record visible even when it lies beyond the first 500 marks, while maintaining the same rendering limit and full paginated list.

Validation includes field-plan parser tests, rendering-cap tests and Chromium fixture checks for dashboard/zone navigation, export/import round trips, malformed/oversized file handling and mobile overflow. These checks do not assert cloud persistence or production deployment.

## Wagon-wheel correction — 30 October 2026

The public scorer's own `/app` Analysis tab still displayed horizontal bars labelled "Wagon-wheel data"; earlier 3D changes were confined to the club workspace. Replace that scorer panel with the shared cricket-ground renderer, radial shots from the batting crease, outcome colours, zone totals, batter/bowler/outcome filters and a 2D wheel. The club dashboard's extruded zone sectors and bar-chart fallback are also replaced by the same shot-based presentation. Fielding mode shows event points and is labelled as a fielding-event map.

Unknown zones remain unplotted, and repeated directions overlap rather than inventing precise coordinates. Three-dimensional depth belongs to the ground; shot distances and flight heights are not measured. The render cap is disclosed when exceeded, while totals use the complete filtered set. Browser verification exercises the real `/app` route with synthetic local match data: match opening, Analysis navigation, WebGL rendering, six-only filtering, filter reset, radial SVG fallback, context loss and mobile overflow. No production records are changed.
