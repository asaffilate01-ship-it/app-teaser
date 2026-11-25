import { useState, type RefObject } from "react";
import { Gauge } from "lucide-react";
import { ballSpeed, reviewableBallSpeed } from "@/lib/ball-speed";

/** Manual timing from the already-authorised replay player; never creates another media URL. */
export function CameraSpeedReview({
  player,
  deadline,
}: {
  player: RefObject<HTMLVideoElement | null>;
  deadline: number;
}) {
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState<number | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const [distance, setDistance] = useState("");
  const [errorMetres, setErrorMetres] = useState("");
  const [fps, setFps] = useState("30");
  const [timeScale, setTimeScale] = useState("1");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const metres = Number(distance);
  const uncertainty = Number(errorMetres);
  const reading =
    open &&
    confirmed &&
    first !== null &&
    last !== null &&
    distance.trim() &&
    errorMetres.trim() &&
    metres >= 1 &&
    metres <= 25 &&
    Date.now() < deadline
      ? ballSpeed(first, last, metres, Number(fps), Number(timeScale), uncertainty)
      : null;
  const reset = () => {
    setFirst(null);
    setLast(null);
    setConfirmed(false);
    setError("");
  };
  const mark = (which: "first" | "last") => {
    const video = player.current;
    if (
      Date.now() >= deadline ||
      !video ||
      video.seeking ||
      video.readyState < 2 ||
      !Number.isFinite(video.currentTime)
    ) {
      setError("Pause on a visible frame in the current private recording.");
      return;
    }
    video.pause();
    setConfirmed(false);
    setError("");
    if (which === "first") setFirst(video.currentTime);
    else setLast(video.currentTime);
  };

  return (
    <section className="mt-4 space-y-3 rounded-xl border border-white/10 p-3">
      <button
        type="button"
        aria-expanded={open}
        className="action-secondary w-full justify-center"
        onClick={() => {
          reset();
          setOpen((value) => !value);
        }}
      >
        <Gauge className="size-4" aria-hidden="true" />{" "}
        {open ? "Close speed review" : "Estimate ball speed"}
      </button>
      {open && (
        <>
          <p className="text-xs leading-5 text-slate-400">
            Use the same fixed side-on recording, with two measured crossing points before bounce.
            Pause the replay at each crossing and mark its media timestamp. Do not use a live
            stream, network arrival time, or an edited variable-speed clip.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="action-secondary" onClick={() => mark("first")}>
              First point: {first === null ? "Mark" : first.toFixed(3) + " s"}
            </button>
            <button type="button" className="action-secondary" onClick={() => mark("last")}>
              Second point: {last === null ? "Mark" : last.toFixed(3) + " s"}
            </button>
            <label className="grid gap-1 text-xs">
              Measured distance (m)
              <input
                type="number"
                min={1}
                max={25}
                step={0.01}
                value={distance}
                className="scorer-input"
                onChange={(event) => {
                  setDistance(event.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <label className="grid gap-1 text-xs">
              Distance uncertainty (± m)
              <input
                type="number"
                min={0}
                step={0.01}
                value={errorMetres}
                className="scorer-input"
                onChange={(event) => {
                  setErrorMetres(event.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <label className="grid gap-1 text-xs">
              Verified media frame rate
              <select
                value={fps}
                className="scorer-input"
                onChange={(event) => {
                  setFps(event.target.value);
                  setConfirmed(false);
                }}
              >
                {[24, 25, 30, 50, 60, 100, 120, 240].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate} fps
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              Original video timebase
              <select
                value={timeScale}
                className="scorer-input"
                onChange={(event) => {
                  setTimeScale(event.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="1">Real-time recording</option>
                <option value="0.5">2× slowed export</option>
                <option value="0.25">4× slowed export</option>
                <option value="0.125">8× slowed export</option>
              </select>
            </label>
          </div>
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I verified the two visible crossings, actual distance, timebase and media frame rate.
          </label>
          {error && (
            <p role="alert" className="text-xs text-amber-200">
              {error}
            </p>
          )}
          {confirmed && !reading && (
            <p role="alert" className="text-xs text-amber-200">
              A valid measured distance, uncertainty and ordered timing marks are required.
            </p>
          )}
          {reading && (
            <div aria-live="polite" className="rounded-xl border border-white/10 p-3">
              <p className="text-xs text-slate-400">Estimated segment-average speed</p>
              <strong className="text-2xl tabular-nums">{reading.kph.toFixed(1)} km/h</strong>
              <p className="text-sm">{reading.mph.toFixed(1)} mph</p>
              <p className="mt-1 text-xs text-slate-400">
                Timing and stated distance-error range: {reading.lowKph.toFixed(0)}–
                {Number.isFinite(reading.highKph) ? reading.highKph.toFixed(0) : "unbounded"} km/h.
                This range excludes perspective, motion blur and calibration bias.
              </p>
              {!reviewableBallSpeed(reading) && (
                <p role="alert" className="mt-1 text-xs text-amber-200">
                  {reading.warning ?? "Insufficient measurement quality."}
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-slate-400">
            Coaching estimate only. No radar-certified release speed or official scoring record is
            produced by this review.
          </p>
          <button type="button" className="action-secondary" onClick={reset}>
            Clear timing marks
          </button>
        </>
      )}
    </section>
  );
}
