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

Earlier local-only billing portal, video completion callback and readiness panel changes are not part of this rebuilt release and still need implementation. Existing backup-monitor credentials, live database access and external provider configuration must be verified independently. Merging these PRs is not evidence of production deployment or successful paid calls.

GitHub candidates previously reviewed: [MediaPipe](https://github.com/google-ai-edge/mediapipe), [SAM 2](https://github.com/facebookresearch/sam2), [Supervision](https://github.com/roboflow/supervision). None has been installed or certified as a cricket tracker. Pin code/model versions, review licenses and benchmark representative cricket footage before integration.

Rollback: disable MCP/worker switches and revert frontend source if required; preserve evidence, notes, leases and receipts. Use a reviewed forward migration rather than deleting customer evidence or possibly-spent reservations.
