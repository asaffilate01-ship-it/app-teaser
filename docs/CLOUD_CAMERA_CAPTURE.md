# CricLume Cloud Camera & Server Egress — activation guide

**Status: source-implemented, provider/production UNVERIFIED.** This feature is disabled by default. The implementation does **not** create a LiveKit account, issue charges, provision an S3 bucket, deploy database migrations, certify junior consent or turn the website into a live broadcast.

## What is implemented

1. A signed-in paired phone chooses **Publish to cloud recorder** after enabling preview, confirming club recording permission and arming auto-record. The browser obtains a short-lived, scoped LiveKit token from CricLume's own Supabase Edge Function, then publishes the phone's existing camera/audio tracks to a **private per-device LiveKit room**. No API secret is shipped to the browser.
2. A club-authorised director opens the **Server-side cloud recording** panel and separately approves a start request. The backend verifies the director's roles, room/device ownership, operator's recording arming/consent and the real LiveKit publisher. It reserves a unique active session, calls LiveKit's real per-participant egress service, and targets a configured **private S3-compatible bucket**.
3. An authorised director, or the paired camera operator, can issue a stop. A verified LiveKit signed webhook updates the provider state. Source code distinguishes **starting**, **recording**, **stopping**, **provider completed**, and **failed**. The dashboard deliberately does not claim archival verification.
4. Provider jobs are stored under database RLS, preventing ordinary browsers from fabricating completed files or starting duplicate per-device egress.
5. Existing peer-to-peer review, phone-side segmented recording and opt-in controls remain available independently. LiveKit publishing is a separate control; it does not silently enable itself.

## Correct project and secrets

The CricLume project is recorded in the repo as Supabase ref eivwnjbykohrlxavvpcr. **Do not deploy any of this to Dishbee.** Deploy migrations and Edge Functions only to the approved CricLume project following staging database tests and backup.

The following must be configured as **server-side Supabase Edge Function secrets in CricLume**, not public Vite variables:

- CRICLUME_CLOUD_CAPTURE_ENABLED=true only after review and a verified provider/storage setup
- LIVEKIT_URL (wss:// hosted provider), LIVEKIT_API_KEY, LIVEKIT_API_SECRET
- CRICLUME_CAPTURE_S3_ENDPOINT (https://)
- CRICLUME_CAPTURE_S3_BUCKET (a private bucket with no public ACL)
- CRICLUME_CAPTURE_S3_REGION
- CRICLUME_CAPTURE_S3_ACCESS_KEY, CRICLUME_CAPTURE_S3_SECRET_KEY
- SUPABASE_URL plus service-role credential for the approved CricLume project

Configure the LiveKit project webhook to call the authenticated-provider endpoint:
https://<criclume-supabase-project-host>/functions/v1/camera-cloud-webhook
The webhook must deliver the **raw request body** and LiveKit **Authorization** signature. The Edge Function validates it with LiveKit's WebhookReceiver.

Apply the generated cloud camera migration after existing P3 camera migrations. Deploy **camera-cloud** (user JWT verified) and **camera-cloud-webhook** (provider signature verified, no browser JWT) together. The provider may charge for recording minutes and storage; production use requires approved budgets, monitored concurrency and retention.

## Privacy and limitations

- The operator's browser explicitly sends media to LiveKit. The cloud egress runs on the provider after the director presses Start and can continue while the director closes their screen; it cannot record frames if the phone loses connectivity or stops publishing.
- The S3 output path is private and is NOT automatically added to CricLume's authorised, consent-gated video library. **Provider-complete is not archive-verified**. Before playback/publication, verify the object bytes and tenant scope, then ingest through CricLume's safeguarding, retention, blur and publication-consent pipeline. Never expose an S3 URI as a public link.
- For juniors or uncertain age, access remains restricted; provider output is not automatically reviewable or publishable. Guardian permissions, withdrawal response and reliable remote-stop orchestration require real-world testing.
- Turning off consent on the phone stops local tracks, private live sharing and cloud publishing; it also asks the backend to stop any active provider egress. Offline browser closure cannot guarantee immediate server revocation, so directors need operational incident controls and a provider dashboard.
- Server token time-to-live is five minutes for new joins; room and camera identity are server-derived. Token expiry by itself is not a guarantee that an already-established connection is revoked.
- Director-started recording remains available. Automatic match-state recording is implemented in source behind a **separate, disabled-by-default** platform switch and each phone's explicit adult-only opt-in. Verified archival ingestion, calibrated replay and highlights remain separate gates.

## Real-ground acceptance checklist

1. Verify Supabase migrations and production ownership; retain evidence of backup and restore.
2. Pilot one consenting adult device in a private test room. Confirm publisher is visible in LiveKit and that the director cannot access another organisation's room.
3. Confirm Start returns a **real** LiveKit egress ID and a private S3 object is written; confirm Stop, signed webhook, final provider status and object integrity.
4. Attempt duplicate start requests, forged cloud tokens, cross-club access, revoked member, another paired operator, missing consent and cloud switch off. All must fail closed.
5. Test four cameras on Wi-Fi and 4G/5G, phone sleep/reconnect, loss of electricity, delayed webhooks, provider outage, 4+ hour recordings and quota limits.
6. Test consent withdrawal (including an ongoing provider job), junior footage exclusion, deletion/retention compliance, blur processing and export permissions.
7. Only after sign-off enable paid provider usage, budget monitoring, server-side event-driven auto-start/stop and verified media ingestion.

References: LiveKit JS server SDK v2, LiveKit Egress API, Supabase Storage/RLS and Edge Function docs.


## Next phase: match-status auto-recording and fail-safe reconciliation

The new **camera-cloud-auto** Edge Function is an internal **CRON_SECRET-authenticated** worker. It never accepts browser actions or match IDs in request bodies. It is deliberately **not scheduled by default**. The new cloud_camera_match_auto migration must be deployed **only to CricLume's approved Supabase project**, after staging tests and backup.

Safeguards implemented in source:

- **Two switches:** the operator must explicitly enable *Automatic cloud recording* and attest that footage is **adult-only**, while the backend must have CRICLUME_CLOUD_AUTO_ENABLED=true. Local recording arming alone does not trigger paid server recording. A director cannot opt in on an operator's behalf.
- The phone must still explicitly select **Publish to cloud recorder**, sending its camera to the private LiveKit room. The worker verifies the actual publisher, a **live** match, an **open** room, and valid local recording consent and arming.
- Each room/device can issue **only one automatic recording attempt per match**. That prevents endless chargeable restarts after failure, a manual stop or the hard duration limit.
- On each invocation, the worker checks active **manual and automatic** provider sessions before starting anything. It attempts to stop recordings on match end, room closure, disarm or consent withdrawal; it also stops automatic recordings on opt-out or loss of adult-only attestation.
- The default cost ceiling is **four concurrent active provider jobs** and **120 minutes per job**. Server settings can adjust this within 1–8 concurrent jobs and 5–240 minutes. A duration-limit stop does not automatically restart.
- A job without a confirmed provider egress ID remains pending rather than being marked as stopped. Provider completion is NOT proof of verified archival storage.
- No cloud footage is automatically published to public scoreboards or the private clip library; junior or uncertain-age footage is ineligible for auto-start.
- A phone's consent withdrawal disconnects its local publisher immediately, but an offline phone cannot guarantee provider revocation; the scheduled stop process must be audited and monitored.

### Activation checklist

1. Connect to **CricLume, not Dishbee**, apply the generated cloud_camera_match_auto migration after the existing LiveKit egress migration, and run isolated SQL/RLS security tests.
2. Deploy camera-cloud, camera-cloud-webhook and camera-cloud-auto with the approved CricLume project. The worker has verify_jwt=false but requires an unguessable, server-only x-cron-secret matching CRON_SECRET.
3. Validate the real LiveKit and private S3 connection, backup, consent and retention rules before setting CRICLUME_CLOUD_CAPTURE_ENABLED=true. Automatic matches require a second, separately authorised CRICLUME_CLOUD_AUTO_ENABLED=true.
4. Configure a trusted scheduler to send POST to /functions/v1/camera-cloud-auto every minute with x-cron-secret set to CRON_SECRET. Do not put this secret into app bundles or source control. Avoid overlapping schedulers; uniqueness indexes are defense in depth.
5. Optionally use CRICLUME_CLOUD_AUTO_MAX_ACTIVE=4 and CRICLUME_CLOUD_MAX_MINUTES=120 to bound provider charges.
6. Pilot one consenting adult-only phone. Start a real live match, verify the actual LiveKit publisher and provider egress ID, private S3 output, stop on match completion, and signed callback.
7. Negatively test missing consent, junior footage, disconnected phone, another club, duplicate workers, provider outage, revoked operator, delayed callbacks and cost cap, then test four phones on mobile data. Do not claim production readiness before real-ground acceptance.

**No production scheduler, provider account or migration has been deployed in this repository update.** Phone publishers must remain active for the provider to capture frames.


## Next phase — private archived MP4 inspection (source only)

New **camera-cloud-archive** server function inspects LiveKit jobs after the provider has reported \`provider_completed\`. It is a separate **CRON_SECRET**-authenticated endpoint, disabled by default with \`CRICLUME_CLOUD_ARCHIVE_CHECK_ENABLED=false\`. It cannot be called from a camera browser.

For every eligible job, the worker derives the canonical object key from the server-verified organisation, room, device and recording ID. It uses the private S3 provider credentials already configured above, performs \`HeadObject\` to confirm object presence and size, then fetches only the first 64 bytes to check the MP4 \`ftyp\` marker. It does **not** read the full video, make public links, or certify player consent.

The worker records one of these limited statuses: uninspected, object confirmed, object missing, invalid object, storage error or manual review required. It checks at most 10 completed jobs per request and stops retrying failures after five attempts. A successful private object check requires at least 1 KiB and a valid MP4 header, but **is not** a checksum, full video decode, publication consent, or safeguarding approval. Recording download, transcode and highlights remain blocked until later verified ingestion and approval.

The new database migration includes columns for private check status, attempt count, object byte length, ETag metadata and timestamps. These are server-written only; club and phone accounts can view permitted check statuses but cannot falsify them.

**Deployment order and conditions:**

1. Obtain permission to operate on the actual CricLume Supabase project, and back up its database. **Never deploy to Dishbee.**
2. Apply the \`camera_cloud_archive_inspection\` migration after the previously merged camera/cloud schema migrations, then deploy \`camera-cloud-archive\`, \`camera-cloud\` and \`integration-readiness\` to that same project.
3. Configure \`CRICLUME_CLOUD_ARCHIVE_CHECK_ENABLED=true\` only after verifying the existing private S3 bucket, object HEAD/GET permissions and CRON_SECRET. It uses the same server-only S3 credentials as LiveKit Egress.
4. Install a trusted scheduled POST to \`/functions/v1/camera-cloud-archive\` using \`x-cron-secret\`, e.g. once a minute. The schedule is **not created by this GitHub change**.
5. Verify with real consenting adult footage: signed provider-complete callback, exact object path, HEAD size, MP4 container header, missing-file retries, forbidden permissions, wrong-tenant access, and no browser-created archive confirmations.
6. Follow with private library ingestion, full playback and checksum checks if required, junior/guardian safeguards, blur and retention/deletion enforcement, and approval before any sharing or highlights.

Existing source-code and CI passing do not mean this worker is active, scheduled, or has inspected any real footage.
