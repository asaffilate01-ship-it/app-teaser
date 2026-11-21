# CricLume — Private cloud archive ingestion pilot

Status: **source-implemented, disabled by default, not deployed to CricLume production**.

This phase transfers a verified LiveKit Egress MP4 from an approved private S3-compatible bucket into CricLume's private match-video Supabase Storage bucket. It does not certify safeguarding, publish video, or generate highlights.

## Human safeguarding review

- Only an active owner or safeguarding_officer for the recording organisation can submit a review approval.
- The officer must attest that recording permission was checked. If junior players may be present (the default), guardian permission must also be attested.
- The review endpoint checks real provider completion, verified S3 object, active device/tenant relationship and continuing recording consent. A successful request creates a queue row, NOT a playable file.
- One review/transfer per recording. RLS denies browser edits to import history or video status.

## Private bounded transfer

- The server-only camera-cloud-import-worker requires CRON_SECRET and a separate disabled-by-default CRICLUME_PRIVATE_IMPORT_ENABLED switch.
- It claims a single approved job per invocation and revalidates the officer's role, operator's consent, source S3 key, size, ETag, and 30-day retention deadline before uploading.
- It accepts real MP4 files up to **32 MiB**. Bigger footage is routed to **manual_review** with a large-file external-worker requirement. No fake transfer success is claimed.
- For a supported clip, it computes full SHA-256 of the actual bytes, writes a private video_assets record in uploading state, uploads to private match-video storage, and only then marks the private asset uploaded.
- Each imported clip has publication_consent=pending, blur_mode=people, recording_consent=granted under an attested review and a 30-day expiry. Ordinary playback stays blocked until a separate privacy-processing provider creates the required blurred variant.
- A failed or interrupted transfer is not automatically retried. The private job must be reconciled before any manual retry, and no public link is issued.

## Production deployment gates

The repository's CricLume Supabase project ref is eivwnjbykohrlxavvpcr. The connected Supabase account currently exposes **Dishbee only**. Never deploy CricLume changes to Dishbee.

1. Verify access to the real CricLume project, back up the database, inspect the private provider bucket and test rollback.
2. Apply the generated camera_private_archive_import migration after the previously merged cloud recording and archive-check migrations.
3. Deploy camera-cloud-import-request with user JWT validation; deploy camera-cloud-import-worker with a CRON_SECRET authenticated POST and no browser JWT.
4. Set CRICLUME_PRIVATE_IMPORT_ENABLED=true only after testing a genuine adult short clip and S3 plus private Supabase Storage permissions. Do not expose S3 credentials, tokens or provider URLs to a browser.
5. Set up a separately managed scheduled worker invocation; no schedule is installed by this GitHub change.
6. Test guardian consent, ongoing consent revocation, owner/safeguarding authorisation, cross-club denial, oversized recordings, changed S3 ETags, false MP4 headers, partial private uploads, storage failure, idempotency and retention.
7. Configure original S3 object lifecycle deletion separately. The 30-day imported asset retention does NOT automatically remove the remote LiveKit S3 original.
8. For longer footage, implement a dedicated streaming/resumable transfer service and independent full-file validation before private review.

**Provider-complete, S3-object-confirmed, approved-for-transfer and uploaded are distinct states. None automatically allows public viewing, export or AI highlights.**
