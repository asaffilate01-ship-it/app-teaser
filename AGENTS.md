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
