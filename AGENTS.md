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
- Highlight reels are cut client-side from existing camera recordings by `src/lib/highlight-reel.ts` (scorer ball times + device clock + saved calibration); no server video rendering, so reels play in the browser and stay behind the same private-recording access checks.
- The stream overlay (`/overlay/$slug`) reads the same public scoreboard data as `/scoreboard/$slug` — no names, only works once a club publishes the board.
