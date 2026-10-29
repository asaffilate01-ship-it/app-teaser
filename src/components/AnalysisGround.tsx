import { initialField } from "@/lib/spatial-analysis";
import { AnalysisDashboard } from "./AnalysisDashboard";
import { SpatialCricketLab } from "./SpatialCricketLab";
import type { CoachingAnnotation } from "@/lib/coaching";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeAnalysisZone, type DeliveryEvidence, type Discipline } from "@/lib/analysis";
import { summarizeGround, type GroundMetric } from "@/lib/analysis-ground";
import type { createGroundScene, GroundView } from "@/lib/ground-scene";

const control =
  "min-h-11 rounded-xl border border-white/15 px-3 py-2 text-sm text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200";
function ZoneGround({
  rows,
  discipline,
  activeZone = "",
  onReviewZone,
  onClearZone,
}: {
  rows: DeliveryEvidence[];
  discipline: Discipline;
  activeZone?: string;
  onReviewZone?: (zone: string) => void;
  onClearZone?: () => void;
}) {
  const data = useMemo(() => summarizeGround(rows, discipline), [rows, discipline]);
  const [metric, setMetric] = useState<GroundMetric>("deliveries");
  const [selected, setSelected] = useState("");
  const [view, setView] = useState<GroundView>("perspective");
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof createGroundScene> | null>(null);
  const latest = useRef({ data, metric, selected, view });
  latest.current = { data, metric, selected, view };
  useEffect(() => {
    if (mode !== "3d") return;
    let active = true;
    setStatus("loading");
    void import("@/lib/ground-scene")
      .then(({ createGroundScene }) => {
        if (!active || !host.current) return;
        setStatus("ready");
        scene.current = createGroundScene(host.current, setSelected, () => {
          if (active) setStatus("failed");
        });
        const current = latest.current;
        scene.current.update(current.data.zones, current.metric, current.selected, current.view);
      })
      .catch(() => {
        if (active) setStatus("failed");
      });
    return () => {
      active = false;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [mode]);
  useEffect(() => {
    try {
      scene.current?.update(data.zones, metric, selected, view);
    } catch {
      setStatus("failed");
    }
  }, [data, metric, selected, view]);
  // Release GPU resources after a context loss or render failure.
  useEffect(() => {
    if (status === "failed") {
      scene.current?.dispose();
      scene.current = null;
    }
  }, [status]);
  const metricLabel =
    metric === "deliveries"
      ? "Deliveries"
      : metric === "wickets"
        ? "Wicket events"
        : discipline === "batting"
          ? "Batter runs"
          : "Team runs";
  const current = data.zones.find((z) => z.name === selected);
  const flat = mode === "2d" || status === "failed";
  const max = Math.max(1, ...data.zones.map((z) => z[metric]));
  return (
    <section
      aria-label="Match Observatory"
      className="overflow-hidden rounded-3xl border border-emerald-200/20 bg-[#0b1423]"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.24em] text-emerald-200">
            CricLume / Spatial analysis
          </p>
          <h3 className="mt-2 font-display text-2xl text-white">Match Observatory</h3>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            {discipline === "fielding"
              ? "Recorded fielding zones"
              : discipline === "bowling"
                ? "Shot destinations against the selected bowling"
                : "Recorded shot destinations"}{" "}
            · follows your filters above.
          </p>
        </div>
        <div className="flex gap-2" aria-label="Display mode">
          {(["3d", "2d"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`${control} ${mode === value ? "bg-white/10" : ""}`}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {value === "3d" ? "3D ground" : "2D ground"}
            </button>
          ))}
        </div>
      </header>
      {activeZone && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3 text-sm text-emerald-100">
          <p>
            Zone filter:{" "}
            {data.zones.find(
              (z) => normalizeAnalysisZone(z.name) === normalizeAnalysisZone(activeZone),
            )?.name ?? activeZone}
          </p>
          {onClearZone && (
            <button type="button" className={control} onClick={onClearZone}>
              Clear zone filter
            </button>
          )}
        </div>
      )}
      <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(270px,1fr)]">
        <div className="min-w-0 border-b border-white/10 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap gap-3 px-5 pt-5">
            <label className="grid gap-1 text-xs text-slate-300">
              Measure
              <select
                className={`${control} bg-slate-900`}
                aria-label="Measure"
                value={metric}
                onChange={(e) => setMetric(e.target.value as GroundMetric)}
              >
                <option value="deliveries">Deliveries</option>
                <option value="runs">
                  {discipline === "batting" ? "Batter runs" : "Team runs"}
                </option>
                <option value="wickets">Wicket events</option>
              </select>
            </label>
            {!flat && (
              <label className="grid gap-1 text-xs text-slate-300">
                Camera
                <select
                  className={`${control} bg-slate-900`}
                  aria-label="Camera"
                  value={view}
                  onChange={(e) => setView(e.target.value as GroundView)}
                >
                  <option value="perspective">Overview</option>
                  <option value="overhead">Overhead</option>
                  <option value="end">From the end</option>
                </select>
              </label>
            )}
          </div>
          <div
            className="relative h-[320px] sm:h-[420px]"
            style={{ background: "radial-gradient(ellipse at center, #143332 0%, #0b1423 70%)" }}
          >
            <div ref={host} className={flat ? "hidden" : "h-full w-full"} />
            {flat && (
              <svg viewBox="-55 -55 110 110" className="h-full w-full" aria-hidden="true">
                <circle r="45" fill="#124c43" stroke="#bbd6bd" strokeWidth=".3" />
                {[12, 24, 36].map((r) => (
                  <circle key={r} r={r} fill="none" stroke="#387c68" strokeWidth=".2" />
                ))}
                <rect x="-2.5" y="-10" width="5" height="20" fill="#b69c69" />
                {data.zones.map((z, i) => (
                  <g key={z.name}>
                    <circle
                      cx={z.x}
                      cy={z.z}
                      r={2 + (z[metric] / max) * 2}
                      fill={selected === z.name ? "#ffca76" : z[metric] ? "#65e5c1" : "#47736b"}
                    />
                    <text
                      x={z.x}
                      y={z.z + 1}
                      textAnchor="middle"
                      fontSize="3.3"
                      fontWeight="bold"
                      fill="#071b19"
                    >
                      {i + 1}
                    </text>
                  </g>
                ))}
              </svg>
            )}
            {!flat && status === "loading" && (
              <p
                role="status"
                className="absolute inset-0 grid place-items-center text-sm text-slate-300"
              >
                Preparing 3D ground…
              </p>
            )}
            <p className="absolute bottom-3 left-5 text-[10px] uppercase tracking-widest text-slate-300">
              Schematic ground · reference orientation
            </p>
          </div>
          <div className="space-y-2 px-5 pb-5 text-xs leading-relaxed text-slate-300">
            {status === "failed" && mode === "3d" && (
              <p role="status" className="text-amber-200">
                3D is unavailable on this device. The 2D ground and all figures remain available.
              </p>
            )}
            <p>
              {flat ? "Marker size" : "Column height"} represents {metricLabel.toLowerCase()}{" "}
              relative to the largest zone in these filters. Numbers match the zone list. Positions
              are illustrative, not tracked ball paths or player positions.
            </p>
            <p>
              Runs include extras outside batting. Wicket events include run-outs; they are not
              bowler wickets or fielding credits.
            </p>
          </div>
        </div>
        <aside className="min-w-0 p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Zone coverage</p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {data.mapped}
                <span className="text-sm font-normal text-slate-400">
                  {" "}
                  / {data.mapped + data.unmapped} deliveries
                </span>
              </p>
            </div>
            <span className="rounded-full border border-emerald-300/20 px-3 py-1 text-xs text-emerald-200">
              Filtered data
            </span>
          </div>
          <p className="mb-4 text-xs text-slate-300">
            {data.unmapped} deliveries have no recognised zone and are excluded from this ground.
            They remain in the scorecards.
          </p>
          {data.mapped === 0 && (
            <p
              role="status"
              className="mb-4 rounded-xl border border-amber-300/25 p-3 text-sm text-amber-100"
            >
              No mapped zones in these filters. Record zones in the scorer or broaden the filters.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {data.zones.map((z, i) => (
              <button
                type="button"
                key={z.name}
                aria-pressed={selected === z.name}
                onClick={() => setSelected(selected === z.name ? "" : z.name)}
                className={`flex min-h-11 items-center gap-2 rounded-xl border p-2 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 ${selected === z.name ? "border-amber-200/60 bg-amber-200/10 text-amber-100" : "border-white/10 text-slate-300"}`}
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/10 text-[10px]">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">{z.name}</span>
                <strong className="text-sm">{z[metric]}</strong>
              </button>
            ))}
          </div>
          <div
            role="status"
            aria-live="polite"
            className="mt-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-sm text-slate-300"
          >
            {current ? (
              <>
                <p className="font-semibold text-amber-100">{current.name}</p>
                <p className="mt-2">
                  {current.deliveries} deliveries · {current.runs}{" "}
                  {discipline === "batting" ? "batter" : "team"} runs · {current.wickets} wicket
                  events
                </p>
              </>
            ) : (
              <p>Select a numbered zone to inspect its recorded figures.</p>
            )}
          </div>
          {current && onReviewZone && (
            <button
              type="button"
              className={`${control} mt-3 w-full border-emerald-200/30 bg-emerald-200/10 text-emerald-100 disabled:opacity-50`}
              disabled={current.deliveries === 0}
              onClick={() => onReviewZone(normalizeAnalysisZone(current.name))}
            >
              Review {current.name} deliveries
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}

export function AnalysisGround(
  props: Parameters<typeof ZoneGround>[0] & {
    notes?: CoachingAnnotation[];
    inningsIds?: string[];
    playerNames?: ReadonlyMap<string, string>;
    onReviewDelivery?: (id: string) => void;
  },
) {
  const [spatial, setSpatial] = useState(true);
  const [dashboard, setDashboard] = useState(true);
  const [fieldPlan, setFieldPlan] = useState(initialField);
  if (dashboard)
    return (
      <AnalysisDashboard
        rows={props.rows}
        discipline={props.discipline}
        {...(props.inningsIds ? { inningsIds: props.inningsIds } : {})}
        {...(props.playerNames ? { playerNames: props.playerNames } : {})}
        {...(props.onReviewZone ? { onReviewZone: props.onReviewZone } : {})}
        activeZone={props.activeZone ?? ""}
        {...(props.onClearZone ? { onClearZone: props.onClearZone } : {})}
        onExplore={() => setDashboard(false)}
      />
    );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button className={control} onClick={() => setDashboard(true)}>
          Club dashboard
        </button>
        <button className={control} aria-pressed={spatial} onClick={() => setSpatial(true)}>
          Wagon wheel, pitch & field
        </button>
        <button className={control} aria-pressed={!spatial} onClick={() => setSpatial(false)}>
          Zone totals & review
        </button>
      </div>
      {spatial ? (
        <SpatialCricketLab
          fieldPlan={fieldPlan}
          onFieldPlanChange={setFieldPlan}
          rows={props.rows}
          notes={props.notes ?? []}
          {...(props.inningsIds ? { inningsIds: props.inningsIds } : {})}
          {...(props.playerNames ? { playerNames: props.playerNames } : {})}
          {...(props.onReviewDelivery ? { onReviewDelivery: props.onReviewDelivery } : {})}
        />
      ) : (
        <ZoneGround {...props} />
      )}
    </div>
  );
}
