import { useMemo, useState, useRef } from "react";
import type { DeliveryEvidence } from "@/lib/analysis";
import { coachingLabel, type CoachingAnnotation } from "@/lib/coaching";
import { bowlingLines, bowlingLengths, summarizeBowlingPlacement } from "@/lib/bowling-placement";

type Metric = "deliveries" | "runs" | "wickets";
const control =
  "min-h-11 rounded-xl border border-white/15 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200";
export function BowlingPlacement({
  rows,
  notes,
  names,
  inningsIds,
  mediaIds,
  onPlayClip,
  busy,
}: {
  rows: DeliveryEvidence[];
  notes: CoachingAnnotation[];
  names: Map<string, string>;
  inningsIds: string[];
  mediaIds: Set<string>;
  onPlayClip: (id: string) => void;
  busy: boolean;
}) {
  const result = useMemo(() => summarizeBowlingPlacement(rows, notes), [rows, notes]);
  const [metric, setMetric] = useState<Metric>("deliveries");
  const [selected, setSelected] = useState("");
  const [page, setPage] = useState(0);
  const select = (key: string) => {
    setSelected(key);
    setPage(0);
  };
  const cell = result.cells.find((c) => c.key === selected);
  const detail =
    cell?.deliveries ??
    (selected === "conflicting"
      ? result.conflicting
      : selected === "unclassified"
        ? result.unclassified
        : []);
  const title = cell
    ? `${coachingLabel(cell.length)} · ${coachingLabel(cell.line)}`
    : selected === "conflicting"
      ? "Conflicting classifications"
      : "Unclassified deliveries";
  const currentPage = Math.min(page, Math.max(0, Math.ceil(detail.length / 10) - 1));
  const label =
    metric === "deliveries" ? "Deliveries" : metric === "runs" ? "Team runs" : "Wicket events";
  const value = (c: (typeof result.cells)[number]) =>
    metric === "deliveries" ? c.deliveries.length : c[metric];
  const max = Math.max(1, ...result.cells.map(value));
  const matrix = useRef<HTMLDivElement>(null);
  return (
    <section
      aria-label="Bowling line and length"
      className="overflow-hidden rounded-3xl border border-amber-200/20 bg-gradient-to-br from-[#1b1d2b] to-[#0b1423] p-5 sm:p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-amber-200">
            Bowling / Coach review
          </p>
          <h3 className="mt-2 text-2xl font-semibold">Line &amp; length</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Find patterns in coach-recorded placements, then inspect the deliveries and linked
            clips. Uses the delivery filters above.
          </p>
        </div>
        <label className="grid gap-1 text-xs text-slate-300">
          Matrix measure
          <select
            aria-label="Matrix measure"
            className={`${control} bg-slate-900`}
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
          >
            <option value="deliveries">Deliveries</option>
            <option value="runs">Team runs</option>
            <option value="wickets">Wicket events</option>
          </select>
        </label>
      </header>
      <div className="my-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 p-3">
          <p className="text-xs text-slate-400">Classified deliveries</p>
          <p className="mt-1 text-xl font-semibold">
            {result.mapped} <span className="text-sm text-slate-400">/ {result.total}</span>
          </p>
        </div>
        <button
          type="button"
          className={`${control} text-left ${selected === "conflicting" ? "bg-amber-200/10" : ""}`}
          aria-pressed={selected === "conflicting"}
          onClick={() => select("conflicting")}
        >
          <span className="block text-xs text-slate-300">Conflicting classifications</span>
          <strong className="mt-1 block text-xl text-amber-200">{result.conflicting.length}</strong>
        </button>
        <button
          type="button"
          className={`${control} text-left ${selected === "unclassified" ? "bg-white/10" : ""}`}
          aria-pressed={selected === "unclassified"}
          onClick={() => select("unclassified")}
        >
          <span className="block text-xs text-slate-300">Unclassified deliveries</span>
          <strong className="mt-1 block text-xl">{result.unclassified.length}</strong>
        </button>
      </div>
      <div
        className="overflow-x-auto rounded-xl border border-white/10"
        role="region"
        ref={matrix}
        aria-label="Line and length matrix; scroll horizontally for all lines"
        tabIndex={0}
      >
        <table className="w-full min-w-[600px] border-separate border-spacing-2 text-sm">
          <caption className="px-3 pt-3 text-left text-xs text-slate-300">
            {label} · select a cell to inspect · stronger colour means a larger value within these
            filters
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-[#151e2d] px-2 text-left text-xs text-slate-400"
              >
                Length / line
              </th>
              {bowlingLines.map((line) => (
                <th
                  scope="col"
                  key={line}
                  className="px-2 py-3 text-xs font-medium capitalize text-slate-300"
                >
                  {coachingLabel(line)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bowlingLengths.map((length) => (
              <tr key={length}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[#151e2d] px-2 text-left text-xs font-medium capitalize text-slate-300"
                >
                  {coachingLabel(length)}
                  {length === "full_toss" && (
                    <span className="mt-1 block text-[10px] normal-case text-amber-200">
                      No bounce
                    </span>
                  )}
                </th>
                {bowlingLines.map((line) => {
                  const c = result.cells.find((c) => c.line === line && c.length === length)!;
                  return (
                    <td key={line}>
                      <button
                        type="button"
                        aria-label={`${coachingLabel(length)}, ${coachingLabel(line)}: ${value(c)} ${label.toLowerCase()}`}
                        aria-pressed={selected === c.key}
                        onClick={() => select(c.key)}
                        className={`min-h-14 w-full rounded-xl border px-3 py-2 text-center font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 ${selected === c.key ? "border-amber-200" : "border-white/10"}`}
                        style={{
                          backgroundColor: `rgba(45, 143, 123, ${value(c) === 0 ? 0.06 : 0.18 + (0.5 * value(c)) / max})`,
                        }}
                      >
                        {value(c)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 space-y-2 text-xs leading-relaxed text-slate-300">
        <p>
          Categories are human observations, not measured bounce coordinates or AI tracking. Full
          tosses are listed separately because they do not bounce.
        </p>
        <p>
          Each delivery counts once. Matching notes do not increase the count. Disagreements are
          excluded from the matrix; incomplete or unsupported classifications are unclassified. A
          complete line-and-length pair must appear in one bowling note. Whole-match notes and
          historical deliveries do not contribute.
        </p>
        <p>
          Team runs include extras. Wicket events include run-outs and are not bowler wickets.
          Note-text and observation-history controls below do not change this matrix.
        </p>
      </div>
      {result.total === 0 && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-white/15 p-4 text-sm text-slate-300"
        >
          No current deliveries match the filters.
        </p>
      )}
      {selected ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="font-semibold capitalize text-amber-100">{title}</h4>
            <button
              type="button"
              className={control}
              onClick={() => {
                select("");
                matrix.current?.focus();
              }}
            >
              Clear selection
            </button>
          </div>
          <p role="status" aria-live="polite" className="my-3 text-sm text-slate-300">
            {detail.length} deliveries · {detail.reduce((sum, d) => sum + d.total_runs, 0)} team
            runs · {detail.filter((d) => d.wicket).length} wicket events
          </p>
          {selected === "conflicting" && (
            <p className="mb-3 text-xs text-amber-100">
              Review the coaching notes and evidence before drawing conclusions. Adding another
              matching note does not resolve earlier disagreement.
            </p>
          )}
          {selected === "unclassified" && (
            <p className="mb-3 text-xs text-slate-300">
              Add both bowling line and length to a delivery-linked bowling observation to classify
              it.
            </p>
          )}
          {detail.length === 0 ? (
            <p className="text-sm text-slate-400">No deliveries in this selection.</p>
          ) : (
            <>
              <ul className="divide-y divide-white/10">
                {detail.slice(currentPage * 10, currentPage * 10 + 10).map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm">
                        Innings {inningsIds.indexOf(d.innings_id) + 1} · {d.over_number}.
                        {d.ball_in_over} · {names.get(d.bowler_id) ?? "Bowler"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {names.get(d.striker_id) ?? "Batter"} · {d.total_runs} team runs
                        {d.wicket ? " · Wicket event" : ""} · Delivery #{d.sequence}
                      </p>
                    </div>
                    {mediaIds.has(d.id) ? (
                      <button
                        type="button"
                        className={`${control} text-emerald-200`}
                        disabled={busy}
                        onClick={() => onPlayClip(d.id)}
                      >
                        Play clip<span className="sr-only"> for delivery {d.sequence}</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">No linked clip</span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={control}
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous deliveries
                </button>
                <span className="text-xs text-slate-300">
                  Page {currentPage + 1} of {Math.ceil(detail.length / 10)}
                </span>
                <button
                  type="button"
                  className={control}
                  disabled={(currentPage + 1) * 10 >= detail.length}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next deliveries
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-300">
          Select a matrix cell or a coverage category to review its deliveries.
        </p>
      )}
    </section>
  );
}
