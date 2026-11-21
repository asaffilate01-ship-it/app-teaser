# CricLume P3 — long-form private camera transfer worker

**Status: source-only; OFF by default; no real provider or production deployment verified.** This service is a standalone **Node 24** worker for recordings larger than the 32 MiB Supabase Edge Function pilot. It transfers one approved recording per invocation from a private LiveKit S3-compatible bucket to CricLume's existing private Supabase Storage \`match-video\` bucket using multipart uploads, without loading the whole video into RAM.

## Before connecting or enabling

The repository's correct Supabase project ref is **eivwnjbykohrlxavvpcr**. Current connected Supabase tooling exposes Dishbee only. Never run this worker against Dishbee. The worker explicitly rejects any destination URL/region host that does not use CricLume's project reference.

- Deploy all preceding camera and import schema migrations to the **approved CricLume project** after a backup and staging tests.
- Verify the private destination \`match-video\` bucket already exists and stays non-public. Enable S3 compatibility in that project and create **server-only S3 credentials**. These S3 access keys bypass Supabase RLS; store them in a secret manager and give the worker no external browser access.
- Check source S3 bucket is private with direct read permissions and its original-video retention lifecycle configured. Importing a video does not delete the source.
- Run under a private scheduled service / container with network egress to both S3 endpoints, and **only one worker replica** per project. Use a process supervisor, infrastructure time limits, key rotation, encryption, logging/monitoring and a documented incident response.

### Required private environment

Do not put any of these in frontend \`VITE_\` variables or source control:

| Variable | Value/purpose |
|---|---|
| \`CRICLUME_LONG_TRANSFER_ENABLED\` | \`true\` **only after** staged review; defaults disabled |
| \`CRICLUME_SUPABASE_PROJECT_REF\` | \`eivwnjbykohrlxavvpcr\` |
| \`SUPABASE_URL\` | Correct project \`https://eivwnjbykohrlxavvpcr.supabase.co\` |
| \`SUPABASE_SERVICE_ROLE_KEY\` | Correct project's restricted-use server secret (never a browser key) |
| \`CRICLUME_DESTINATION_S3_ENDPOINT\` | \`https://eivwnjbykohrlxavvpcr.storage.supabase.co/storage/v1/s3\` or the same project's normal Supabase S3 endpoint |
| \`CRICLUME_DESTINATION_S3_REGION\` | Region from CricLume Storage settings |
| \`CRICLUME_DESTINATION_S3_ACCESS_KEY\`, \`CRICLUME_DESTINATION_S3_SECRET_KEY\` | Server-only Supabase S3 keys |
| \`CRICLUME_CAPTURE_S3_ENDPOINT\`, \`CRICLUME_CAPTURE_S3_REGION\`, \`CRICLUME_CAPTURE_S3_BUCKET\` | Existing private LiveKit output storage |
| \`CRICLUME_CAPTURE_S3_ACCESS_KEY\`, \`CRICLUME_CAPTURE_S3_SECRET_KEY\` | Source-provider server keys |

Run from the repository root with Node 24 and a separate locked worker install:

\`\`\`bash
npm ci --prefix workers/camera-long-transfer --omit=dev
node workers/camera-long-transfer/index.mjs
\`\`\`

The Dockerfile has a non-root runtime. Each invocation processes at most **one** queued large file; schedule conservatively and ensure overlapping invocations cannot run. No external schedule has been created by this GitHub phase.

## Actual transfer behavior

1. The existing Edge pilot marks a long recording as \`manual_review\` with \`large_file_requires_external_worker\` instead of pretending it succeeded.
2. The Node worker atomically claims one such row as \`importing\` under a service-only API credential. A crashed/ambiguous job stays \`importing\` until manual reconciliation; **it does not auto-retry or overwrite existing output**.
3. Revalidates real \`provider_completed\`, \`object_confirmed\`, approved owner/safeguarding user, guardian attestation (if applicable), club/device ownership, current camera consent and retention.
4. Reads the exact server-derived S3 object path and ETag; verifies source ContentLength. It will refuse files smaller than 32 MiB + 1 byte or larger than **5 GiB**.
5. Streams source chunks through incremental SHA-256 and MP4 \`ftyp\` header checks into a new private object using 8 MiB multipart parts, two in flight, bounded buffering and per-part AWS SDK retry. Destination size and original ETag are checked again after transfer.
6. Rechecks consent and reviewer role, inserts a private \`video_assets\` row in \`uploading\` state with the computed source SHA-256, then marks it \`uploaded\` only when the private object is confirmed and permissions are still current.
7. Imports retain \`publication_consent=pending\`, \`blur_mode=people\`, and the original approved expiry. **The source is not automatically playable or publishable**. A separate privacy/blur processing and safeguarding approval is required.

This is real streaming multipart code, **not crash-resumable multipart state**. The worker will not resume an incomplete upload across processes without a controlled operator reconciliation. The provider-side file remains private; the worker returns aggregate counts without S3 URLs, player identities or credentials.

## Real pilot validation before production

Test a real approved adult match on CricLume's project: source >32 MiB, end-to-end private transfer, no duplicate processing, SHA-256 evidence and byte-for-byte validation. Also test a 5 GiB file near the bound, network failures, revoked role/consent during transfer, changed ETag, malformed MP4, missing source, destination collision, orphaned multipart uploads, backup/restore, junior guardian controls, and retention of both provider and imported copies.

Stop and reconcile any job stuck \`importing\` manually before attempting a retry. A destination object may exist after an interrupted transfer even when the library state is not \`imported\`. Never overwrite or expose it without checking actual storage and consent.

## Further phases

- Durable provider-managed multipart upload ID tracking and operator-controlled retries/abort (not included).
- Verification of complete target checksum/decodable media rather than only source SHA and destination length.
- Ingestion into the blur-processing pipeline, per-angle calibration and synchronized replay, with separate approval for highlights and AI analysis.
