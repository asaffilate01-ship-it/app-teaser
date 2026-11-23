import type { GroundBoard, GroundPageId } from "@/lib/ground-board";
import { wormLine } from "@/lib/ground-board";
import { predictWin, type MatchConditions } from "@/lib/win-predictor";

/** One widescreen (16:9) page of the ground screen. Sizes use the stage's container units so it stays sharp at HD or 4K. */
export function GroundPage({ page, board, state }: { page: GroundPageId; board: GroundBoard; state: Record<string, unknown> }) {
  switch (page) {
    case "score":
      return <ScorePage board={board} />;
    case "batting":
      return <BattingPage board={board} />;
    case "bowling":
      return <BowlingPage board={board} />;
    case "manhattan":
      return <ManhattanPage board={board} />;
    case "worm":
      return <WormPage board={board} />;
    case "chase":
      return <ChasePage board={board} state={state} />;
  }
}

function ScorePage({ board }: { board: GroundBoard }) {
  const { feed } = board;
  const striker = board.batting.find((row) => row.onStrike) ?? board.batting.find((row) => row.atCrease);
  const other = board.batting.find((row) => row.atCrease && row !== striker);
  const bowler = board.bowling.find((row) => row.current);
  const cells: Array<[string, string | number]> = [
    ["Overs", feed.oversLimit ? `${feed.overs} / ${feed.oversLimit}` : feed.overs],
    ["Run rate", feed.runRate?.toFixed(2) ?? "–"],
    ...(feed.target ? ([["Target", feed.target]] as Array<[string, number]>) : []),
    ...(board.partnership ? ([["Partnership", `${board.partnership.runs} (${board.partnership.balls})`]] as Array<[string, string]>) : []),
  ];
  return (
    <div className="gs-score">
      <div className="gs-total">
        <span className="gs-team">{feed.battingTeam}</span>
        <span className="gs-runs">
          {feed.runs}
          <span className="gs-slash">/</span>
          {feed.wickets}
        </span>
        {(feed.freeHit || feed.superOver) && <span className="gs-alert">{feed.freeHit ? "FREE HIT" : "SUPER OVER"}</span>}
      </div>
      <div className="gs-cells">
        {cells.map(([key, value]) => (
          <div key={key}>
            <span>{key}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="gs-crease">
        {[striker, other].map((row, index) => (
          <div key={index} className={row?.onStrike ? "is-strike" : ""}>
            <span>{row ? `${row.name}${row.onStrike ? " *" : ""}` : index === 0 ? "Striker" : "Non-striker"}</span>
            <strong>{row ? `${row.runs} (${row.balls})` : "–"}</strong>
          </div>
        ))}
        <div>
          <span>{bowler?.name ?? "Bowler"}</span>
          <strong>
            {bowler
              ? `${bowler.wickets}-${bowler.runs} (${bowler.overs})`
              : feed.bowler
                ? `${feed.bowler.wickets}-${feed.bowler.runs} (${feed.bowler.overs})`
                : "–"}
          </strong>
        </div>
      </div>
      <div className="gs-balls" aria-label="Last balls">
        {feed.lastBalls.length === 0 ? (
          <span className="gs-muted">Waiting for the first ball</span>
        ) : (
          feed.lastBalls.map((ball, index) => (
            <span key={index} className={`gs-ball ${ball === "W" ? "is-wicket" : ball === "4" || ball === "6" ? "is-boundary" : ""}`}>
              {ball}
            </span>
          ))
        )}
      </div>
      {feed.result && <p className="gs-result">{feed.result}</p>}
    </div>
  );
}

function BattingPage({ board }: { board: GroundBoard }) {
  return (
    <div className="gs-table-page">
      <table className="gs-table">
        <thead>
          <tr>
            <th className="gs-left">Batter</th>
            <th className="gs-left">How out</th>
            <th>R</th>
            <th>B</th>
            <th>4s</th>
            <th>6s</th>
            <th>SR</th>
          </tr>
        </thead>
        <tbody>
          {board.batting.slice(0, 11).map((row) => (
            <tr key={row.no} className={row.atCrease ? "is-live" : row.how !== "not out" ? "is-out" : ""}>
              <td className="gs-left">
                {row.name}
                {row.onStrike ? " *" : ""}
              </td>
              <td className="gs-left gs-how">{row.atCrease ? "batting" : row.how}</td>
              <td className="gs-strong">{row.runs}</td>
              <td>{row.balls}</td>
              <td>{row.fours}</td>
              <td>{row.sixes}</td>
              <td>{row.strikeRate?.toFixed(1) ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="gs-table-foot">
        <span>Extras {board.extras}</span>
        <span>
          Total{" "}
          <strong>
            {board.feed.runs}/{board.feed.wickets}
          </strong>{" "}
          ({board.feed.overs} ov)
        </span>
      </p>
    </div>
  );
}

function BowlingPage({ board }: { board: GroundBoard }) {
  return (
    <div className="gs-table-page">
      <table className="gs-table">
        <thead>
          <tr>
            <th className="gs-left">Bowler</th>
            <th>O</th>
            <th>M</th>
            <th>R</th>
            <th>W</th>
            <th>Econ</th>
          </tr>
        </thead>
        <tbody>
          {board.bowling.slice(0, 11).map((row) => (
            <tr key={row.no} className={row.current ? "is-live" : ""}>
              <td className="gs-left">{row.name}</td>
              <td>{row.overs}</td>
              <td>{row.maidens}</td>
              <td>{row.runs}</td>
              <td className="gs-strong">{row.wickets}</td>
              <td>{row.economy.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const W = 1600;
const H = 620;
const PAD = { left: 90, right: 30, top: 30, bottom: 70 };
const tickStep = (overs: number) => (overs > 25 ? 5 : overs > 12 ? 2 : 1);

function Legend({ board }: { board: GroundBoard }) {
  return (
    <div className="gs-legend">
      {board.progress
        .filter((innings) => !innings.superOver)
        .slice(-2)
        .map((innings, index) => (
          <span key={index}>
            <i className={`gs-key gs-key-${index % 2}`} /> {innings.team}
          </span>
        ))}
      <span>
        <i className="gs-key gs-key-wicket" /> Wicket
      </span>
    </div>
  );
}

function ManhattanPage({ board }: { board: GroundBoard }) {
  const innings = board.progress.filter((item) => !item.superOver).slice(-2);
  const overs = Math.max(1, ...innings.map((item) => item.overs.length), board.feed.oversLimit ?? 0);
  const top = Math.max(6, ...innings.flatMap((item) => item.overs.map(([runs]) => runs)));
  const scaleMax = Math.ceil(top / 4) * 4;
  const slot = (W - PAD.left - PAD.right) / overs;
  const bar = (slot * 0.8) / Math.max(1, innings.length);
  const y = (runs: number) => H - PAD.bottom - (runs / scaleMax) * (H - PAD.top - PAD.bottom);
  return (
    <div className="gs-chart-page">
      <svg viewBox={`0 0 ${W} ${H}`} className="gs-chart" role="img" aria-label="Runs per over for each innings">
        {Array.from({ length: 5 }, (_, i) => (scaleMax / 4) * i).map((value) => (
          <g key={value}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} className="gs-grid" />
            <text x={PAD.left - 16} y={y(value) + 10} className="gs-axis" textAnchor="end">
              {value}
            </text>
          </g>
        ))}
        {innings.map((item, inningsIndex) =>
          item.overs.map(([runs, wickets], over) => {
            const x = PAD.left + over * slot + slot * 0.1 + inningsIndex * bar;
            return (
              <g key={`${inningsIndex}-${over}`}>
                <rect
                  x={x}
                  y={y(runs)}
                  width={Math.max(2, bar - 3)}
                  height={Math.max(0, H - PAD.bottom - y(runs))}
                  className={`gs-bar gs-bar-${inningsIndex % 2}`}
                  rx={3}
                />
                {Array.from({ length: wickets }, (_, w) => (
                  <circle key={w} cx={x + (bar - 3) / 2} cy={y(runs) - 16 - w * 26} r={10} className="gs-wicket" />
                ))}
              </g>
            );
          }),
        )}
        {Array.from({ length: overs }, (_, over) => over + 1)
          .filter((over) => over === 1 || over % tickStep(overs) === 0)
          .map((over) => (
            <text key={over} x={PAD.left + (over - 0.5) * slot} y={H - PAD.bottom + 44} className="gs-axis" textAnchor="middle">
              {over}
            </text>
          ))}
      </svg>
      <Legend board={board} />
    </div>
  );
}

function WormPage({ board }: { board: GroundBoard }) {
  const innings = board.progress.filter((item) => !item.superOver).slice(-2);
  const lines = innings.map((item) => wormLine(item.overs));
  const overs = Math.max(1, ...innings.map((item) => item.overs.length), board.feed.oversLimit ?? 0);
  const top = Math.max(20, board.feed.target ?? 0, ...lines.flat());
  const scaleMax = Math.ceil(top / 20) * 20;
  const x = (over: number) => PAD.left + (over / overs) * (W - PAD.left - PAD.right);
  const y = (runs: number) => H - PAD.bottom - (runs / scaleMax) * (H - PAD.top - PAD.bottom);
  return (
    <div className="gs-chart-page">
      <svg viewBox={`0 0 ${W} ${H}`} className="gs-chart" role="img" aria-label="Running total by over for each innings">
        {Array.from({ length: 5 }, (_, i) => (scaleMax / 4) * i).map((value) => (
          <g key={value}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} className="gs-grid" />
            <text x={PAD.left - 16} y={y(value) + 10} className="gs-axis" textAnchor="end">
              {value}
            </text>
          </g>
        ))}
        {board.feed.target != null && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(board.feed.target)} y2={y(board.feed.target)} className="gs-target" />
            <text x={W - PAD.right} y={y(board.feed.target) - 12} className="gs-axis" textAnchor="end">
              Target {board.feed.target}
            </text>
          </g>
        )}
        {lines.map((line, index) => (
          <g key={index}>
            <polyline points={line.map((runs, over) => `${x(over)},${y(runs)}`).join(" ")} className={`gs-line gs-line-${index % 2}`} />
            {innings[index]!.overs.map(([, wickets], over) =>
              wickets > 0 ? <circle key={over} cx={x(over + 1)} cy={y(line[over + 1] ?? 0)} r={11} className="gs-wicket" /> : null,
            )}
          </g>
        ))}
        {Array.from({ length: overs + 1 }, (_, over) => over)
          .filter((over) => over > 0 && over % tickStep(overs) === 0)
          .map((over) => (
            <text key={over} x={x(over)} y={H - PAD.bottom + 44} className="gs-axis" textAnchor="middle">
              {over}
            </text>
          ))}
      </svg>
      <Legend board={board} />
    </div>
  );
}

function ChasePage({ board, state }: { board: GroundBoard; state: Record<string, unknown> }) {
  const { feed } = board;
  const settings = (state["settings"] ?? {}) as Record<string, unknown>;
  const numberOr = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
  const bpo = numberOr(settings["ballsPerOver"], 6);
  const maxWickets = numberOr(state["maxWickets"], 10);
  const parts = /^(\d+)\.(\d+)$/.exec(feed.overs);
  const legal = parts ? Number(parts[1]) * bpo + Number(parts[2]) : 0;
  const prediction = predictWin({
    oversPerInnings: feed.oversLimit,
    inningsPerSide: numberOr(settings["inningsPerSide"], 1),
    ballsPerOver: bpo,
    inningsNumber: numberOr(state["inningsNumber"], 2),
    runs: feed.runs,
    wickets: feed.wickets,
    legalBalls: legal,
    target: feed.target,
    maxWickets,
    battingIsHome: state["battingIsHome"] === true,
    conditions: (state["conditions"] as MatchConditions | null) ?? undefined,
  });
  const need = feed.runsNeeded ?? 0;
  const rateMax = Math.max(12, feed.runRate ?? 0, feed.requiredRate ?? 0);
  const rates: Array<[string, number | null, string]> = [
    ["Current rate", feed.runRate, "gs-rate-now"],
    ["Required rate", feed.requiredRate, "gs-rate-need"],
  ];
  return (
    <div className="gs-chase">
      <p className="gs-chase-need">
        {need > 0 ? (
          <>
            {feed.battingTeam} need <strong>{need}</strong> {need === 1 ? "run" : "runs"}
            {feed.ballsLeft != null && (
              <>
                {" "}
                from <strong>{feed.ballsLeft}</strong> {feed.ballsLeft === 1 ? "ball" : "balls"}
              </>
            )}
          </>
        ) : (
          <>{feed.battingTeam} have reached the target</>
        )}
      </p>
      <div className="gs-cells">
        <div>
          <span>Target</span>
          <strong>{feed.target}</strong>
        </div>
        <div>
          <span>Score</span>
          <strong>
            {feed.runs}/{feed.wickets}
          </strong>
        </div>
        <div>
          <span>Wickets left</span>
          <strong>{Math.max(0, maxWickets - feed.wickets)}</strong>
        </div>
        {feed.par != null && (
          <div>
            <span>Par (rain rules)</span>
            <strong>{feed.par}</strong>
          </div>
        )}
      </div>
      <div className="gs-rates">
        {rates.map(([label, value, tone]) => (
          <div key={label} className="gs-rate">
            <span>{label}</span>
            <div className="gs-rate-track">
              <div className={`gs-rate-fill ${tone}`} style={{ width: `${Math.min(100, ((value ?? 0) / rateMax) * 100)}%` }} />
            </div>
            <strong>{value != null ? value.toFixed(2) : "–"}</strong>
          </div>
        ))}
      </div>
      {prediction && (
        <div className="gs-win">
          <span>Win chance</span>
          <div className="gs-win-bar">
            <div className="gs-win-bat" style={{ width: `${Math.max(8, Math.min(92, prediction.battingWin))}%` }}>
              {feed.battingTeam} {prediction.battingWin}%
            </div>
            <div className="gs-win-bowl">
              {feed.bowlingTeam} {prediction.bowlingWin}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
