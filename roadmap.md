# CricLume roadmap

- [x] Shared app header, phone bottom menu and readable logo on dark screens
- [x] Club sign-in with Google + email link, redesigned sign-in screen
- [x] First-run setup checklist in the club workspace
- [x] Desktop side menu in the club workspace
- [x] Scorer: move backup restore into "More options"
- [x] Live scoring screen + match cards restyled to match the demo screenshots
- [x] Club overview restyled like the demo dashboard (run-rate chart, wagon wheel, top performers)
- [x] Public live scoreboard, camera and director screens restyled to match
- [x] Verified signed-in club workspace end-to-end (club, teams, players, match, cloud scoring, dashboard charts, public board, camera room)
- [x] Security follow-ups: evidence delete/upload limited to current staff; junior evidence limited to owners, safeguarding officers and the uploader
- [x] Scorer: tap-the-field shot area, one-tap fielder chips with "last here" suggestion, next to the run buttons
- [x] Scorer: 32 fielding positions (ring, deep, close catchers), left-hand batter view, recent positions
- [x] Scorer: many more close fielders (slips 1-4, fly slip, leg gully, short legs, silly mid-on/off, short covers)
- [x] Win predictor (WinViz-style %) from score, wickets, balls left and match conditions; competitor check
- [x] Scorecard: compact mobile layout without long scrolling
- [x] Ball-by-ball text commentary, optional for audiences (templates default)
- [x] AI over summary button (optional, uses AI credits)
- [x] League hub: simultaneous live match cards with drill-in
- [x] League hub: live table projected from current match situations
- [x] League hub: historic scorecards
- [x] League stats: batting (runs, avg, SR, 50s, 100s, HS) and bowling (wkts, avg, econ, SR, best, 5-fors, 10-in-match)
- [ ] Go-live (needs user): payments live keys, email sending, legal/safeguarding sign-off
- [x] Demo-style dashboards: League hub match dashboard + club home closer to demo
- [x] Promo page: show more dashboard screenshots (league hub, match dashboard, stats)

## Competitor gaps (all four groups)
- [x] Rules: free hit after no-ball, Super Over on a tie, last man stands, multi-day declare and follow-on
- [x] Charts: Manhattan, worm (both innings), partnerships
- [x] Share scorecard as image and PDF
- [x] Fixture builder (round-robin)
- [x] Head-to-head records (team v team, batter v bowler)
- [x] Score overlay link for live streams
- [x] Player profiles: career totals, form chart, milestones/badges, Player of the Match
- [x] Auto highlight reels from synced cameras (boundaries, wickets, per player)

## Competitor gaps 1–15 (round 2)
- [x] 5 Over-by-over comparison (Manhattan already compares both innings)
- [x] 14 Rain rules: average run rate, most productive overs, DLS (licensed provider or official target entered), manual target; league default
- [x] 13 Spoken ball-by-ball commentary on the public scoreboard
- [x] 12 Ground scoreboard (LED) feed + big-screen display page
- [x] 11 Rivalries and streaks
- [x] 9 "What do we need to qualify" calculator + spreadsheet import of teams/players
- [x] 8 Multi-day: end of day / stumps
- [x] 6 Social post text + result and match-day posters
- [x] 3 Installable app: install prompt, iPhone instructions, brand colours (store builds need user's developer accounts)
- [x] 7 Phone alerts for wickets, milestones and results (web push) — live site only; needs a real-phone check after publishing
- [ ] 10 Club / league public website pages: branding, news, gallery, documents, fixtures/results
- [x] 1 Live streaming via free OBS: Go live guide (YouTube, Facebook, TikTok) with overlay links
- [ ] 15a Player auction / draft
- [ ] 15b Ground and nets booking requests
- [ ] 15c Match tickets (selling online needs live payments)
- [ ] 15d Merchandise shop (selling online needs live payments)

## Pakistan pricing + CricScoreboard (new ask)
- [x] Review CricScoreboard and compare with the proposed PKR prices
- [ ] Proposed PKR plans: team Basic 25k/yr (scoring + basic video), team Advanced 50k/yr (live streaming, coaching, analytics); leagues ≤10 teams 20k/team/yr, 10+ teams 17.5k/team/yr; +20k/team/yr for full system — waiting on user's go-ahead before changing site prices
- [x] Offline scoring with reliable resync after internet loss: checked (17 tests pass, automatic resend when back online)
- [x] Streaming guide covers Facebook, YouTube and TikTok
- [ ] League bands proposal: teams 1–10 at 20k, teams 11–20 at 17.5k, teams 21+ (multi-division) at 15k, each band charged only on the teams in it; analytics/full system +20k per team. Waiting on user's yes
- [ ] Dashboards and analysis: where to build them in (plans vs more app screens) — waiting on user's answer
- [ ] Club team policy (unlimited teams per club vs per team vs bundle) — waiting on user's answer
- [ ] Login-sharing protections (club branding, two devices per login, suspicious-club flags, scorers locked to teams) — waiting on user's pick
- [x] Remove "features are in development" footer line (all five languages)
- [x] Regional competitor research (Pakistan, Afghanistan, Gulf, East/Southern Africa, Hong Kong, South Asia, North America, England, EU, Australia/NZ, Far East) with ways to be the best
- [x] Camera setup review: how many phones at once for live streaming, recording, playback and coaching analysis; fix any limits that contradict the site
- [x] Awards: man of the match, top scorer, best bowler, best fielder, player of the tournament, prizes
- [x] Scouting reports: coaches/managers share full player reports (strengths, weaknesses, scoring shots, fielding, bowling, analytics) with bigger teams — needs player/guardian consent

## Club office (role-based)
- [x] New roles: treasurer and team manager
- [x] Fees and subs: charges, payments recorded by treasurer, balances; members see only their own
- [x] Ground and nets bookings: own club + requests from other clubs, no double-booking
- [x] Events calendar with player availability (players and parents answer)
- [x] Team selection per event, hidden until published
- [x] Travel: official meet point/time, ride sharing with seat limits; juniors only with approved drivers and parent consent
- [x] Merchandise orders and equipment loans
- [x] Parent/guardian links so parents act for junior players
- [x] Who-can-do-what access table on screen; database rules enforce it
- [x] Members pay fees in the app by Raast / Easypaisa / JazzCash / bank transfer with a reference; club shows its payment details; treasurer confirms each one

## Plan structure (new ask)
- [x] Free = basic scoring only (with ads); Club/League = full scoring analytics; video & video analytics = extra add-on (pricing page, comparison table, FAQs, all five languages)
- [ ] Video add-on price — waiting on user's answer (page shows "quoted per club" meanwhile)
- [ ] Lock analytics and camera rooms inside the app by plan — not started; offer to user

## Ground big screen
- [x] Widescreen HD ground screen with rotating pages: score, batting, bowling, Manhattan, worm, run chase
- [x] Club control panel: automatic or manual pages, page choice, seconds per page
- [x] Video replays of wickets and boundaries on the big screen (only with player public-highlights consent) — not yet tried with real phone recordings
- [x] Player names on the screen: club switch, juniors only with parent-signed consent

## Competitor gaps round 3 (new ask: fill gaps, better phone and desktop)
- [x] Public club and league websites: about, live now, fixtures/results, league table, news, notices, documents, gallery, sponsors, contact — editor in the workspace
- [x] Result confirmation by both teams + league "needs action" inbox (overdue, disputed, unconfirmed results)
- [ ] Umpire appointments per fixture + captain's marks for umpires/pitch and umpire reports
- [ ] Availability upgrades: reply-by deadline, squad cap with waitlist, add to phone calendar
- [ ] Volunteer duties (teas, setup, umpiring, scoring) with self sign-up
- [ ] "Join the club" applications from the public website with an approval queue
- [x] Updated competitor report (round 3) saved to Files

## Offline scoring and sync (new ask)
- [x] Scorer opens and works with no internet (offline app on phones, after one online visit)
- [x] Start the next innings offline; sent in order later
- [x] Automatic resend on weak signal, after sign-in renewal, and when the app comes back to the screen
- [x] Close the scorer offline, reopen online: saved balls still send
- [x] Plain sync wording on the scorer ("Offline · saved on phone · 5 changes to send", "All sent")

## Scoring permissions and split duties (new ask)
- [x] Only signed-in people with the right job for that match can score it (checked by the server)
- [x] Jobs per match: Lead scorer, Batting & runs, Bowling & fielding, Video feed
- [x] Bowling & fielding screen: bowler for the next ball, fielder / position / ball type on recorded balls
- [x] "Your job" strip and scoring team list; club admins (and the lead scorer, for helpers) hand out jobs

## Ad banners and revenue share
- [x] Rotating top + side banners (image, GIF, MP4) on ground big screen, public scoreboard, scorer app and club overview
- [x] Ads targeted by country / region / city
- [x] Club revenue share: free 0%, paid 30%, paid + video add-on 50% (club office → Ad earnings)
- [x] CricLume ads desk (/sponsor-desk) for media@criclume.com: campaigns, uploads, place check, payouts, club plans
- [x] Pricing page + FAQ in five languages say paid clubs show ads and earn a share

## Light/dark switch and own-domain club websites (new ask)
- [x] Light/dark switch on the promo site, club websites and the app (big screens, overlay and camera screens stay dark)
- [x] Premium light theme: readable text, cards and charts in both modes
- [x] League plan: co-branded club website on the club's own domain (request in Website → Own domain, staff desk → Club domains)
- [x] Club logo on the website header
- [x] Pricing, FAQ and plan rules mention the own-domain website (five languages)
- [ ] First real club domain: connect it in hosting settings and switch off the Primary-domain redirect (needs the owner)

## Umpires (new ask)
- [x] Umpire panel for every club and league: grade, qualification, safeguarding / first-aid expiry, kit, paid or voluntary, fee
- [x] Panel rules (which checks are required, default fee, travel rate per km, guidance for umpires)
- [x] Appoint umpires to fixtures with a ranked pick list (available, ready, fair share), clash and "unavailable" checks in the database
- [x] Logistics per appointment: report time, venue, meeting point, contact, travel notes
- [x] Payments: fee + travel expenses, due → approved → paid with reference (treasurer or admin), voluntary umpires
- [x] Umpire dashboard (/umpire): accept/decline, availability calendar, earnings and money owed, logistics, check expiries — across every panel they're on
- [x] Public Live scores page (/live): filters by country/region/competition, many scores at once, alerts for wickets/4s/6s/rain delays/results; scorer "Stop play" button; club "Where you play" setting
