import { useMemo, useState } from "react";
import { Download, Gauge, Plus, Trash2 } from "lucide-react";
import {
  compareSpeedPairs,
  maximumSpeedPairs,
  parseComparisonSpeed,
  preliminarySpeedSampleSize,
  speedComparisonCsv,
  type SpeedPair,
  type SpeedReference,
} from "@/lib/speed-comparison";

export function SpeedComparisonLab() {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState<SpeedReference>("radar_release");
  const [tolerance, setTolerance] = useState(5);
  const [video, setVideo] = useState("");
  const [radar, setRadar] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pairs, setPairs] = useState<SpeedPair[]>([]);
  const [nextTrial, setNextTrial] = useState(1);
  const [error, setError] = useState("");
  const summary = useMemo(() => compareSpeedPairs(pairs, tolerance), [pairs, tolerance]);
  const comparable = reference === "same_segment";
  const canAdd =
    confirmed &&
    parseComparisonSpeed(video) !== null &&
    parseComparisonSpeed(radar) !== null &&
    pairs.length < maximumSpeedPairs;

  const addPair = () => {
    const videoKph = parseComparisonSpeed(video);
    const referenceKph = parseComparisonSpeed(radar);
    if (!confirmed || videoKph === null || referenceKph === null) {
      setError("Enter two valid readings and confirm that both refer to the same delivery.");
      return;
    }
    if (pairs.length >= maximumSpeedPairs) return;
    setPairs((current) => [...current, { trial: nextTrial, videoKph, referenceKph }]);
    setNextTrial((current) => current + 1);
    setVideo("");
    setRadar("");
    setConfirmed(false);
    setError("");
  };

  const exportPairs = () => {
    const csv = speedComparisonCsv(pairs, reference, tolerance);
    if (!csv) return;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "criclume-speed-comparison.csv";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <section className="space-y-4 rounded-xl border border-white/10 p-4">
      <button
        type="button"
        className="action-secondary w-full justify-start"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Gauge className="size-4" aria-hidden="true" /> Speed validation lab
      </button>
      {open && (
        <>
          <p className="text-xs leading-5 text-slate-400">
            Compare paired camera estimates and independent readings under one fixed setup. These
            descriptive statistics are not a radar certification. No match scores, camera permissions
            or speed correction factors are changed.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              Reference measurement
              <select
                className="scorer-input"
                value={reference}
                disabled={pairs.length > 0}
                onChange={(event) => {
                  setReference(event.target.value as SpeedReference);
                  setConfirmed(false);
                }}
              >
                <option value="radar_release">Radar release/peak versus video segment</option>
                <option value="same_segment">Independently verified same-segment average</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              Comparison tolerance
              <select
                className="scorer-input"
                value={tolerance}
                disabled={pairs.length > 0}
                onChange={(event) => setTolerance(Number(event.target.value))}
              >
                {[2, 3, 5, 10].map((value) => (
                  <option key={value} value={value}>
                    ±{value} km/h
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!comparable && (
            <p className="text-xs text-amber-200">
              Peak release and segment-average speeds are different quantities. Their differences
              are diagnostic only, not measurement errors or evidence of accuracy.
            </p>
          )}
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              addPair();
            }}
          >
            <label className="grid gap-1 text-xs">
              Camera segment estimate (km/h)
              <input
                className="scorer-input"
                inputMode="decimal"
                value={video}
                onChange={(event) => {
                  setVideo(event.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <label className="grid gap-1 text-xs">
              Independent reference (km/h)
              <input
                className="scorer-input"
                inputMode="decimal"
                value={radar}
                onChange={(event) => {
                  setRadar(event.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <label className="flex items-start gap-2 text-xs sm:col-span-2">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              Both readings refer to the same delivery, the stated measurement types and the same
              fixed camera setup. Each trial is a distinct delivery.
            </label>
            <button className="action-primary sm:col-span-2" disabled={!canAdd}>
              <Plus className="size-4" /> Add paired trial
            </button>
          </form>
          {error && (
            <p role="alert" className="text-xs text-amber-200">
              {error}
            </p>
          )}
          {summary && (
            <>
              <div aria-live="polite" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Paired trials", String(summary.count)],
                  ["Mean signed difference", summary.meanDifference.toFixed(2) + " km/h"],
                  ["Mean absolute difference", summary.meanAbsoluteDifference.toFixed(2) + " km/h"],
                  ["RMS difference", summary.rootMeanSquareDifference.toFixed(2) + " km/h"],
                  [
                    "Largest absolute difference",
                    summary.maximumAbsoluteDifference.toFixed(2) + " km/h",
                  ],
                  ["Within stated tolerance", summary.withinTolerance + " / " + summary.count],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/10 p-3">
                    <p className="text-xs text-slate-400">{label}</p>
                    <strong className="tabular-nums">{value}</strong>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400">
                {summary.preliminarySampleSizeReached
                  ? "Preliminary sample target reached. Independent field validation is still required."
                  : `Collect at least ${preliminarySpeedSampleSize} distinct paired trials for a preliminary review.`}
              </p>
              <div className="max-h-64 overflow-auto">
                <table className="w-full min-w-[320px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th scope="col">Trial</th>
                      <th scope="col">Video</th>
                      <th scope="col">Reference</th>
                      <th scope="col">Difference</th>
                      <th scope="col">
                        <span className="sr-only">Remove trial</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairs.map((pair) => (
                      <tr key={pair.trial} className="border-b border-white/10 tabular-nums">
                        <td>{pair.trial}</td>
                        <td>{pair.videoKph.toFixed(2)}</td>
                        <td>{pair.referenceKph.toFixed(2)}</td>
                        <td>{(pair.videoKph - pair.referenceKph).toFixed(2)}</td>
                        <td>
                          <button
                            type="button"
                            className="p-2"
                            aria-label={`Remove trial ${pair.trial}`}
                            onClick={() =>
                              setPairs((current) => current.filter((item) => item.trial !== pair.trial))
                            }
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="action-secondary" onClick={exportPairs}>
                  <Download className="size-4" /> Export numeric CSV
                </button>
                <button
                  type="button"
                  className="action-secondary"
                  onClick={() => {
                    if (!window.confirm("Clear these local comparison trials?")) return;
                    setPairs([]);
                    setNextTrial(1);
                    setConfirmed(false);
                  }}
                >
                  Clear trials
                </button>
              </div>
            </>
          )}
          <p className="text-xs text-slate-400">
            Trial data stays in this open page, with no player identifiers or media. Export the
            numeric results before leaving; they are not stored in the club database.
          </p>
        </>
      )}
    </section>
  );
}
