import { useState } from "react";
import { manhattan, partnerships, worm, type InsightInningsData } from "@/lib/match-insights";
import { teamInitials } from "@/lib/match-broadcast";

type ChartKind = "manhattan" | "worm" | "partnerships";

const SERIES = ["series-a", "series-b", "series-c", "series-d"] as const;

/** Manhattan, worm (all innings) and partnerships — the extra charts broadcasters and rival apps show. */
export function MatchCharts({
  innings,
  allInnings,
  ballsPerOver,
  maxOvers,
  teamName,
  playerName,
}: {
  innings: InsightInningsData;
  allInnings: InsightInningsData[];
  ballsPerOver: number;
  maxOvers: number | null;
  teamName: (id: string) => string;
  playerName: (id: string) => string;
}) {
  const [kind, setKind] = useState<ChartKind>("manhattan");
  const withBalls = allInnings.filter((item) => item.balls.length > 0).slice(0, 4);
  const labels = withBalls.map((item, index) => {
    const repeat = withBalls
      .slice(0, index)
      .filter((other) => other.battingTeamId === item.battingTeamId).length;
    return `${teamInitials(teamName(item.battingTeamId))}${repeat ? ` (${repeat + 1})` : ""}`;
  });
  return (
    <article className="broadcast-panel" aria-label="More charts">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="panel-kicker">More charts</h3>
        <div className="insights-toggle" role="tablist" aria-label="Chart type">
          {(
            [
              ["manhattan", "Manhattan"],
              ["worm", "Worm"],
              ["partnerships", "Partnerships"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={kind === value}
              className={kind === value ? "is-active" : ""}
              onClick={() => setKind(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {kind !== "partnerships" && withBalls.length > 0 && (
        <div className="insights-legend mt-3">
          {labels.map((label, index) => (
            <span key={withBalls[index]!.id}>
              <i className={`legend-swatch ${SERIES[index]}`} />
              {label}
            </span>
          ))}
          <span>
            <i className="legend-wicket" />
            Wicket
          </span>
        </div>
      )}
      <div className="mt-3">
        {kind === "manhattan" && <ManhattanChart innings={withBalls} ballsPerOver={ballsPerOver} />}
        {kind === "worm" && (
          <WormChart innings={withBalls} ballsPerOver={ballsPerOver} maxOvers={maxOvers} />
        )}
        {kind === "partnerships" && (
          <PartnershipList innings={innings} playerName={playerName} teamName={teamName} />
        )}
      </div>
    </article>
  );
}

const W = 560;
const H = 230;
const PAD = { left: 32, right: 10, top: 12, bottom: 26 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

function yTicks(max: number) {
  const step = max > 200 ? 50 : max > 100 ? 25 : max > 40 ? 10 : max > 12 ? 4 : 2;
  const top = Math.ceil(max / step) * step;
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, index) => index * step) };
}

function Axes({
  top,
  ticks,
  overs,
  x,
}: {
  top: number;
  ticks: number[];
  overs: number;
  x: (over: number) => number;
}) {
  const y = (value: number) => PAD.top + plotH - (value / top) * plotH;
  const xStep = overs > 50 ? 10 : overs > 20 ? 5 : overs > 10 ? 2 : 1;
  return (
    <>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
          <text x={PAD.left - 6} y={y(tick) + 3} textAnchor="end" className="chart-label">
            {tick}
          </text>
        </g>
      ))}
      {Array.from({ length: Math.floor(overs / xStep) }, (_, index) => (index + 1) * xStep).map(
        (over) => (
          <text key={over} x={x(over)} y={H - 8} textAnchor="middle" className="chart-label">
            {over}
          </text>
        ),
      )}
    </>
  );
}

function ManhattanChart({
  innings,
  ballsPerOver,
}: {
  innings: InsightInningsData[];
  ballsPerOver: number;
}) {
  const overs = manhattan(
    innings.map((item) => item.balls),
    ballsPerOver,
  );
  if (!overs.length) return <p className="insights-muted text-sm">No overs yet.</p>;
  const { top, ticks } = yTicks(
    Math.max(6, ...overs.flatMap((over) => over.innings.map((item) => item?.runs ?? 0))),
  );
  const count = Math.max(5, overs.length);
  const slot = plotW / count;
  const x = (over: number) => PAD.left + (over - 0.5) * slot;
  const y = (value: number) => PAD.top + plotH - (value / top) * plotH;
  const barW = Math.max(2, Math.min(18, (slot * 0.8) / Math.max(1, innings.length)));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="insights-chart"
      role="img"
      aria-label={`Manhattan chart over ${overs.length} overs`}
    >
      <Axes top={top} ticks={ticks} overs={count} x={x} />
      {overs.map((over) =>
        over.innings.map((item, index) => {
          if (!item) return null;
          const left = x(over.over) - (barW * innings.length) / 2 + index * barW;
          return (
            <g key={`${over.over}-${index}`}>
              <rect
                x={left}
                y={y(item.runs)}
                width={barW - 1}
                height={Math.max(0, PAD.top + plotH - y(item.runs))}
                rx={1.5}
                className={`chart-series ${SERIES[index]}`}
              >
                <title>{`Over ${over.over}: ${item.runs} runs${item.wickets ? `, ${item.wickets} wkt` : ""}`}</title>
              </rect>
              {Array.from({ length: item.wickets }, (_, w) => (
                <circle
                  key={w}
                  cx={left + (barW - 1) / 2}
                  cy={y(item.runs) - 5 - w * 7}
                  r={2.8}
                  className="chart-wicket-dot"
                />
              ))}
            </g>
          );
        }),
      )}
    </svg>
  );
}

function WormChart({
  innings,
  ballsPerOver,
  maxOvers,
}: {
  innings: InsightInningsData[];
  ballsPerOver: number;
  maxOvers: number | null;
}) {
  const series = innings.map((item) => worm(item.balls, ballsPerOver));
  const lastOver = Math.max(1, ...series.map((points) => points.at(-1)?.over ?? 0));
  const overs = Math.max(5, maxOvers && maxOvers >= lastOver ? maxOvers : lastOver);
  const { top, ticks } = yTicks(
    Math.max(10, ...series.flatMap((points) => points.map((point) => point.total))),
  );
  const x = (over: number) => PAD.left + (over / overs) * plotW;
  const y = (value: number) => PAD.top + plotH - (value / top) * plotH;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="insights-chart"
      role="img"
      aria-label="Worm chart of cumulative runs"
    >
      <Axes top={top} ticks={ticks} overs={overs} x={x} />
      {series.map((points, index) => (
        <g key={innings[index]!.id}>
          <path
            d={points
              .map(
                (point, i) =>
                  `${i === 0 ? "M" : "L"}${x(point.over).toFixed(1)},${y(point.total).toFixed(1)}`,
              )
              .join(" ")}
            className={`chart-worm ${SERIES[index]}`}
          />
          {points
            .filter((point) => point.wickets > 0)
            .map((point) => (
              <circle
                key={point.over}
                cx={x(point.over)}
                cy={y(point.total)}
                r={3.5}
                className="chart-wicket-dot"
              >
                <title>{`Over ${point.over}: ${point.total}, ${point.wickets} wkt`}</title>
              </circle>
            ))}
        </g>
      ))}
    </svg>
  );
}

function PartnershipList({
  innings,
  playerName,
  teamName,
}: {
  innings: InsightInningsData;
  playerName: (id: string) => string;
  teamName: (id: string) => string;
}) {
  const stands = partnerships(innings.balls);
  if (!stands.length) return <p className="insights-muted text-sm">No partnerships yet.</p>;
  const best = Math.max(1, ...stands.map((stand) => stand.runs));
  const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
  return (
    <div>
      <p className="insights-muted mb-3 text-xs">
        {teamName(innings.battingTeamId)} · runs include extras
      </p>
      <ol className="space-y-3">
        {stands.map((stand) => {
          const [a, b] = stand.batters;
          const share = (stand.runs / best) * 100;
          const bat = stand.contributions[0] + stand.contributions[1];
          const aShare = bat ? (stand.contributions[0] / bat) * share : share / 2;
          return (
            <li key={stand.wicket} className="partnership-row">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate">
                  <span className="insights-muted">{ordinal(stand.wicket)} wkt · </span>
                  <strong>{playerName(a)}</strong> {stand.contributions[0]}
                  {b && (
                    <>
                      {" & "}
                      <strong>{playerName(b)}</strong> {stand.contributions[1]}
                    </>
                  )}
                </span>
                <span className="shrink-0 font-display text-base font-bold tabular-nums">
                  {stand.runs}
                  {stand.unbroken ? "*" : ""}
                  <span className="insights-muted text-xs font-normal"> ({stand.balls})</span>
                </span>
              </div>
              <div className="partnership-bar" aria-hidden="true">
                <span className="series-a" style={{ width: `${aShare}%` }} />
                <span className="series-b" style={{ width: `${Math.max(0, share - aShare)}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
