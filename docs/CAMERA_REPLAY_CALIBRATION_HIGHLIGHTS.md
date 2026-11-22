# CricLume two-angle replay and private highlight review

Status: **source-implemented; no CricLume production deployment or real-camera certification**.

## Working controls

The authorised director's existing recorded-camera library now contains a second, optional two-angle workbench. Reviewers can pick two clips from distinct camera devices and load short-lived private signed URLs **only** through the existing consent, retention and blur-aware storage policies. They can control the reference video, while the secondary video seeks to match an **estimated** overlap in recorded UTC media timestamps.

The adjustment formula is:

- Reference event time = reference clip's recorded start + reference elapsed playback time + saved reference clock offset
- Second-camera seek time = reference event time − secondary clip start − saved secondary offset

Reviewers may manually adjust each clip's offset by at most ±30,000 ms, then save their adjustment in a private audit-scoped Supabase table. This is **manual metadata calibration, not frame-accurate audio/video sync**. Device clocks can drift over the course of a match, and network capture/storage can add delays. A 0.3-second mismatch threshold triggers a corrective secondary seek. A clip that does not overlap the reference is paused, not falsely treated as synchronized. A physical audible clap/visible flash test is necessary to establish actual timing error.

Scorer delivery cue buttons use the same adjusted timestamp estimate with a 3-second pre-roll. The scorer's event clock and captured video timestamps can themselves be inaccurate. No ball detection, umpiring result or automatic scoring is inferred from the video.

Reviewers can save **six-second private editorial highlight candidates** anchored to the current reference clip timestamp, an optional actual delivery from the same match, a simple category (wicket, boundary, fielding, moment), and a bounded reviewer note. The server's RLS checks a real consented asset, correct room, current organisation role/director permission, author ID and any linked delivery's matching match. Entries are append-only; there is no public thumbnail, video export, highlight render, social share or AI-generated selection in this phase.

## Privacy, verification and deployment

- Imported LiveKit footage with blur_mode=people **cannot** be played through this workbench until the approved blurred video variant exists and can be signed. A developer cannot bypass this check by calling the replay component with a raw S3 path.
- Private candidate metadata is visible only to authorised club reviewers with access to the referenced asset. Anonymous users, unrelated clubs and browsers attempting to edit/delete historical highlight candidates are denied.
- Clock offsets are per **clip**, not permanent device corrections. Saving another clip's offset is a separate review action. Reviewer attribution and timestamps are kept.
- The GitHub source and database migration require deployment to the correct **CricLume** Supabase project (project ref eivwnjbykohrlxavvpcr), after backups, isolated SQL/RLS tests and a physical-device calibration trial. **Never deploy to Dishbee**, the only Supabase project currently exposed in this connection.
- Two independent video streams are playable only if the browser and network permit both. The video player uses short-lived private links that may expire during an extended review; refresh and reopen them when necessary.
- The next phase can implement a verified timecode calibration procedure, human-reviewed render/export jobs, full-copy checksum/playback validation and lawful publication approvals. Automatic highlights, frame-level synchronization and real cloud video publishing are **not** claimed as complete.

Acceptance: verify two separate consented adult cameras, test device-clock skew and missing overlap, confirm blur-required clips cannot be loaded raw, mark a private wicket/boundary with a valid same-match delivery, reject cross-club reads/inserts, close the match room and verify authorised club review still works, then test junior safeguarding and retention expiry.
