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
- Highlight reels are cut client-side by `src/lib/highlight-reel.ts`; no server rendering, same private-recording checks.
- The stream overlay (`/overlay/$slug`) reads the same public data as `/scoreboard/$slug` — no names.
- Match alerts use WebCrypto Web Push (`src/lib/web-push.server.ts`, key from `PUSH_VAPID_SECRET`), name-free text from `src/lib/match-alerts.ts`, sent only by a match's scorers — no Node packages on the edge worker.
- Awards/scouting computed client-side (`awards.ts`, `scouting.ts`); shared reports are frozen `scouting_reports` read via `get_shared_scouting_report` (hashed token, ≤180 days, consent).
- Camera phone limits are enforced in the DB (`pair_camera_device` locks the room, counts phones without `removed_at`; capacity/remove RPCs director-only) — holds under races; removing a phone keeps recordings.
- Club office (`src/components/office/*`, data in `src/lib/club-office-cloud.ts`, pure rules in `src/lib/club-office.ts`) relies on database RLS, triggers and RPCs for every permission (finance/store/booking/selection managers, guardians via `player_guardians`, driver approval by owner/safeguarding only); the UI only hides controls — so a changed role or a hand-made request can never get past the club's rules.
- Member fee payments are bank/wallet transfers the member reports with a reference (`fee_payment_claims`); only `decide_fee_claim` (finance roles) turns one into a `fee_payments` row — no live payment gateway is involved, references can't be reused, and claims can't exceed what's owed.
- What each pricing plan includes (free/paid/add-on) lives in `src/lib/plans.ts`; the pricing page and any in-app checks must read that one table so the rules never drift apart.
- Default prices: `pricingRegionFor()` (`src/lib/pricing.ts`) from hosting-network country, then browser language — one tested rule.
- The root `.env` (publishable backend URL/key only, never secrets) is committed to Git — published builds are made from the repo and lose the backend connection without it.
- The per-match camera phone limit lives in `src/lib/camera-limits.ts` and must match the `camera_rooms` check constraint and `set_camera_room_capacity` — the database is the real limit; the UI only offers the same choices.
- The ground big screen (`/ground/$slug`) builds its pages from public liveState (`src/lib/ground-board.ts`); players appear only as per-match hashed refs (`src/lib/sha256.ts`), and real names come solely from `get_ground_screen_names`, which applies the club switch and junior consent — so the public feed never carries names.
- The site sends `frame-ancestors 'none'`, so in-app previews of other pages are components (e.g. `GroundPreview`), never iframes.
- Public club websites (`/club/$slug`, editor in the Website workspace tab) read only through the `get_club_site` RPC (published sites, public matches, signed-off standings, no player names); files live in the private `club-site` bucket and reach visitors as short-lived signed links, because public buckets are blocked and drafts must stay private.
- League results are confirmed through `report_fixture_result` (each team's admins/managers/scorers) and `sign_off_fixture_result` / `reopen_fixture_result` (league owner/admins only); the results desk reads `fixture_results_inbox` and its states come from `src/lib/results-desk.ts` — only signed-off results reach league tables.
- Offline app: `vite-plugin-pwa` (generateSW, `vite.config.ts`) writes `/sw.js` into `dist/client`; push handlers and old-cache cleanup live in `public/sw-extras.js` (importScripts); `__root` registers it only on `/app` and `/platform` via `src/lib/sw-guard.ts`; `/app` is NetworkFirst with this build's install-time copy as fallback — never hand-write `sw.js` or cache other pages' HTML.
- Scoring sync: every change is queued on-device per match and sent by one ordered drainer (`flushPendingEvents`, Web Lock, backoff in `src/lib/sync-retry.ts`); offline innings use phone-chosen IDs (`start_match_innings_v2`) — server idempotency on client event IDs makes resends safe.
- Scoring duties: `match_scoring_duties` enforced in the DB (`my_match_duties`, `append_match_event`, `tag_delivery_v1`); only batting/lead phones send snapshots, bowling & fielding send notes all phones re-apply (`src/lib/scoring-duties.ts`) — scorers never overwrite each other.
- Ad banners are CricLume-sold `promo_*` campaigns served only via `src/lib/promo.functions.ts` (geo pick, signed `promo-media` links, service-only `record_promo_plays`); DB `promo_share_percent` matches `adRevenueSharePercent` in plans.ts. Avoid the word "ad(s)" in code (blockers strip slots). Empty banners: `fillPromoSlots` paid → `club_promos` → house cards (`house-promos.ts`); only paid counted.
- CricLume staff rights use `user_roles` + `has_role(..., 'admin')`; staff emails listed in `platform_admin_emails` get the role on confirmed sign-in via an `auth.users` trigger — club roles never grant staff access.
- Light/dark: `theme-generated.css` + `theme.css` flip colours under `html[data-theme="light"]`; `src/lib/theme.ts` applies the choice before paint, broadcast/camera pages stay dark — new literal colours use `--tn-*` or tokens.
- Own-domain club sites: `src/server.ts` resolves the host (`resolve_club_site_domain`), `src/lib/club-domains.ts` rewrites to `/club/<slug>`; `club_custom_domain_allowed` = `customDomain` in plans.ts; domains need hosting too. `<name>.criclume.com`: same table (`kind`='criclume'), one-label non-www subdomains, reserved via `is_reserved_club_label`.
- Umpires: rules live in the DB (`umpire_appointment_before`, reply/expense/payment RPCs); `src/lib/umpires.ts` mirrors them for hints; umpires link by confirmed email, not membership.
- Promo screenshots (`src/assets/shot-*`): real captures of a made-up match; order matches `screensTab.items`.
- Live centre (`/live`) reads only `list_public_live_matches` (public, name-free, delay kept).
- Away check scorers (`match_check_scorers`/`match_check_flags`, RPCs only, `/check`): `my_match_duties` returns none for them so the DB blocks every score write; public-board ad credit picks the viewer's playing club via `creditedClub()`.
- Club places: lazy `/public/geo/<CC>.json` (GeoNames, `src/lib/geo.ts`) + free text; team cap = DB `club_team_limit` = `teamLimit()` in plans.ts; leagues/invites only via RPCs (`league_links`, `competition_invites_overview`).
- Light finish: `src/theme-light.css` (light only, skipped in `.stay-dark`) — no markup changes, dark untouched.
