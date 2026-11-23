import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  matchesFilter,
  plotShot,
  summarizeWheel,
  type PlottedShot,
  type WheelBall,
  type WheelFilter,
} from "@/lib/wagon-geometry";

const SIZE = 400;
const C = SIZE / 2;
const R = 160;

/** The nine broad areas, right-hander view (degrees clockwise from the keeper). */
const areas: Array<{ name: string; start: number; end: number; label: string }> = [
  { name: "Fine leg", start: 0, end: 33, label: "Fine leg" },
  { name: "Square leg", start: 33, end: 99, label: "Square leg" },
  { name: "Mid-wicket", start: 99, end: 132, label: "Mid-wkt" },
  { name: "Long on", start: 132, end: 165, label: "Long on" },
  { name: "Straight", start: 165, end: 195, label: "Straight" },
  { name: "Long off", start: 195, end: 228, label: "Long off" },
  { name: "Cover", start: 228, end: 294, label: "Cover" },
  { name: "Point", start: 294, end: 327, label: "Point" },
  { name: "Third", start: 327, end: 360, label: "Third man" },
];

const filters: Array<{ id: WheelFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "1", label: "1s" },
  { id: "2", label: "2s" },
  { id: "3", label: "3s" },
  { id: "4", label: "4s" },
  { id: "6", label: "6s" },
  { id: "wickets", label: "Wkts" },
];

/** Screen point for an angle (keeper at the bottom, off side right for a right-hander). */
function toScreen(angle: number, radius: number, leftHanded: boolean) {
  const a = leftHanded ? 360 - angle : angle;
  const rad = ((a + 90) * Math.PI) / 180;
  return { x: C + Math.cos(rad) * radius, y: C + Math.sin(rad) * radius };
}

function wedge(start: number, end: number, leftHanded: boolean) {
  const a = toScreen(start, R, leftHanded);
  const b = toScreen(end, R, leftHanded);
  // Mirroring reverses the sweep direction.
  const sweep = leftHanded ? 0 : 1;
  return `M${C},${C} L${a.x.toFixed(1)},${a.y.toFixed(1)} A${R},${R} 0 0 ${sweep} ${b.x.toFixed(1)},${b.y.toFixed(1)} Z`;
}

const runClass = (shot: PlottedShot) =>
  shot.ball.wicket ? "ww-w" : shot.ball.batterRuns >= 6 ? "ww-r6" : shot.ball.batterRuns === 4 ? "ww-r4" : `ww-r${Math.min(3, shot.ball.batterRuns)}`;

const runWord = (ball: WheelBall) =>
  ball.wicket ? "Wicket" : ball.batterRuns >= 6 ? "SIX" : ball.batterRuns === 4 ? "FOUR" : `${ball.batterRuns} run${ball.batterRuns === 1 ? "" : "s"}`;

export function WagonWheelField({
  balls,
  playerName,
  kicker,
  title = "Wagon wheel",
  compact = false,
  showBowlerFilter = false,
}: {
  balls: WheelBall[];
  playerName: (id: string) => string;
  kicker?: string;
  title?: string;
  compact?: boolean;
  showBowlerFilter?: boolean;
}) {
  const [filter, setFilter] = useState<WheelFilter>("all");
  const [batter, setBatter] = useState("");
  const [bowler, setBowler] = useState("");
  const [area, setArea] = useState("");
  const [leftHanded, setLeftHanded] = useState(false);
  const [activeId, setActiveId] = useState("");

  const scoped = useMemo(
    () => balls.filter((b) => (!batter || b.strikerId === batter) && (!bowler || b.bowlerId === bowler)),
    [balls, batter, bowler],
  );
  const summary = useMemo(() => summarizeWheel(scoped), [scoped]);
  const counts = useMemo(() => {
    const out = {} as Record<WheelFilter, number>;
    for (const f of filters) out[f.id] = scoped.filter((b) => matchesFilter(b, f.id)).length;
    return out;
  }, [scoped]);
  const shots = useMemo(
    () =>
      scoped
        .filter((b) => matchesFilter(b, filter))
        .map((b) => plotShot(b, leftHanded))
        .filter((s): s is PlottedShot => s !== null)
        // Small runs first so boundaries sit on top.
        .sort((a, b) => a.ball.batterRuns - b.ball.batterRuns)
        .slice(-500),
    [scoped, filter, leftHanded],
  );
  const batters = useMemo(() => {
    const runs = new Map<string, number>();
    for (const b of balls) runs.set(b.strikerId, (runs.get(b.strikerId) ?? 0) + b.batterRuns);
    return [...runs.entries()].sort((a, b) => b[1] - a[1]);
  }, [balls]);
  const bowlers = useMemo(() => [...new Set(balls.map((b) => b.bowlerId))], [balls]);

  const active = shots.find((s) => s.ball.id === activeId) ?? null;
  const areaShots = area ? shots.filter((s) => s.area === area) : [];
  const sideTotal = summary.offRuns + summary.legRuns + summary.straightRuns;
  const pct = (value: number) => (sideTotal ? Math.round((value / sideTotal) * 100) : 0);
  const topAreaRuns = Math.max(1, ...summary.areas.map((a) => a.runs));
  const filtered = batter || bowler || filter !== "all" || area;

  const reset = () => {
    setFilter("all");
    setBatter("");
    setBowler("");
    setArea("");
    setActiveId("");
  };

  return (
    <section className="ww" aria-label={title}>
      <header className="ww-head">
        <div className="min-w-0">
          {kicker && <p className="ww-kicker">{kicker}</p>}
          <h2 className="ww-title">{title}</h2>
        </div>
        <div className="ww-hand" role="group" aria-label="Batter's hand">
          <button type="button" aria-pressed={!leftHanded} onClick={() => setLeftHanded(false)}>
            RH
          </button>
          <button type="button" aria-pressed={leftHanded} onClick={() => setLeftHanded(true)}>
            LH
          </button>
        </div>
      </header>

      <div className="ww-chips" role="group" aria-label="Show shots">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`ww-chip ww-chip-${f.id}`}
            aria-pressed={filter === f.id}
            onClick={() => {
              setFilter(f.id);
              setActiveId("");
            }}
          >
            <span className="ww-chip-dot" aria-hidden />
            {f.label}
            <span className="ww-chip-count">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {!compact && batters.length > 1 && (
        <div className="ww-scroll" role="group" aria-label="Batter">
          <button type="button" className="ww-pill" aria-pressed={!batter} onClick={() => setBatter("")}>
            All batters
          </button>
          {batters.map(([id, runs]) => (
            <button key={id} type="button" className="ww-pill" aria-pressed={batter === id} onClick={() => setBatter(batter === id ? "" : id)}>
              {playerName(id)} <span className="ww-pill-runs">{runs}</span>
            </button>
          ))}
        </div>
      )}

      <div className={compact ? "ww-body ww-body-compact" : "ww-body"}>
        <div className="ww-stage">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="ww-svg" role="img" aria-label={`${title}: ${shots.length} shots, ${summary.runs} bat runs`}>
            <defs>
              <radialGradient id="ww-grass" cx="50%" cy="50%" r="50%">
                <stop offset="0%" className="ww-grass-in" />
                <stop offset="100%" className="ww-grass-out" />
              </radialGradient>
              <filter id="ww-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.2" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <circle cx={C} cy={C} r={R + 30} className="ww-apron" />
            <circle cx={C} cy={C} r={R} fill="url(#ww-grass)" />
            {[0.2, 0.4, 0.6, 0.8].map((f) => (
              <circle key={f} cx={C} cy={C} r={R * f + R * 0.1} className="ww-mow" strokeWidth={R * 0.1} />
            ))}
            {areas.map((a) => (
              <path
                key={a.name}
                d={wedge(a.start, a.end, leftHanded)}
                className={`ww-area ${area === a.name ? "is-on" : ""}`}
                onClick={() => {
                  setArea(area === a.name ? "" : a.name);
                  setActiveId("");
                }}
              >
                <title>{a.name}</title>
              </path>
            ))}
            <circle cx={C} cy={C} r={R * 0.5} className="ww-ring" />
            <circle cx={C} cy={C} r={R} className="ww-rope" />
            {areas.map((a) => {
              const p = toScreen((a.start + a.end) / 2, R + 20, leftHanded);
              const stat = summary.areas.find((s) => s.area === a.name);
              return (
                <g key={a.name} className={`ww-label ${area === a.name ? "is-on" : ""}`}>
                  <text x={p.x} y={p.y - 1} textAnchor="middle">{a.label}</text>
                  <text x={p.x} y={p.y + 10} textAnchor="middle" className="ww-label-runs">{stat?.runs ?? 0}</text>
                </g>
              );
            })}
            {/* Pitch: bowler's end up the screen */}
            <rect x={C - 7} y={C - 62} width={14} height={70} rx={2} className="ww-pitch" />
            <line x1={C - 10} x2={C + 10} y1={C - 52} y2={C - 52} className="ww-crease" />
            <line x1={C - 10} x2={C + 10} y1={C - 2} y2={C - 2} className="ww-crease" />
            <text x={20} y={26} className="ww-side">{leftHanded ? "OFF" : "LEG"}</text>
            <text x={SIZE - 20} y={26} textAnchor="end" className="ww-side">{leftHanded ? "LEG" : "OFF"}</text>

            <g>
              {shots.map((s) => {
                const ex = C + s.x * R;
                const ey = C + s.y * R;
                const dim = (area && s.area !== area) || (active && active.ball.id !== s.ball.id);
                const cls = `ww-shot ${runClass(s)} ${dim ? "is-dim" : ""} ${active?.ball.id === s.ball.id ? "is-active" : ""}`;
                const path =
                  s.ball.batterRuns >= 6
                    ? `M${C},${C} Q${C + s.x * R * 0.5 - s.y * 18},${C + s.y * R * 0.5 + s.x * 18} ${ex},${ey}`
                    : `M${C},${C} L${ex},${ey}`;
                const label = `Over ${s.ball.over}.${s.ball.ball}: ${playerName(s.ball.strikerId)}, ${runWord(s.ball)}, ${s.ball.fieldZone}`;
                return (
                  <g
                    key={s.ball.id}
                    className={cls}
                    role="button"
                    tabIndex={0}
                    aria-label={label}
                    onClick={() => setActiveId(activeId === s.ball.id ? "" : s.ball.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveId(activeId === s.ball.id ? "" : s.ball.id);
                      }
                    }}
                  >
                    <path d={path} className="ww-line" filter={s.ball.batterRuns >= 4 ? "url(#ww-glow)" : undefined} />
                    <path d={path} className="ww-hit" />
                    {s.ball.wicket ? (
                      <g className="ww-x" transform={`translate(${ex} ${ey})`}>
                        <line x1={-4.5} y1={-4.5} x2={4.5} y2={4.5} />
                        <line x1={-4.5} y1={4.5} x2={4.5} y2={-4.5} />
                      </g>
                    ) : (
                      <circle cx={ex} cy={ey} r={s.ball.batterRuns >= 4 ? 4.2 : 3} className="ww-end" />
                    )}
                  </g>
                );
              })}
            </g>
            <circle cx={C} cy={C} r={5} className="ww-batter" />
          </svg>

          <p className="ww-caption" role="status">
            {active
              ? `Over ${active.ball.over}.${active.ball.ball} · ${playerName(active.ball.strikerId)} · ${runWord(active.ball)} · ${active.ball.fieldZone}`
              : area
                ? `${area}: ${areaShots.reduce((sum, s) => sum + s.ball.batterRuns, 0)} runs from ${areaShots.length} shots`
                : shots.length
                  ? "Tap a line for the ball, or a slice of the ground to focus on it."
                  : "No shots to show. Pick a field position while scoring to draw it here."}
          </p>
        </div>

        <div className="ww-side-panel">
          <dl className="ww-stats">
            <div>
              <dt>Bat runs</dt>
              <dd>{summary.runs}</dd>
            </div>
            <div>
              <dt>Fours</dt>
              <dd className="ww-t4">{summary.fours}</dd>
            </div>
            <div>
              <dt>Sixes</dt>
              <dd className="ww-t6">{summary.sixes}</dd>
            </div>
            <div>
              <dt>Dots</dt>
              <dd>{summary.dots}</dd>
            </div>
          </dl>

          <div className="ww-split" aria-label={`Off side ${pct(summary.offRuns)}%, leg side ${pct(summary.legRuns)}%`}>
            <div className="ww-split-labels">
              <span>Off {pct(summary.offRuns)}%</span>
              {summary.straightRuns > 0 && <span>Straight {pct(summary.straightRuns)}%</span>}
              <span>Leg {pct(summary.legRuns)}%</span>
            </div>
            <div className="ww-split-bar">
              <span className="ww-split-off" style={{ width: `${pct(summary.offRuns)}%` }} />
              <span className="ww-split-straight" style={{ width: `${pct(summary.straightRuns)}%` }} />
              <span className="ww-split-leg" style={{ width: `${pct(summary.legRuns)}%` }} />
            </div>
          </div>

          {summary.areas.length > 0 && (
            <ul className="ww-areas">
              {summary.areas.slice(0, compact ? 4 : 9).map((a) => (
                <li key={a.area}>
                  <button type="button" aria-pressed={area === a.area} onClick={() => setArea(area === a.area ? "" : a.area)}>
                    <span className="ww-area-name">{a.area}</span>
                    <span className="ww-area-bar">
                      <span style={{ width: `${(a.runs / topAreaRuns) * 100}%` }} />
                    </span>
                    <span className="ww-area-runs">{a.runs}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!compact && showBowlerFilter && bowlers.length > 1 && (
            <label className="ww-select">
              <span>Bowler</span>
              <select value={bowler} onChange={(e) => setBowler(e.target.value)}>
                <option value="">All bowlers</option>
                {bowlers.map((id) => (
                  <option key={id} value={id}>
                    {playerName(id)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {summary.unplacedRuns > 0 && (
            <p className="ww-note">
              {summary.unplacedRuns} run{summary.unplacedRuns === 1 ? "" : "s"} without a field position aren't drawn.
            </p>
          )}
          {filtered && (
            <button type="button" className="ww-reset" onClick={reset}>
              <RotateCcw className="size-3.5" /> Show everything
            </button>
          )}
        </div>
      </div>

      {!compact && area && areaShots.length > 0 && (
        <ul className="ww-list" aria-label={`${area} shots`}>
          {areaShots
            .slice()
            .sort((a, b) => a.ball.over - b.ball.over || a.ball.ball - b.ball.ball)
            .slice(0, 24)
            .map((s) => (
              <li key={s.ball.id}>
                <button type="button" aria-pressed={activeId === s.ball.id} onClick={() => setActiveId(activeId === s.ball.id ? "" : s.ball.id)}>
                  <span className={`ww-badge ${runClass(s)}`}>{s.ball.wicket ? "W" : s.ball.batterRuns}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {playerName(s.ball.strikerId)} <span className="ww-muted">· {s.ball.fieldZone}</span>
                  </span>
                  <span className="ww-muted">
                    {s.ball.over}.{s.ball.ball}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
