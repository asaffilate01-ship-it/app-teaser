import type { CricketMatch } from "@/lib/cricket";
import { BIG_SCORE, battingStreaks, rivalries, teamStreaks, wicketStreaks, type PlayerStreak } from "@/lib/streaks";

/** Team form and runs, rivalries, and player streaks from the loaded scorecards. */
export function Streaks({ matches, onPlayer }: { matches: readonly CricketMatch[]; onPlayer: (id: string) => void }) {
  const teams = teamStreaks(matches);
  const rivals = rivalries(matches).slice(0, 6);
  const bats = battingStreaks(matches).slice(0, 8);
  const balls = wicketStreaks(matches).slice(0, 8);
  if (teams.length === 0) return <p className="text-sm text-slate-400">Streaks appear once matches have finished.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="broadcast-panel" aria-label="Team form">
        <h3 className="panel-kicker">Team form</h3>
        <ul className="mt-3 grid gap-2">
          {teams.map((team) => (
            <li key={team.teamId} className="streak-row">
              <span className="min-w-0 truncate font-semibold">{team.name}</span>
              <span className="form-chips" aria-label={`Last ${team.form.length}: ${team.form.join(" ")}`}>
                {team.form.map((letter, index) => (
                  <span key={index} data-letter={letter}>
                    {letter}
                  </span>
                ))}
              </span>
              <span className="streak-meta">
                {team.current ? `${team.current.length} ${team.current.letter} in a row` : "–"} · best {team.longestWinning}W · unbeaten {team.longestUnbeaten}
              </span>
            </li>
          ))}
        </ul>
      </article>

      <article className="broadcast-panel" aria-label="Rivalries">
        <h3 className="panel-kicker">Rivalries</h3>
        {rivals.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Rivalries appear when two teams have met twice.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {rivals.map((pair) => (
              <li key={`${pair.teamA}-${pair.teamB}`} className="rivalry-row">
                <span className="truncate text-right">{pair.nameA}</span>
                <strong>
                  {pair.winsA}–{pair.winsB}
                </strong>
                <span className="truncate">{pair.nameB}</span>
                <small>
                  {pair.played} played{pair.other ? ` · ${pair.other} other` : ""} · last: {pair.lastResult}
                </small>
              </li>
            ))}
          </ul>
        )}
      </article>

      <StreakList title={`${BIG_SCORE}+ scores in a row`} unit="innings" rows={bats} onPlayer={onPlayer} />
      <StreakList title="Wicket in every match" unit="matches" rows={balls} onPlayer={onPlayer} />
    </div>
  );
}

function StreakList({ title, unit, rows, onPlayer }: { title: string; unit: string; rows: PlayerStreak[]; onPlayer: (id: string) => void }) {
  return (
    <article className="broadcast-panel" aria-label={title}>
      <h3 className="panel-kicker">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No streaks of two or more yet.</p>
      ) : (
        <ol className="mt-3 grid gap-1.5">
          {rows.map((row) => (
            <li key={row.playerId}>
              <button type="button" className="streak-player" onClick={() => onPlayer(row.playerId)}>
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{row.name}</span> <small>{row.team}</small>
                </span>
                <span className="shrink-0 text-right">
                  <strong>{row.longest}</strong> <small>{unit} best</small>
                  {row.current >= 2 && <span className="streak-live">{row.current} now</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
