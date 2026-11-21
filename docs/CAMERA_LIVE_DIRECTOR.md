# CricLume — live camera director pilot

Tracking: #63. Routes: `/platform?section=capture`, `/camera/:roomId`, `/director/:roomId`.

## Implemented on this branch

- Private, per-device WebRTC signalling through Supabase Realtime, restricted by server-side camera and director permissions; multi-angle director focus, two-camera and grid views.
- Camera operator must explicitly start preview, attest club recording permission and separately enable live sharing.
- Per-device automatic recording arming is restricted to the paired operator. Director start/stop requests are authorised via Postgres RLS and audited. An authoritative match transition to **live** requests recording for armed devices; match completion/abandonment/cancellation requests stop.
- Browser capture splits into 60-second WebM/MP4 clips, queues private uploads and offers local downloads for failed uploads. These are real recordings, not demo footage.
- The earlier camera-device update policy is tightened to prevent one viewer changing another device's user identity.

## Important limitations and go-live blockers

**This is a private club pilot, not a production public broadcast.** Browser peer-to-peer video may fail across NAT/carrier networks without approved TURN infrastructure. `VITE_CAMERA_ICE_URL` can configure a STUN server for testing. Do **not** place permanent TURN secrets in public `VITE_` environment variables. Production requires short-lived server-issued ICE credentials and preferably an SFU.

Automatic recording needs the camera phone powered, paired, permitted, previewing and awake. The server can audit a start request but cannot record frames from an offline phone. Uninterrupted unattended recording needs consent-gated server-side egress with a provisioned media provider. The director UI intentionally says *request sent*, not *recording confirmed*. Remote pan/tilt/zoom, public broadcast, highlights publication and biometric recognition are not implemented.

No new production database deployment was performed here. CricLume's project reference from source is `eivwnjbykohrlxavvpcr`; the available Supabase connection points to Dishbee and must **never** be used for these changes.

## Ground-pilot checklist

1. Review and apply `20261121113000_camera_director_controls.sql` to the authorised CricLume project after backup and staging validation.
2. Pair two to four distinct phone accounts and one authorised director; a player/viewer and an unrelated club must fail media and command access.
3. Test WebRTC on same-network devices and with an approved STUN/TURN setup on separate 4G/Wi-Fi networks.
4. Test camera permission revocation, consent withdrawal, device sleep, network loss, reconnect and uploads.
5. Start a real cloud match, verify the server sends an auto-record start to each armed phone, and verify each actual recording and uploaded asset; complete match and verify stop.
6. Check Chrome Android and iPhone Safari, mobile navigation, storage, retention, junior safeguarding and device-specific browser recording support.
7. Run all tests, typecheck, lint, build, database security checks, backup/restore drill and production provider reviews before live operation.

Next: managed SFU and per-track server recording with clock-synchronised every-ball replay; see #63.

## Camera privacy and reconnect hardening (next phase)

- The current code includes a Supabase CLI-generated `camera_media_privacy_gate` migration. It is **source only until explicitly deployed** to the verified CricLume project (not the Dishbee Supabase connection).
- Adult recording review is limited to approved roles (owner, safeguarding officer, club/league administrator or coach) and the original authorised camera operator. Junior or age-uncertain footage is restricted to the safeguarding roles and its original operator.
- Raw sources and unblurred derivatives cannot be signed by ordinary club reviewers when the video policy requests blurring. The playback API no longer provides a separate unblurred-source bypass.
- Authenticated browser users cannot arbitrarily update recording consent/retention or claim that a video processing variant is ready. Trusted service-role processing remains available.
- Video uploads must use the canonical organisation/room/asset/source path. A derived `processed` object path cannot be forged by a camera uploader.
- The camera screen treats the age category as junior/uncertain unless explicitly changed, stops live sharing and capture on consent withdrawal, and refreshes the latest authorised recording command after reconnection.
- The command refresh is **not** a substitute for server-side egress: phones must be awake and have permissions; a stopped or disconnected device does not record.

Before live use, test under real guardian/child safeguarding requirements, negative-role access, a separate scorer/viewer account, cross-organisation access, deleted/expired/withdrawn clips, and private signed URLs. A signed URL issued before consent withdrawal may remain accessible until its short expiry; immediate revocation requires an additional proxy or provider-side revocation mechanism.
