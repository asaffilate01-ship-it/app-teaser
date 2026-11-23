<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Club dashboard charts are computed client-side from confirmed `deliveries` rows via pure helpers in `src/lib/match-insights.ts` — keeps the maths testable and avoids new server tables.
- Public `liveState` carries only aggregates plus match settings (overs, balls per over) — names stay private and other devices can still compute chases.
- Shared broadcast-style classes (`broadcast-panel`, `hero-chip`, `action-primary/secondary`, `scoreboard-*`) in `src/styles.css` style all dark app screens — one consistent look without per-screen colour utilities.
- Fielding positions are defined once in `src/lib/field-positions.ts`; every position rolls up to one of nine broad areas via `zoneArea()` so charts, analysis and older saved balls keep working.
- Win chances come from the pure model in `src/lib/win-predictor.ts` (score, wickets, balls left, match conditions); the public scoreboard recomputes them from name-free liveState so no extra server table is needed.
- Ball-by-ball text is template-built in `src/lib/commentary.ts`; public and AI-bound text is generated without a name resolver (roles only) to keep junior players private.
- Lovable AI calls run only in signed-in server functions (`*.functions.ts` + `ai-gateway.server.ts`) so public visitors cannot spend AI credits.
- League hub stats and live placings are computed client-side from per-match snapshots (`src/lib/season-stats.ts`, `src/lib/live-table.ts`); live placings never change net run rate or signed-off standings — keeps official results authoritative.
- Highlight reels are cut client-side from camera recordings by `src/lib/highlight-reel.ts` (ball times + device clock + calibration); no server rendering, same private-recording access checks.
- The stream overlay (`/overlay/$slug`) reads the same public scoreboard data as `/scoreboard/$slug` — no names, only works once a club publishes the board.
- Match alerts use WebCrypto Web Push (`src/lib/web-push.server.ts`, key from `PUSH_VAPID_SECRET`), name-free text from `src/lib/match-alerts.ts`, sent only by a match's scorers — no Node packages on the edge worker.
- Awards (`src/lib/awards.ts`) and scouting (`src/lib/scouting.ts`) are computed client-side; shared scouting reports are frozen `scouting_reports` read only via `get_shared_scouting_report` by hashed token, expiring ≤180 days or on withdrawn consent.
- Camera room phone limits are enforced in the database (`pair_camera_device` locks the room, counts phones without `removed_at`, re-pairing never uses a place; `set_camera_room_capacity` / `remove_camera_device` are director-only) — the limit holds even if two phones join at once, and removing a phone keeps its recordings.
- Club office (`src/components/office/*`, data in `src/lib/club-office-cloud.ts`, pure rules in `src/lib/club-office.ts`) relies on database RLS, triggers and RPCs for every permission (finance/store/booking/selection managers, guardians via `player_guardians`, driver approval by owner/safeguarding only); the UI only hides controls — so a changed role or a hand-made request can never get past the club's rules.
- Member fee payments are bank/wallet transfers the member reports with a reference (`fee_payment_claims`); only `decide_fee_claim` (finance roles) turns one into a `fee_payments` row — no live payment gateway is involved, references can't be reused, and claims can't exceed what's owed.
- What each pricing plan includes (free/paid/add-on) lives in `src/lib/plans.ts`; the pricing page and any in-app checks must read that one table so the rules never drift apart.
- The root `.env` (publishable backend URL/key only, never secrets) is committed to Git — published builds are made from the repo and lose the backend connection without it.
- The per-match camera phone limit lives in `src/lib/camera-limits.ts` and must match the `camera_rooms` check constraint and `set_camera_room_capacity` — the database is the real limit; the UI only offers the same choices.
- The ground big screen (`/ground/$slug`) builds its pages from public liveState (`src/lib/ground-board.ts`); players appear only as per-match hashed refs (`src/lib/sha256.ts`), and real names come solely from `get_ground_screen_names`, which applies the club switch and junior consent — so the public feed never carries names.
- The site sends `frame-ancestors 'none'`, so in-app previews of other pages are components (e.g. `GroundPreview`), never iframes.
- Public club websites (`/club/$slug`, editor in the Website workspace tab) read only through the `get_club_site` RPC (published sites, public matches, signed-off standings, no player names); files live in the private `club-site` bucket and reach visitors as short-lived signed links, because public buckets are blocked and drafts must stay private.
- League results are confirmed through `report_fixture_result` (each team's admins/managers/scorers) and `sign_off_fixture_result` / `reopen_fixture_result` (league owner/admins only); the results desk reads `fixture_results_inbox` and its states come from `src/lib/results-desk.ts` — only signed-off results reach league tables.
- Offline app: `vite-plugin-pwa` (generateSW, `vite.config.ts`) writes `/sw.js` into `dist/client`; push handlers and old-cache cleanup live in `public/sw-extras.js` (importScripts); `__root` registers it only on `/app` and `/platform` via `src/lib/sw-guard.ts`; `/app` is NetworkFirst with this build's install-time copy as fallback — never hand-write `sw.js` or cache other pages' HTML.
- Scoring sync: every change is queued on-device per match and sent by one ordered drainer (`flushPendingEvents`, Web Lock, backoff in `src/lib/sync-retry.ts`); offline innings use phone-chosen IDs (`start_match_innings_v2`) — server idempotency on client event IDs makes resends safe.
- Scoring duties: per-match jobs in `match_scoring_duties` are enforced in the database (`my_match_duties`, `append_match_event`, `tag_delivery_v1`); only the batting/lead phone sends score snapshots, bowling & fielding sends snapshot-free notes every phone re-applies (`src/lib/scoring-duties.ts`) — two scorers never overwrite each other.
- Ad banners are CricLume-sold `promo_*` campaigns served only via `src/lib/promo.functions.ts` (geo pick, signed `promo-media` links, service-only `record_promo_plays`); DB `promo_share_percent` matches `adRevenueSharePercent` in plans.ts. Avoid the word "ad(s)" in code (blockers strip slots).
- CricLume staff rights use `user_roles` + `has_role(..., 'admin')`; staff emails listed in `platform_admin_emails` get the role on confirmed sign-in via an `auth.users` trigger — club roles never grant staff access.
- Light/dark: `src/theme-generated.css` + `src/theme.css` flip colours under `html[data-theme="light"]`; `src/lib/theme.ts` applies the saved choice before paint and keeps broadcast/camera pages dark — new literal colours in styles.css use `--tn-*` or tokens so they follow the switch.
- Own-domain club sites: `src/server.ts` resolves the host (`resolve_club_site_domain`), router `rewrite` (`src/lib/club-domains.ts`) maps clean paths to `/club/<slug>`; plan rule `club_custom_domain_allowed` must match `customDomain` in plans.ts — domains also need connecting in hosting. Free `<name>.criclume.com` addresses: same table (`kind`='criclume'); one-label subdomains (not www) are club hosts; reserved names match `is_reserved_club_label`.
- Umpires: panel/appointment rules live in the database (`umpire_appointment_before`: required checks on match day, 8-hour clash, unavailable day; RPCs for umpire replies, expenses, payments); `src/lib/umpires.ts` mirrors them for ranking and hints — umpires link by confirmed email so they needn't be club members.
- Promo screenshots (`src/assets/shot-*`) are real captures of a made-up match (no real players/teams/brands); `screenShots` order matches `screensTab.items`.
- Live centre (`/live`) reads only `list_public_live_matches` (enabled public boards, name-free liveState subset, delay kept); alerts come from `liveEventsBetween` (`src/lib/live-centre.ts`) comparing polls — no new tables.
