import { useState } from "react";
import type { CricketMatch } from "@/lib/cricket";
import { knownPlayers, knownTeams, matchups, teamHeadToHead } from "@/lib/head-to-head";

/** Team v team record plus batter v bowler contests from the loaded scorecards. */
export function HeadToHead({
  matches,
  onPlayer,
}: {
  matches: readonly CricketMatch[];
  onPlayer: (id: string) => void;
}) {
  const teams = knownTeams(matches);
  const players = knownPlayers(matches);
  const [teamA, setTeamA] = useState(teams[0]?.id ?? "");
  const [teamB, setTeamB] = useState(teams[1]?.id ?? "");
  const allMatchups = matchups(matches);
  const batters = players.filter((player) =>
    allMatchups.some((line) => line.batterId === player.id),
  );
  const [batterId, setBatterId] = useState(batters[0]?.id ?? "");
  if (teams.length < 2)
    return (
      <p className="text-sm text-slate-400">Head-to-heads appear once two teams have played.</p>
    );
  const record = teamA && teamB && teamA !== teamB ? teamHeadToHead(matches, teamA, teamB) : null;
  const name = (id: string) => teams.find((team) => team.id === id)?.name ?? "Team";
  const playerName = (id: string) => players.find((player) => player.id === id)?.name ?? "Player";
  const contests = allMatchups.filter((line) => line.batterId === batterId).slice(0, 12);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="broadcast-panel space-y-4" aria-label="Team head to head">
        <h3 className="panel-kicker">Team v team</h3>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <select
            aria-label="First team"
            value={teamA}
            onChange={(event) => setTeamA(event.target.value)}
            className="scorer-input min-h-10"
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">v</span>
          <select
            aria-label="Second team"
            value={teamB}
            onChange={(event) => setTeamB(event.target.value)}
            className="scorer-input min-h-10"
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        {!record ? (
          <p className="text-sm text-slate-400">Choose two different teams.</p>
        ) : record.played === 0 ? (
          <p className="text-sm text-slate-400">
            These teams have no finished matches in the loaded scorecards.
          </p>
        ) : (
          <>
            <div className="h2h-score">
              <div>
                <strong>{record.wins[teamA] ?? 0}</strong>
                <span className="truncate">{name(teamA)} wins</span>
              </div>
              <div>
                <strong>{record.tied + record.other}</strong>
                <span>Tied / drawn</span>
              </div>
              <div>
                <strong>{record.wins[teamB] ?? 0}</strong>
                <span className="truncate">{name(teamB)} wins</span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rate-stat">
                <dt>Highest · {name(teamA)}</dt>
                <dd>{record.highest[teamA] ?? "–"}</dd>
              </div>
              <div className="rate-stat">
                <dt>Highest · {name(teamB)}</dt>
                <dd>{record.highest[teamB] ?? "–"}</dd>
              </div>
            </dl>
            <ol className="space-y-1.5 text-sm">
              {record.recent.map((item) => (
                <li
                  key={item.matchId}
                  className="flex justify-between gap-3 border-b border-white/5 pb-1.5"
                >
                  <span className="min-w-0 truncate">{item.text}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {new Date(item.date).toLocaleDateString([], {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </article>

      <article className="broadcast-panel space-y-4" aria-label="Batter against bowlers">
        <h3 className="panel-kicker">Batter v bowler</h3>
        {batters.length === 0 ? (
          <p className="text-sm text-slate-400">No balls recorded yet.</p>
        ) : (
          <>
            <select
              aria-label="Batter"
              value={batterId}
              onChange={(event) => setBatterId(event.target.value)}
              className="scorer-input min-h-10"
            >
              {batters.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} · {player.team}
                </option>
              ))}
            </select>
            <div
              className="card-table"
              role="table"
              aria-label={`${playerName(batterId)} against each bowler`}
            >
              <div className="card-row card-head h2h-row" role="row">
                <span role="columnheader">Bowler</span>
                <span role="columnheader">Balls</span>
                <span role="columnheader">Runs</span>
                <span role="columnheader">Out</span>
                <span role="columnheader">SR</span>
              </div>
              {contests.map((line) => (
                <div key={line.bowlerId} className="card-row h2h-row" role="row">
                  <span role="cell" className="card-name">
                    <button
                      type="button"
                      className="hub-player-link"
                      onClick={() => onPlayer(line.bowlerId)}
                    >
                      {playerName(line.bowlerId)}
                    </button>
                    <small>
                      {line.dots} dots · {line.fours}×4 · {line.sixes}×6
                    </small>
                  </span>
                  <span role="cell">{line.balls}</span>
                  <span role="cell" className="card-big">
                    {line.runs}
                  </span>
                  <span role="cell">{line.dismissals}</span>
                  <span role="cell">{line.balls ? line.strikeRate.toFixed(0) : "–"}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </article>
    </div>
  );
}
