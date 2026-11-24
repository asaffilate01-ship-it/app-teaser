import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { ScoutingReport } from "@/lib/scouting";
import { figures } from "@/lib/season-stats";

const dismissalWord: Record<string, string> = {
  bowled: "Bowled",
  caught: "Caught",
  lbw: "LBW",
  stumped: "Stumped",
  "run-out": "Run out",
  "hit-wicket": "Hit wicket",
  "obstructing-the-field": "Obstructing",
};

function Bar({
  label,
  value,
  max,
  detail,
}: {
  label: string;
  value: number;
  max: number;
  detail: string;
}) {
  const width = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <li className="scout-bar">
      <span className="scout-bar-label">{label}</span>
      <span className="scout-bar-track" aria-hidden="true">
        <span className="scout-bar-fill" style={{ width: `${width}%` }} />
      </span>
      <span className="scout-bar-value">{detail}</span>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="scout-stat">
      <span>{label}</span>
      <strong>{value ?? "–"}</strong>
    </div>
  );
}

const fixed = (value: number | null | undefined, digits = 1) =>
  value == null ? "–" : value.toFixed(digits);

/** Full scouting report: summary verdicts, batting, bowling, fielding and the coach's notes. */
export function ScoutingReportView({ report }: { report: ScoutingReport }) {
  const { batting, bowling, fielding, coach } = report;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <article className="broadcast-panel">
          <p className="panel-kicker inline-flex items-center gap-1.5">
            <ThumbsUp className="size-3.5" aria-hidden="true" /> Strengths
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {[...report.strengths, ...(coach.strengths ? [coach.strengths] : [])].map((line) => (
              <li key={line}>• {line}</li>
            ))}
            {!report.strengths.length && !coach.strengths && (
              <li className="text-slate-400">Not enough balls yet to judge.</li>
            )}
          </ul>
        </article>
        <article className="broadcast-panel">
          <p className="panel-kicker inline-flex items-center gap-1.5">
            <ThumbsDown className="size-3.5" aria-hidden="true" /> To work on
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {[...report.weaknesses, ...(coach.weaknesses ? [coach.weaknesses] : [])].map((line) => (
              <li key={line}>• {line}</li>
            ))}
            {!report.weaknesses.length && !coach.weaknesses && (
              <li className="text-slate-400">Nothing stands out yet.</li>
            )}
          </ul>
        </article>
      </div>

      {batting && (
        <article className="broadcast-panel space-y-3">
          <p className="panel-kicker">Batting</p>
          <div className="scout-stats">
            <Stat label="Runs" value={batting.stat?.runs} />
            <Stat label="Average" value={fixed(batting.stat?.average)} />
            <Stat label="Strike rate" value={fixed(batting.stat?.strikeRate)} />
            <Stat
              label="High score"
              value={
                batting.stat
                  ? `${batting.stat.highScore}${batting.stat.highScoreNotOut ? "*" : ""}`
                  : null
              }
            />
            <Stat
              label="50s / 100s"
              value={batting.stat ? `${batting.stat.fifties} / ${batting.stat.hundreds}` : null}
            />
            <Stat label="Balls faced" value={batting.ballsFaced} />
            <Stat label="Dot balls" value={`${batting.dotPct}%`} />
            <Stat label="Scoring shots" value={`${batting.scoringShotPct}%`} />
            <Stat label="Boundary balls" value={`${batting.boundaryPct}%`} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-slate-300">Where the runs go</p>
              {batting.runsByArea.length ? (
                <ul className="mt-2 space-y-1.5">
                  {batting.runsByArea.map((row) => (
                    <Bar
                      key={row.area}
                      label={row.area}
                      value={row.runs}
                      max={batting.runsByArea[0]!.runs}
                      detail={`${row.runs} · ${row.pct}%`}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-slate-400">No shot areas recorded yet.</p>
              )}
              <p className="mt-2 text-xs text-slate-400">
                Off side {batting.sides.off}% · Leg side {batting.sides.leg}% · Straight{" "}
                {batting.sides.straight}%
              </p>
            </div>
            <div className="space-y-3">
              {[
                ["Against pace and spin", batting.vsBowling],
                ["By stage of the innings", batting.byPhase],
              ].map(([title, rows]) =>
                (rows as typeof batting.vsBowling).length ? (
                  <div key={title as string}>
                    <p className="text-xs font-semibold text-slate-300">{title as string}</p>
                    <table className="scout-table">
                      <thead>
                        <tr>
                          <th>v</th>
                          <th>Balls</th>
                          <th>Runs</th>
                          <th>Out</th>
                          <th>SR</th>
                          <th>Dots</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rows as typeof batting.vsBowling).map((row) => (
                          <tr key={row.label}>
                            <td>{row.label.replace(/^v /, "")}</td>
                            <td>{row.balls}</td>
                            <td>{row.runs}</td>
                            <td>{row.outs}</td>
                            <td>{fixed(row.strikeRate, 0)}</td>
                            <td>{row.dotPct == null ? "–" : `${row.dotPct}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null,
              )}
              {batting.dismissals.length > 0 && (
                <p className="text-xs text-slate-300">
                  How out:{" "}
                  {batting.dismissals
                    .map((item) => `${dismissalWord[item.type] ?? item.type} ${item.count}`)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
        </article>
      )}

      {bowling && (
        <article className="broadcast-panel space-y-3">
          <p className="panel-kicker">
            Bowling{bowling.styles.length ? ` · ${bowling.styles.join(", ")}` : ""}
          </p>
          <div className="scout-stats">
            <Stat label="Wickets" value={bowling.stat?.wickets} />
            <Stat label="Overs" value={bowling.stat?.overs} />
            <Stat label="Economy" value={fixed(bowling.stat?.economy, 2)} />
            <Stat label="Average" value={fixed(bowling.stat?.average)} />
            <Stat label="Strike rate" value={fixed(bowling.stat?.strikeRate)} />
            <Stat label="Best" value={bowling.stat ? figures(bowling.stat.best) : null} />
            <Stat label="Dot balls" value={`${bowling.dotPct}%`} />
            <Stat label="Boundaries" value={`${bowling.boundaryPct}%`} />
            <Stat label="Extras / over" value={bowling.extrasPerOver} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {bowling.byPhase.length > 0 && (
              <table className="scout-table">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Balls</th>
                    <th>Runs</th>
                    <th>Wkts</th>
                    <th>Econ</th>
                  </tr>
                </thead>
                <tbody>
                  {bowling.byPhase.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{row.balls}</td>
                      <td>{row.runs}</td>
                      <td>{row.wickets}</td>
                      <td>{fixed(row.economy, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {bowling.wicketTypes.length > 0 && (
              <ul className="space-y-1.5">
                {bowling.wicketTypes.map((row) => (
                  <Bar
                    key={row.type}
                    label={dismissalWord[row.type] ?? row.type}
                    value={row.count}
                    max={bowling.wicketTypes[0]!.count}
                    detail={`${row.count}`}
                  />
                ))}
              </ul>
            )}
          </div>
        </article>
      )}

      {fielding && (
        <article className="broadcast-panel space-y-2">
          <p className="panel-kicker">Fielding</p>
          <div className="scout-stats">
            <Stat label="Catches" value={fielding.catches} />
            <Stat label="Stumpings" value={fielding.stumpings} />
            <Stat label="Run outs" value={fielding.runOuts} />
          </div>
          {fielding.positions.length > 0 && (
            <p className="text-xs text-slate-300">
              Dismissals taken at:{" "}
              {fielding.positions.map((item) => `${item.position} (${item.count})`).join(", ")}
            </p>
          )}
        </article>
      )}

      {(coach.notes || coach.author) && (
        <article className="broadcast-panel">
          <p className="panel-kicker">Coach's notes</p>
          {coach.notes && <p className="mt-2 whitespace-pre-line text-sm">{coach.notes}</p>}
          {coach.author && <p className="mt-2 text-xs text-slate-400">— {coach.author}</p>}
        </article>
      )}
      <p className="text-[11px] text-slate-500">
        Built from {report.matches} scored match{report.matches === 1 ? "" : "es"} on{" "}
        {new Date(report.generatedAt).toLocaleDateString()}. Strengths and weaknesses are worked out
        from the scored balls and need enough balls to show.
      </p>
    </div>
  );
}
