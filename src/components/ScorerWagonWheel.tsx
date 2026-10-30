import { defaultAnalysisFilters, filterDeliveries } from "@/lib/analysis";
import { useMemo, useState } from "react";
import type { Innings, Player } from "@/lib/cricket";
import { scorerWagonEvidence, wagonWheelShots } from "@/lib/wagon-wheel";
import { summarizeGround } from "@/lib/analysis-ground";
import { Plot } from "./AnalysisDashboard";
import type { RateSeries } from "@/lib/dashboard-analysis";
const noSeries: RateSeries = [];
const control =
  "min-h-11 rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white";
export function ScorerWagonWheel({ innings, players }: { innings: Innings; players: Player[] }) {
  const [flat, setFlat] = useState(false),
    [batter, setBatter] = useState(""),
    [bowler, setBowler] = useState(""),
    [outcome, setOutcome] = useState(""),
    [selected, setSelected] = useState("");
  const evidence = useMemo(() => scorerWagonEvidence(innings), [innings]);
  const rows = useMemo(
    () => filterDeliveries(evidence, { ...defaultAnalysisFilters, batter, bowler, outcome }),
    [evidence, batter, bowler, outcome],
  );
  const shots = useMemo(() => wagonWheelShots(rows, "batting"), [rows]);
  const ground = useMemo(() => summarizeGround(rows, "batting"), [rows]);
  const selectedRows = filterDeliveries(rows, { ...defaultAnalysisFilters, zone: selected });
  const zone = ground.zones.find((z) => z.name === selected);
  return (
    <section
      aria-label="Scorer wagon wheel"
      className="min-w-0 space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Innings {innings.number} · shot directions
          </p>
          <h2 className="font-display text-3xl font-bold">Wagon wheel</h2>
        </div>
        <button className={control} onClick={() => setFlat(!flat)}>
          {flat ? "Show 3D wheel" : "Show 2D wheel"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["Batter", batter, setBatter, "striker_id"],
            ["Bowler", bowler, setBowler, "bowler_id"],
          ] as const
        ).map(([label, value, setValue, key]) => (
          <label key={label} className="grid min-w-0 gap-1 text-xs">
            {label}
            <select
              className={control}
              aria-label={`Wagon wheel ${label.toLowerCase()}`}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setSelected("");
              }}
            >
              <option value="">All {label.toLowerCase()}s</option>
              {[...new Set(evidence.map((r) => r[key]))].map((id) => (
                <option key={id} value={id}>
                  {players.find((p) => p.id === id)?.name ?? "Player"}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="grid gap-1 text-xs">
          Outcome
          <select
            aria-label="Wagon wheel outcome"
            className={control}
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value);
              setSelected("");
            }}
          >
            <option value="">All outcomes</option>
            <option value="4">Fours</option>
            <option value="6">Sixes</option>
            <option value="wickets">Wickets</option>
            <option value="boundaries">Boundaries</option>
            <option value="dots">Dot deliveries</option>
          </select>
        </label>
        <button
          className={control}
          onClick={() => {
            setBatter("");
            setBowler("");
            setOutcome("");
            setSelected("");
          }}
        >
          Reset filters
        </button>
      </div>
      <Plot
        kind="wheel"
        zones={ground.zones}
        series={noSeries}
        shots={shots}
        flat={flat}
        onSelect={setSelected}
      />
      <p className="text-xs text-slate-300">
        Teal: other outcomes · gold: four · purple: six · pink: wicket event. Lines start at the
        batting crease and end at recorded zone centres. Distances and exact angles are not
        measured; overlapping shots share a line.
      </p>
      <p role="status" className="text-sm text-amber-200">
        {shots.length
          ? `${ground.mapped} plotted deliveries · ${ground.unmapped} without a recognised zone`
          : "No shot locations in these filters. Record a field zone while scoring, or broaden the filters."}
      </p>
      {shots.length > 500 && (
        <p className="text-xs text-amber-200">
          First 500 events plotted. Counts below include all filtered deliveries.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {ground.zones
          .filter((z) => z.deliveries)
          .map((z) => (
            <button
              key={z.name}
              aria-pressed={selected === z.name}
              className={`${control} text-left ${selected === z.name ? "border-amber-300" : ""}`}
              onClick={() => setSelected(z.name)}
            >
              {z.name}
              <span className="block text-xs text-slate-300">
                {z.runs} batter runs · {z.deliveries} deliveries
              </span>
            </button>
          ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">
          {selected ? `${selected} deliveries` : "Matching deliveries"}
        </h3>
        {selected && (
          <button className={control} onClick={() => setSelected("")}>
            Clear zone selection
          </button>
        )}
      </div>
      <p className="text-xs text-slate-300" role="status">
        Showing {Math.min(30, selectedRows.length)} of {selectedRows.length} matching deliveries.
        Select a zone on the wheel to inspect its recorded deliveries.
      </p>
      <div
        className="max-h-80 overflow-auto rounded-xl border border-white/10"
        tabIndex={0}
        aria-label="Matching wagon wheel deliveries"
      >
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              {["Ball", "Batter", "Bowler", "Batter runs", "Team runs", "Outcome", "Zone"].map(
                (label) => (
                  <th key={label} scope="col" className="p-2">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {selectedRows.slice(0, 30).map((row) => (
              <tr key={row.id} className="border-t border-white/10">
                <td className="p-2">
                  {row.over_number}.{row.ball_in_over}
                </td>
                <td className="p-2">
                  {players.find((p) => p.id === row.striker_id)?.name ?? "Player"}
                </td>
                <td className="p-2">
                  {players.find((p) => p.id === row.bowler_id)?.name ?? "Player"}
                </td>
                <td className="p-2">{row.batter_runs}</td>
                <td className="p-2">{row.total_runs}</td>
                <td className="p-2">{row.wicket ? "Wicket event" : row.outcome}</td>
                <td className="p-2">{row.shot_zone || "Not recorded"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {zone && (
        <p role="status" className="text-sm">
          {zone.name}: {zone.runs} batter runs, {zone.deliveries} deliveries, {zone.wickets} wicket
          events.
        </p>
      )}
    </section>
  );
}
