# CricLume — making the app feel premium and beat the competition

## What I found (quick review on phone and desktop)

- **Club workspace can't work yet.** The online database is empty, so sign-in, clubs, leagues, live sharing and cameras can't save anything. This has to be fixed before anything else.
- **Each part of the app looks like a different product.** The promo site, scorer, club workspace, camera and director screens all use different headers. Only the promo site has the bottom menu.
- **The logo is hard to read on dark screens.** The "Cric" part disappears on the scorer and club workspace headers.
- **Some wording sounds technical or unfinished,** e.g. "being tested in the cloud pilot", "Database row-level security applies your assigned role", "Choose File No file chosen".
- **The scorer home puts "Restore from a backup" above your matches.** It's a rare task but it's the first thing people see.
- **The sign-in page is a small box in a big empty screen.** No Google sign-in, no way back, no reassurance about what happens next.
- **The first visit has no guided start.** No setup steps for club, teams and the first match.

## Competitors to beat
CricHeroes, CricClubs, Play-Cricket Scorer, PitchVision.
CricLume's edge: **every ball linked to video from several phones, works offline, and leagues can watch live.** The plan makes that edge obvious and quick to use.

## The plan (in order)

### 1. Get the club workspace working
- Set up the online database with all the club, league, match, camera and sharing data.
- Add **Google sign-in** next to the email link.
- After someone signs in for the first time, create their profile and accept any invites automatically.

### 2. One app, one navigation
- One header everywhere, using a logo version that's easy to read on dark screens.
- **Phone:** a bottom menu like a native app: *Score · Matches · Live · Club · More*. Big tap targets, and the bar stays clear of the iPhone home bar.
- **Tablet/desktop:** a slim side menu with the same sections, plus a quick switcher for the current match or club.
- Clear back buttons and page titles on every screen. The camera and director screens get a simple "Exit to match" button.

### 3. Better first visit
- Sign-in page shows the product (live scoreboard preview) next to the form, with Google sign-in and a "Back to site" link.
- A setup checklist on first visit: *Create club → Add team & players → Invite a scorer → Start first match*, with a progress ring.
- Ready-made match types: T20, The Hundred, 40/50 over, multi-day, and custom.

### 4. A scoring screen made for the boundary edge
- Big buttons in easy thumb reach for 0–6, wide, no-ball, bye, leg-bye, wicket.
- Bottom sheets for wicket type, fielder and shot direction, so the score stays visible.
- One-tap **Undo**, a light vibration on each ball, and a "saved" tick.
- End-of-over summary, strike rotation shown, and a layout for holding the phone sideways.
- "Restore from a backup" moves into a *More* menu. The matches list comes first.

### 5. Live sharing that spreads
- Every live match gets a share link and **QR code**.
- **WhatsApp/Instagram share cards** with an auto-made score image at the toss, wickets, innings break and result.
- A live score widget clubs can put on their own website.
- Followers can get alerts for wickets, milestones and results.

### 6. Premium look and feel
- Tidy the wording everywhere: plain, confident, no "pilot" or technical words.
- Placeholder outlines while content loads instead of blank screens. Friendly empty states with clear next steps.
- Smooth page changes, gentle animations when you press buttons, and one card style everywhere.
- Light and dark mode switch.
- Keyboard focus, colour contrast and text size checked so everything stays easy to read outdoors in sunlight.

### 7. Features that set CricLume apart
- **Player profiles** with career stats, form and a clip for every dismissal and boundary.
- **Automatic highlights reel** after each match, from the linked camera clips.
- **AI match report** you can share in one tap.
- **League hub:** tables, fixtures and a "matches live now" board update by themselves.

## What you'll be able to try after each step
1 → sign in and create a club · 2 → move around the app with the bottom menu · 3 → follow the setup checklist · 4 → score a full over one-handed · 5 → share a live link and score card · 6/7 → profiles, highlights and reports.

## Technical details
- Apply the three repo migrations through the migration tool. Replace the `auth.users` triggers with `ensure_my_profile` / `activate_my_memberships` RPCs, called from `use-cloud-session` after sign-in. Create the `match-video` bucket with the storage tool. Configure Google + Lovable OAuth.
- Make a shared `AppShell` (header, `BottomTabBar` on mobile, `SideNav` on md+) and wrap `/app`, `/platform`, `/scoreboard`, `/camera`, `/director` in it. Keep `index.tsx` as the marketing page.
- Add a light-wordmark logo asset for dark surfaces. Put all colour, shadow and motion values in `src/styles.css` tokens, and add `.dark`/light theme switching.
- Use the shadcn `Drawer` for scoring sheets, `navigator.vibrate` for vibration, and safe-area padding for the bottom bar.
- Render share cards on a canvas in the browser. Make QR codes with a small library. Add an embed widget as a public `/embed/$slug` route.
- Add Vitest tests for the scoring rules touched in step 4 (extras, strike rotation, over completion).
- Commit to git after each step.
