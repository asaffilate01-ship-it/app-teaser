import { parseFieldPlan, maxFieldPlanBytes } from "@/lib/field-plan";
import type { FieldPosition } from "@/lib/spatial-analysis";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DeliveryEvidence } from "@/lib/analysis";
import type { CoachingAnnotation } from "@/lib/coaching";
import {
  buildSpatialData,
  visibleSpatialMarks,
  initialField,
  type SpatialMode,
  type SpatialMark,
} from "@/lib/spatial-analysis";
import type { createGroundScene, GroundView } from "@/lib/ground-scene";
const control =
  "min-h-11 rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white";
const modes = {
  wagon: "Wagon wheel",
  pitch: "Balls bowled",
  overs: "Runs by over",
  worm: "Scoring progression",
  fielders: "Fielding positions",
} as const;
export function SpatialCricketLab({
  rows,
  notes,
  onReviewDelivery,
  inningsIds,
  playerNames,
  fieldPlan,
  onFieldPlanChange,
}: {
  fieldPlan?: FieldPosition[];
  onFieldPlanChange?: (positions: FieldPosition[]) => void;
  rows: DeliveryEvidence[];
  notes: CoachingAnnotation[];
  inningsIds?: string[];
  playerNames?: ReadonlyMap<string, string>;
  onReviewDelivery?: (id: string) => void;
}) {
  const [mode, setMode] = useState<SpatialMode>("wagon");
  const [flat, setFlat] = useState(false);
  const [raised, setRaised] = useState(true);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<GroundView>("perspective");
  const [selected, setSelected] = useState("");
  const [planner, setPlanner] = useState(false);
  const [localField, setLocalField] = useState(initialField);
  const field = fieldPlan ?? localField;
  const setField = onFieldPlanChange ?? setLocalField;
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const importVersion = useRef(0);
  useEffect(
    () => () => {
      importVersion.current++;
    },
    [],
  );
  const [slot, setSlot] = useState(0);
  const [page, setPage] = useState(0);
  const data = useMemo(
    () => buildSpatialData(rows, notes, mode, inningsIds, playerNames),
    [rows, notes, mode, inningsIds, playerNames],
  );
  const planning = mode === "fielders" && planner;
  const marks = useMemo<SpatialMark[]>(
    () =>
      planning
        ? field.map((f, i) => ({
            id: `plan:${i}`,
            label: `${i + 1}. ${f.name}`,
            x: f.x,
            z: f.z,
            height: 1,
            color: 0x60a5fa,
            shape: "fielder",
          }))
        : data.marks.map((mark) =>
            mark.shape === "shot" ? { ...mark, height: raised ? 10 : 0 } : mark,
          ),
    [planning, field, data, raised],
  );
  const plottedMarks = useMemo(() => visibleSpatialMarks(marks, selected), [marks, selected]);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof createGroundScene> | null>(null);
  const latest = useRef({ marks: plottedMarks, selected, view });
  latest.current = { marks: plottedMarks, selected, view };
  useEffect(() => {
    setSelected("");
    setPage(0);
  }, [mode, rows, planner]);
  useEffect(() => {
    if (flat) return;
    let active = true;
    setFailed(false);
    setReady(false);
    void import("@/lib/ground-scene")
      .then(({ createGroundScene }) => {
        if (!active || !host.current) return;
        scene.current = createGroundScene(host.current, setSelected, () => {
          if (active) setFailed(true);
        });
        const d = latest.current;
        scene.current.update([], "deliveries", d.selected, d.view, d.marks);
        setReady(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [flat]);
  useEffect(() => {
    try {
      scene.current?.update([], "deliveries", selected, view, plottedMarks);
    } catch {
      setFailed(true);
    }
  }, [plottedMarks, selected, view]);
  useEffect(() => {
    if (failed) {
      scene.current?.dispose();
      scene.current = null;
    }
  }, [failed]);
  const selectedMark = marks.find((m) => m.id === selected);
  const fallback = flat || failed;
  const exportField = () => {
    try {
      parseFieldPlan(
        JSON.stringify({
          type: "criclume-field-plan",
          version: 1,
          schematic: true,
          positions: field,
        }),
      );
      setImportError("");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Check your field positions before exporting.",
      );
      return;
    }
    const blob = new Blob(
      [
        JSON.stringify(
          { type: "criclume-field-plan", version: 1, schematic: true, positions: field },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "criclume-field-plan.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section
      aria-label="Cricket spatial lab"
      className="rounded-3xl border border-emerald-200/20 bg-[#0b1423] p-5 text-white sm:p-6"
    >
      <p className="text-xs uppercase tracking-widest text-emerald-200">
        CricLume / Three-dimensional analysis
      </p>
      <h3 className="mt-2 text-2xl font-bold">Every ball, in perspective</h3>
      <p className="my-3 text-sm text-slate-300">
        Explore the deliveries in your current filters. Drag to orbit; pinch or scroll to zoom.
        Camera presets and data lists work without gestures.
      </p>
      <div className="flex flex-wrap gap-2" aria-label="Analysis view">
        {Object.entries(modes).map(([key, label]) => (
          <button
            key={key}
            className={`${control} ${mode === key ? "border-emerald-200 bg-emerald-900" : ""}`}
            aria-pressed={mode === key}
            onClick={() => {
              setMode(key as SpatialMode);
              setView(key === "pitch" ? "pitch" : "perspective");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="my-4 flex flex-wrap items-center gap-3">
        <button className={control} onClick={() => setFlat(!flat)}>
          {flat ? "Show 3D" : "Show 2D"}
        </button>
        {mode === "wagon" && !fallback && (
          <label className="text-sm">
            Shot display{" "}
            <select
              aria-label="Shot display"
              className={control}
              value={raised ? "arcs" : "traces"}
              onChange={(e) => setRaised(e.target.value === "arcs")}
            >
              <option value="arcs">Raised 3D arcs</option>
              <option value="traces">Ground-level traces</option>
            </select>
          </label>
        )}
        {!fallback && (
          <label className="text-sm">
            Camera{" "}
            <select
              aria-label="Spatial camera"
              className={control}
              value={view}
              onChange={(e) => setView(e.target.value as GroundView)}
            >
              <option value="perspective">Overview</option>
              <option value="overhead">Overhead</option>
              <option value="end">Bowler end</option>
              <option value="pitch">Pitch close-up</option>
            </select>
          </label>
        )}
        {mode === "fielders" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={planner}
              onChange={(e) => setPlanner(e.target.checked)}
            />
            Plan a field (separate from match evidence)
          </label>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
        <div className="min-w-0">
          <div className="relative h-[350px] rounded-2xl bg-gradient-to-b from-emerald-950 to-slate-950 sm:h-[460px]">
            <div ref={host} className={fallback ? "hidden" : "h-full w-full"} />
            {!fallback && !ready && (
              <p role="status" className="absolute inset-0 grid place-items-center">
                Preparing 3D view…
              </p>
            )}
            {fallback && (
              <svg
                aria-label={`${modes[mode]} schematic`}
                role="img"
                viewBox="-50 -50 100 100"
                className="h-full w-full"
              >
                <circle r="43" fill="#124c43" stroke="#d9e4cc" strokeWidth=".3" />
                <rect x="-2.5" y="-10.5" width="5" height="21" fill="#b69c69" />
                {plottedMarks.map((m) => (
                  <g
                    key={m.id}
                    fill={`#${m.color.toString(16).padStart(6, "0")}`}
                    stroke={m.id === selected ? "white" : "none"}
                  >
                    {m.shape === "trend" ? (
                      <path
                        d={`M${m.fromX} ${-(m.fromHeight ?? m.height)} L${m.x} ${-m.height}`}
                        fill="none"
                        stroke={`#${m.color.toString(16)}`}
                        strokeWidth=".6"
                      />
                    ) : m.shape === "shot" ? (
                      <path
                        d={`M0 8.5 L${m.x} ${m.z}`}
                        stroke={`#${m.color.toString(16)}`}
                        strokeWidth={m.id === selected ? 1 : 0.35}
                      />
                    ) : m.shape === "bar" ? (
                      <rect x={m.x} y={-m.height} width="1" height={m.height} />
                    ) : (
                      <circle cx={m.x} cy={m.z} r={m.shape === "fielder" ? 1.6 : 0.8} />
                    )}
                  </g>
                ))}
              </svg>
            )}
          </div>
          {failed && (
            <p role="status" className="mt-2 text-sm text-amber-200">
              3D unavailable. The 2D plot and full data list remain available.
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-slate-300">
            {mode === "wagon"
              ? "Paths connect the batting crease to recorded zone centres. Raised 3D arcs use an illustrative height, not measured ball flight. Ground traces show the same directions at turf level. Overlapping deliveries share a path."
              : mode === "pitch"
                ? "Balls use categorical line/length positions, not measured bounce coordinates. Full tosses are raised because they have no bounce. Repeated classifications overlap."
                : mode === "worm"
                  ? "Cumulative runs from filtered deliveries, including extras. Each innings is a separate series; missing overs are connected without assuming zero runs. These are not full innings totals when filters exclude deliveries."
                  : mode === "overs"
                    ? "Column heights show team runs including extras, scaled to the largest filtered over. Each innings/over stays separate; filtered overs may be incomplete. Order and exact values appear in the list."
                    : planning
                      ? "Editable schematic field plan, kept when switching dashboard views for this match. Export before changing match or leaving the page; import the file to restore it. This does not change recorded fielding evidence or validate competition field restrictions."
                      : "Markers indicate where fielding events were recorded, not a complete field setting or tracked player locations. Repeated events overlap."}
          </p>
          <p className="mt-2 text-xs text-slate-300">
            {mode === "worm"
              ? "Series: innings 1 teal, innings 2 purple, innings 3 gold, innings 4 blue (then repeated)."
              : planning
                ? "Blue: planned fielders."
                : "Teal: other deliveries · gold: four · purple: six · pink: wicket event (over chart: any wicket)."}{" "}
            Reference orientation; left/right-handedness is not inferred.
          </p>
          {!planning && (
            <p className="mt-2 text-sm text-emerald-200">
              {data.total} filtered deliveries · {data.excluded} without a plotted classification
              {mode === "pitch" ? ` (including ${data.conflicting} conflicting)` : ""}.{" "}
              {marks.length > 500
                ? "Up to 500 marks rendered, including your selected delivery; the complete list remains available."
                : ""}
            </p>
          )}
        </div>
        <aside className="min-w-0">
          {planning && (
            <div className="mb-4 space-y-3 rounded-xl border border-blue-300/30 p-3">
              <label className="grid gap-1 text-sm">
                Fielder
                <select
                  aria-label="Planned fielder"
                  className={control}
                  value={slot}
                  onChange={(e) => setSlot(Number(e.target.value))}
                >
                  {field.map((f, i) => (
                    <option key={i} value={i}>
                      {i + 1}. {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Name
                <input
                  aria-label="Fielder name"
                  maxLength={60}
                  className={control}
                  value={field[slot]!.name}
                  onChange={(e) =>
                    setField(field.map((f, i) => (i === slot ? { ...f, name: e.target.value } : f)))
                  }
                />
              </label>
              {(["x", "z"] as const).map((axis) => (
                <label className="grid gap-1 text-sm" key={axis}>
                  {axis === "x" ? "Across field" : "Along field"}: {field[slot]![axis]}
                  <input
                    aria-label={axis === "x" ? "Across field" : "Along field"}
                    type="range"
                    min={-40}
                    max={40}
                    value={field[slot]![axis]}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setField(
                        field.map((f, i) => {
                          if (i !== slot) return f;
                          const other = axis === "x" ? "z" : "x";
                          const limit = Math.floor(Math.sqrt(40 ** 2 - f[other] ** 2));
                          return { ...f, [axis]: Math.max(-limit, Math.min(limit, value)) };
                        }),
                      );
                    }}
                  />
                </label>
              ))}
              <label className="grid gap-1 text-sm">
                Import field plan
                <input
                  aria-label="Import field plan"
                  type="file"
                  accept=".json,application/json"
                  disabled={importing}
                  className="min-w-0 w-full text-xs"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const version = ++importVersion.current;
                    setImporting(true);
                    setImportError("");
                    setImportMessage("");
                    try {
                      if (file.size > maxFieldPlanBytes)
                        throw new Error("Field plan must be smaller than 64 KB.");
                      const positions = parseFieldPlan(await file.text());
                      if (version !== importVersion.current) return;
                      setField(positions);
                      setSlot(0);
                      setSelected("");
                      setImportMessage(
                        "Imported 11 positions. Recorded match evidence is unchanged.",
                      );
                    } catch (error) {
                      if (version === importVersion.current)
                        setImportError(
                          error instanceof Error ? error.message : "Unable to read field plan.",
                        );
                    } finally {
                      if (version === importVersion.current) setImporting(false);
                    }
                  }}
                />
              </label>
              {importing && (
                <p role="status" className="text-xs">
                  Reading field plan…
                </p>
              )}
              {importMessage && (
                <p role="status" className="text-xs text-emerald-200">
                  {importMessage}
                </p>
              )}
              {importError && (
                <p role="alert" className="text-xs text-rose-200">
                  {importError} Your current plan has been kept.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button className={control} onClick={exportField}>
                  Export field plan
                </button>
                <button className={control} onClick={() => setField(initialField)}>
                  Reset field
                </button>
              </div>
            </div>
          )}
          <h4 className="font-semibold">
            {planning ? "Planned positions" : "Recorded data"} · {marks.length}
          </h4>
          {marks.length === 0 && (
            <p role="status" className="mt-3 text-sm text-slate-300">
              No plottable records in these filters. Add the relevant zones or bowling coaching
              classifications, or broaden the filters.
            </p>
          )}
          <div className="mt-3 max-h-72 space-y-2 overflow-auto">
            {marks.slice(page * 20, page * 20 + 20).map((m) => (
              <button
                key={m.id}
                className={`${control} w-full text-left ${selected === m.id ? "border-amber-200" : ""}`}
                aria-pressed={selected === m.id}
                onClick={() => {
                  setSelected(m.id);
                  if (planning) setSlot(Number(m.id.split(":")[1]));
                }}
              >
                {m.label}
                {planning ? ` · x ${m.x}, z ${m.z}` : ""}
              </button>
            ))}
          </div>
          {marks.length > 20 && (
            <div className="mt-3 flex items-center gap-2">
              <button className={control} disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span className="text-xs">
                {page + 1} / {Math.ceil(marks.length / 20)}
              </span>
              <button
                className={control}
                disabled={(page + 1) * 20 >= marks.length}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
          <p role="status" className="mt-4 text-sm text-amber-100">
            {selectedMark?.label ?? "Select a plotted mark or list entry to inspect it."}
          </p>
          {selectedMark && !planning && mode !== "overs" && mode !== "worm" && onReviewDelivery && (
            <button
              className={`${control} mt-3 w-full`}
              onClick={() => onReviewDelivery(selectedMark.id)}
            >
              Review selected delivery
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}
