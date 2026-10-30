import { battingCrease, wagonWheelShots, type WagonShot } from "@/lib/wagon-wheel";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DeliveryEvidence, Discipline } from "@/lib/analysis";
import { summarizeGround, type GroundZone } from "@/lib/analysis-ground";
import { uniqueCurrent } from "@/lib/spatial-analysis";
import { dashboardAnalysis, type RateSeries } from "@/lib/dashboard-analysis";
const button =
  "min-h-11 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200";
const card = "min-w-0 rounded-2xl border border-white/10 bg-[#1d1f24] p-4 sm:p-5";
export function Plot({
  kind,
  zones,
  series,
  flat,
  onSelect,
  shots,
}: {
  kind: "wheel" | "rate";
  zones: GroundZone[];
  series: RateSeries;
  flat: boolean;
  onSelect: (key: string) => void;
  shots: WagonShot[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    if (flat) return;
    let active = true;
    let scene: { dispose: () => void } | undefined;
    setFailed(false);
    setReady(false);
    void import("@/lib/dashboard-scene")
      .then(({ createDashboardScene }) => {
        if (!active || !host.current) return;
        scene = createDashboardScene(
          host.current,
          kind,
          zones,
          series,
          (key) => select.current(key),
          () => {
            if (active) {
              setFailed(true);
              queueMicrotask(() => scene?.dispose());
            }
          },
          shots,
        );
        setReady(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      scene?.dispose();
    };
  }, [kind, zones, series, flat, shots]);
  const fallback = flat || failed;
  const max = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.rate ?? 0)));
  const maxOver = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.over)));
  return (
    <>
      <div className="relative h-[310px] sm:h-[360px]">
        <div ref={host} className={fallback ? "hidden" : "h-full w-full"} />
        {!fallback && !ready && (
          <p role="status" className="absolute inset-0 grid place-items-center text-sm">
            Preparing 3D chart…
          </p>
        )}
        {fallback &&
          (kind === "wheel" ? (
            <svg
              viewBox="-55 -55 110 110"
              role="img"
              aria-label="Cricket wagon wheel on a ground"
              className="h-full w-full"
            >
              <circle r="44" fill="#124c43" stroke="#e5e7cf" strokeWidth=".4" />
              <rect x="-2.5" y="-10.5" width="5" height="21" fill="#c4ad7b" />
              {shots.slice(0, 500).map((shot) => (
                <g key={shot.id}>
                  {!shot.fielding && (
                    <path
                      d={`M${battingCrease.x} ${battingCrease.z} L${shot.x} ${shot.z}`}
                      stroke={shot.color}
                      strokeWidth=".5"
                      fill="none"
                    />
                  )}
                  <circle cx={shot.x} cy={shot.z} r=".7" fill={shot.color} />
                </g>
              ))}
              <circle cx={battingCrease.x} cy={battingCrease.z} r=".8" fill="white" />
              {zones.map((z, i) => (
                <text
                  key={z.name}
                  x={z.x * 1.13}
                  y={z.z * 1.13}
                  fill="white"
                  textAnchor="middle"
                  fontSize="3"
                >
                  {i + 1}
                </text>
              ))}
            </svg>
          ) : (
            <svg
              role="img"
              aria-label="Filtered cumulative run rate by over"
              viewBox="0 0 340 240"
              className="h-full w-full"
            >
              <path d="M35 10 V210 H330" fill="none" stroke="#707580" />
              {[0, 1, 2, 3, 4].map((i) => (
                <g key={i}>
                  <text x="1" y={210 - 45 * i} fill="#bbb" fontSize="10">
                    {((max * i) / 4).toFixed(1)}
                  </text>
                  <path d={`M35 ${210 - 45 * i} H330`} stroke="#333740" />
                </g>
              ))}
              {series.map((s, i) => (
                <path
                  key={s.id}
                  d={s.points
                    .map((p, j) =>
                      p.rate === null
                        ? ""
                        : `${j === 0 || s.points[j - 1]?.rate === null ? "M" : "L"}${35 + (290 * p.over) / maxOver} ${210 - (180 * (p.rate ?? 0)) / max}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke={["#c73751", "#e9b949", "#54b8af", "#7e91dc"][i % 4]}
                  strokeWidth="2"
                />
              ))}
              <text x="145" y="235" fill="#ccc" fontSize="11">
                Recorded over (0–{maxOver})
              </text>
            </svg>
          ))}
      </div>
      {failed && (
        <p role="status" className="text-xs text-amber-200">
          3D unavailable. Showing the 2D chart and exact figures.
        </p>
      )}
    </>
  );
}
export function AnalysisDashboard({
  rows,
  discipline,
  inningsIds,
  playerNames,
  onReviewZone,
  onExplore,
  activeZone,
  onClearZone,
}: {
  rows: DeliveryEvidence[];
  discipline: Discipline;
  inningsIds?: string[];
  playerNames?: ReadonlyMap<string, string>;
  onReviewZone?: (zone: string) => void;
  activeZone?: string;
  onClearZone?: () => void;
  onExplore: () => void;
}) {
  const [flat, setFlat] = useState(false),
    [zone, setZone] = useState(""),
    [point, setPoint] = useState("");
  const current = useMemo(() => uniqueCurrent(rows), [rows]);
  const ground = useMemo(() => summarizeGround(current, discipline), [current, discipline]);
  const shots = useMemo(() => wagonWheelShots(current, discipline), [current, discipline]);
  const data = useMemo(() => dashboardAnalysis(current, inningsIds), [current, inningsIds]);
  const selected = ground.zones.find((z) => z.name === zone);
  const selectedPoint = data.series
    .flatMap((s) => s.points.map((p) => ({ ...p, key: `${s.id}:${p.over}`, label: s.label })))
    .find((p) => p.key === point);
  const totalRuns = current.reduce((n, r) => n + r.total_runs, 0),
    batterRuns = current.reduce((n, r) => n + r.batter_runs, 0),
    legal = current.filter((r) => r.legal_ball).length;
  return (
    <section aria-label="Club analysis dashboard" className="space-y-4 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-amber-300">Club dashboard</p>
          <h3 className="mt-1 text-2xl font-bold">Match analysis</h3>
          <p className="mt-1 text-sm text-slate-400">
            Recorded match evidence · all panels follow your filters
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={() => setFlat(!flat)}>
            {flat ? "Show 3D dashboard" : "Show 2D dashboard"}
          </button>
          <button className={button} onClick={onExplore}>
            Explore pitch & ball paths
          </button>
        </div>
      </header>
      {activeZone && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/25 bg-amber-300/5 p-3 text-sm">
          <p>
            Zone filter:{" "}
            <strong>
              {ground.zones.find((z) => z.name.toLowerCase() === activeZone.toLowerCase())?.name ??
                activeZone}
            </strong>{" "}
            · all panels show this zone only
          </p>
          {onClearZone && (
            <button className={button} onClick={onClearZone}>
              Clear zone filter
            </button>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [
            "Batting",
            `${batterRuns} runs`,
            `${current.filter((r) => r.batter_runs === 4 || r.batter_runs === 6).length} boundary events`,
          ],
          ["Bowling", `${legal} legal balls`, `${totalRuns} team runs including extras`],
          [
            "Fielding",
            `${current.filter((r) => r.fielder_id).length} recorded events`,
            `${current.filter((r) => r.wicket).length} wicket events across filtered deliveries`,
          ],
        ].map(([title, value, detail]) => (
          <div className={card} key={title}>
            <p className="text-xs uppercase tracking-wider text-amber-300">{title}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
            <p className="mt-2 text-xs text-slate-400">{detail}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <article className={card}>
          <h4 className="font-bold uppercase tracking-wide">Run rate over time</h4>
          <p className="mt-1 text-xs text-slate-400">
            Cumulative filtered runs per six legal balls · separate innings
          </p>
          <Plot
            shots={shots}
            kind="rate"
            zones={ground.zones}
            series={data.series}
            flat={flat}
            onSelect={setPoint}
          />
          <div className="flex flex-wrap gap-2">
            {data.series.map((s) => (
              <label key={s.id} className="min-w-0 text-xs">
                {s.label}
                <select
                  aria-label={`${s.label} run rate point`}
                  className={`${button} ml-2 max-w-full`}
                  value={point.startsWith(`${s.id}:`) ? point : ""}
                  onChange={(e) => setPoint(e.target.value)}
                >
                  <option value="">Inspect over</option>
                  {s.points.map((p) => (
                    <option key={p.over} value={`${s.id}:${p.over}`}>
                      {p.over}: {p.rate === null ? "No legal balls" : p.rate.toFixed(2)} runs/over
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p role="status" className="mt-3 text-sm text-rose-200">
            {selectedPoint
              ? `${selectedPoint.label} · through over ${selectedPoint.over}: ${selectedPoint.runs} runs from ${selectedPoint.balls} legal balls · ${selectedPoint.rate === null ? "rate unavailable" : selectedPoint.rate.toFixed(2) + " runs/over"}`
              : "Select a chart point or over to see the figures."}
          </p>
          <div className="mt-4 space-y-3">
            {data.series.map((s) => {
              const last = s.points.at(-1)!;
              return (
                <div key={s.id}>
                  <p className="mb-2 text-xs text-amber-300">{s.label} · filtered totals</p>
                  <dl className="grid grid-cols-3 gap-2">
                    {[
                      ["Run rate", last.rate === null ? "—" : last.rate.toFixed(2)],
                      ["Team runs", last.runs],
                      ["Legal balls", last.balls],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-lg border border-white/10 bg-black/10 p-3"
                      >
                        <dt className="text-[11px] text-slate-400">{label}</dt>
                        <dd className="mt-1 text-xl font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
          {!current.length && (
            <p className="mt-3 text-sm text-slate-400">No deliveries in these filters.</p>
          )}
        </article>
        <article className={card}>
          <h4 className="font-bold uppercase tracking-wide">
            {discipline === "fielding" ? "Fielding event map" : "Wagon wheel"}
          </h4>
          <p className="mt-1 text-xs text-slate-400">
            {discipline === "fielding" ? "Fielding" : "Shot"} zone distribution · {ground.mapped}{" "}
            mapped deliveries
          </p>
          <Plot
            shots={shots}
            kind="wheel"
            zones={ground.zones}
            series={data.series}
            flat={flat}
            onSelect={setZone}
          />
          {shots.length > 500 && (
            <p className="text-xs text-amber-200">
              Showing the first 500 plotted events. Zone totals below include every filtered event.
            </p>
          )}
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
            {ground.zones.map((z, i) => (
              <button
                key={z.name}
                className={`min-h-11 rounded-lg px-2 py-1 text-left text-xs ${zone === z.name ? "bg-rose-900/50 text-white" : "text-slate-300 hover:bg-white/5"}`}
                aria-pressed={zone === z.name}
                onClick={() => setZone(z.name)}
              >
                {i + 1}. {z.name}
                <span className="float-right font-semibold">
                  {z.deliveries} ·{" "}
                  {ground.mapped ? Math.round((100 * z.deliveries) / ground.mapped) : 0}%
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {discipline === "fielding"
              ? "Points show recorded fielding-event zones, not a complete field setting."
              : "Shot lines radiate from the batter to recorded zone centres. Overlapping shots share a line; exact direction, distance and flight are not tracked."}{" "}
            Percentages use mapped deliveries. {ground.unmapped} unclassified. Teal: other outcomes;
            gold: four; purple: six; pink: wicket event.
          </p>
          {selected && (
            <div role="status" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span>
                {selected.name}: {selected.deliveries} deliveries · {selected.runs}{" "}
                {discipline === "batting" ? "batter" : "team"} runs
              </span>
              {onReviewZone && (
                <button
                  className={button}
                  disabled={!selected.deliveries}
                  onClick={() => onReviewZone(selected.name.toLowerCase())}
                >
                  Review zone deliveries
                </button>
              )}
            </div>
          )}
        </article>
      </div>
      <article className={card}>
        <h4 className="mb-4 font-bold uppercase tracking-wide">Player contributions</h4>
        <div className="grid gap-5 md:grid-cols-3">
          {(
            [
              ["Batters", data.batters],
              ["Bowlers", data.bowlers],
              ["Fielders", data.fielders],
            ] as const
          ).map(([title, leaders]) => (
            <div key={title}>
              <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                {title}
              </h5>
              {leaders.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between gap-2 border-t border-white/10 py-3 text-sm"
                >
                  <span>{playerNames?.get(p.id) ?? "Unnamed player"}</span>
                  <span className="text-right text-xs text-slate-300">
                    {title === "Batters" ? `${p.runs} batter runs · ` : ""}
                    {p.deliveries} recorded {title === "Fielders" ? "events" : "deliveries"}
                  </span>
                </div>
              ))}
              {!leaders.length && (
                <p className="text-xs text-slate-400">No recorded contributions.</p>
              )}
            </div>
          ))}
        </div>
      </article>
      <p className="text-xs leading-relaxed text-slate-400">
        Filtered totals may cover partial overs. Wicket events include run-outs and are not bowler
        or fielder credits. Required rate and projections are omitted where target and match context
        are unavailable. Drag either 3D chart to rotate; use the controls and lists for keyboard
        access.
      </p>
    </section>
  );
}
