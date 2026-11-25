import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Gauge,
  Save,
  ScanSearch,
  Upload,
} from "lucide-react";
import {
  ballCandidates,
  ballSpeed,
  detectFps,
  fitBallTrack,
  reviewableBallSpeed,
  speedDistances,
  speedsByBowler,
  type Point,
  type SpeedDistance,
  type TrackPoint,
} from "@/lib/ball-speed";
import { currentInnings, findPlayer, setDeliverySpeed, type CricketMatch } from "@/lib/cricket";

const cameraKey = "criclume.speed-camera.v1";
const scanWidth = 320;

interface CameraMarks {
  a: Point;
  b: Point;
  width: number;
  height: number;
}

type Picking = "a" | "b" | null;

function readCamera(): CameraMarks | null {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(cameraKey) ?? "null",
    ) as CameraMarks | null;
    return value &&
      value.a &&
      value.b &&
      [value.width, value.height, value.a.x, value.a.y, value.b.x, value.b.y].every(
        Number.isFinite,
      ) &&
      value.width > 0 &&
      value.height > 0
      ? value
      : null;
  } catch {
    return null;
  }
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  if (!Number.isFinite(time) || time < 0 || time >= video.duration)
    return Promise.reject(new Error("Invalid frame time"));
  if (!video.seeking && video.readyState >= 2 && Math.abs(video.currentTime - time) < 0.0001)
    return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (ok: boolean) => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", done);
      if (ok) resolve();
      else reject(new Error("Video frame seek timed out"));
    };
    const done = () => finish(video.readyState >= 2);
    const timer = window.setTimeout(() => finish(false), 1500);
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = time;
  });
}

/**
 * Ball speed from a clip on this phone: nothing is uploaded and nothing is charged. Mark the camera
 * once (bowler's crease and batter's end), then each clip is timed automatically; marks can be
 * nudged a frame at a time or set by hand.
 */
export function BallSpeedTool({
  match,
  onSave,
}: {
  match: CricketMatch | null;
  onSave?: ((match: CricketMatch) => void) | undefined;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 1280, height: 720 });
  const [fps, setFps] = useState(30);
  const [fpsDetected, setFpsDetected] = useState(false);
  const [camera, setCamera] = useState<CameraMarks | null>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const [draftA, setDraftA] = useState<Point | null>(null);
  const [release, setRelease] = useState<number | null>(null);
  const [arrival, setArrival] = useState<number | null>(null);
  const [distance, setDistance] = useState<SpeedDistance>("stumps");
  const [measuredDistance, setMeasuredDistance] = useState("");
  const [distanceError, setDistanceError] = useState("0.2");
  const [timeScale, setTimeScale] = useState(1);
  const [calibrationConfirmed, setCalibrationConfirmed] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [duration, setDuration] = useState(0);
  const scanRequest = useRef(0);
  const scanLock = useRef(false);
  const [scan, setScan] = useState<{ busy: boolean; progress: number; message: string | null }>({
    busy: false,
    progress: 0,
    message: null,
  });
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [deliveryId, setDeliveryId] = useState("");

  useEffect(() => setCamera(readCamera()), []);
  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);
  useEffect(
    () => () => {
      scanRequest.current += 1;
    },
    [],
  );

  const metres = measuredDistance.trim()
    ? Number(measuredDistance)
    : speedDistances[distance].metres;
  const uncertainty = distanceError.trim() ? Number(distanceError) : NaN;
  const calibrated =
    calibrationConfirmed &&
    measuredDistance.trim() !== "" &&
    Number.isFinite(metres) &&
    metres >= 1 &&
    metres <= 25 &&
    Number.isFinite(uncertainty) &&
    uncertainty >= 0 &&
    uncertainty < metres;
  const reading =
    release != null && arrival != null && arrival <= duration
      ? ballSpeed(release, arrival, metres, fps, timeScale, uncertainty)
      : null;
  const canSave = calibrated && reviewConfirmed && !scan.busy && reviewableBallSpeed(reading);

  useEffect(() => {
    setReviewConfirmed(false);
  }, [release, arrival, metres, uncertainty, fps, timeScale, calibrationConfirmed]);
  const marks =
    camera && camera.width === size.width && camera.height === size.height
      ? camera
      : camera && Math.abs(camera.width / camera.height - size.width / size.height) < 0.01
        ? scaleMarks(camera, size)
        : null;

  const balls = useMemo(() => {
    if (!match) return [];
    return currentInnings(match).deliveries.slice(-24).reverse();
  }, [match]);
  const speeds = useMemo(
    () => (match ? speedsByBowler(match.innings.flatMap((item) => item.deliveries)) : []),
    [match],
  );

  const load = (file: File | undefined) => {
    if (!file) return;
    scanRequest.current += 1;
    scanLock.current = false;
    setCalibrationConfirmed(false);
    setReviewConfirmed(false);
    setMeasuredDistance("");
    setDistanceError("0.2");
    setPicking(null);
    setDraftA(null);
    setTimeScale(1);
    setDuration(0);
    setFps(30);
    setDeliveryId("");
    setSrc(URL.createObjectURL(file));
    setRelease(null);
    setArrival(null);
    setTrackPoints([]);
    setScan({ busy: false, progress: 0, message: null });
    setFpsDetected(false);
  };

  // Sample media presentation timestamps, not the original camera's capture clock.
  const measureFps = async () => {
    const video = videoRef.current;
    if (!video || scanLock.current || !video.requestVideoFrameCallback) {
      setScan({
        busy: false,
        progress: 0,
        message: "Media frame sampling is unavailable. Use the verified source frame rate.",
      });
      return;
    }
    const request = ++scanRequest.current;
    scanLock.current = true;
    setCalibrationConfirmed(false);
    setReviewConfirmed(false);
    setScan({ busy: true, progress: 0, message: "Sampling media frame timestamps…" });
    const times: number[] = [];
    const back = video.currentTime;
    const oldRate = video.playbackRate;
    video.muted = true;
    video.playbackRate = 0.25;
    try {
      await new Promise<void>((resolve) => {
        let callback = 0;
        let lastFrame: number | null = null;
        const finish = () => {
          window.clearTimeout(timer);
          video.cancelVideoFrameCallback(callback);
          resolve();
        };
        const step: VideoFrameRequestCallback = (_now, meta) => {
          if (request !== scanRequest.current) return finish();
          if (lastFrame !== null && meta.presentedFrames !== lastFrame + 1) times.length = 0;
          lastFrame = meta.presentedFrames;
          times.push(meta.mediaTime);
          if (times.length >= 14) finish();
          else callback = video.requestVideoFrameCallback(step);
        };
        const timer = window.setTimeout(finish, 4500);
        callback = video.requestVideoFrameCallback(step);
        void video.play().catch(finish);
      });
      if (request !== scanRequest.current) return;
      video.pause();
      video.playbackRate = oldRate;
      if (back < video.duration) await seek(video, back);
      if (request !== scanRequest.current) return;
      const found = detectFps(times);
      setFpsDetected(Boolean(found));
      if (found) setFps(found);
      setScan({
        busy: false,
        progress: 0,
        message: found
          ? "Sampled media rate only. Verify the original capture/export timebase."
          : "Frame rate could not be sampled reliably. Verify the source manually.",
      });
    } catch {
      if (request === scanRequest.current)
        setScan({ busy: false, progress: 0, message: "Frame sampling failed." });
    } finally {
      if (request === scanRequest.current) {
        video.pause();
        video.playbackRate = oldRate;
        scanLock.current = false;
      }
    }
  };

  const toVideoPoint = (event: MouseEvent<SVGSVGElement>): Point | null => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const p = point.matrixTransform(matrix.inverse());
    return { x: Math.round(p.x), y: Math.round(p.y) };
  };

  const onTap = (event: MouseEvent<SVGSVGElement>) => {
    if (!picking || scanLock.current) return;
    const p = toVideoPoint(event);
    if (!p || p.x < 0 || p.y < 0 || p.x > size.width || p.y > size.height) return;
    if (picking === "a") {
      setDraftA(p);
      setPicking("b");
      return;
    }
    if (!draftA || Math.hypot(p.x - draftA.x, p.y - draftA.y) < size.width * 0.05) return;
    setCalibrationConfirmed(false);
    const next = { a: draftA, b: p, width: size.width, height: size.height };
    setCamera(next);
    setPicking(null);
    setDraftA(null);
    try {
      window.localStorage.setItem(cameraKey, JSON.stringify(next));
    } catch {
      /* storage may be unavailable */
    }
  };

  const step = (frames: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = Math.max(
      0,
      Math.min(video.duration || 0, video.currentTime + frames / fps),
    );
  };

  const nudge = (which: "release" | "arrival", frames: number) => {
    const set = which === "release" ? setRelease : setArrival;
    set((value) => (value == null ? value : Math.max(0, value + frames / fps)));
  };

  const autoTime = async () => {
    const video = videoRef.current;
    if (!video || !marks || !calibrated || timeScale !== 1 || scanLock.current) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const request = ++scanRequest.current;
    scanLock.current = true;
    setReviewConfirmed(false);
    setRelease(null);
    setArrival(null);
    setScan({ busy: true, progress: 0, message: null });
    setTrackPoints([]);
    const back = video.currentTime;
    video.pause();
    const scale = scanWidth / size.width;
    const w = scanWidth;
    const h = Math.max(1, Math.round(size.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      scanLock.current = false;
      setScan({
        busy: false,
        progress: 0,
        message: "This browser can't read video frames.",
      });
      return;
    }
    const a = { x: marks.a.x * scale, y: marks.a.y * scale };
    const b = { x: marks.b.x * scale, y: marks.b.y * scale };
    // Look from just before where the clip is paused (or the start) for up to 2.5 seconds.
    const start = Math.max(0, (video.duration || 0) <= 4 ? 0 : video.currentTime - 0.4);
    const end = Math.min(video.duration || 0, start + 2.5);
    const sampleRate = Math.min(fps, 120);
    const count = Math.floor((end - start) * sampleRate);
    const frames: { time: number; grey: Uint8ClampedArray }[] = [];
    const points: TrackPoint[] = [];
    try {
      for (let k = 0; k < count; k += 1) {
        if (request !== scanRequest.current) return;
        const time = start + k / sampleRate;
        await seek(video, time);
        if (request !== scanRequest.current) return;
        context.drawImage(video, 0, 0, w, h);
        const rgba = context.getImageData(0, 0, w, h).data;
        const grey = new Uint8ClampedArray(w * h);
        for (let i = 0, j = 0; i < grey.length; i += 1, j += 4)
          grey[i] = (rgba[j]! * 3 + rgba[j + 1]! * 6 + rgba[j + 2]!) / 10;
        frames.push({ time, grey });
        if (frames.length >= 3) {
          const [p, c, n] = frames.slice(-3) as [
            (typeof frames)[0],
            (typeof frames)[0],
            (typeof frames)[0],
          ];
          for (const candidate of ballCandidates(p.grey, c.grey, n.grey, w, h, a, b))
            points.push({ time: c.time, t: candidate.t });
          frames.shift();
        }
        if (k % 6 === 0)
          setScan({ busy: true, progress: Math.round((k / count) * 100), message: null });
      }
      const track = fitBallTrack(points, metres);
      if (request !== scanRequest.current) return;
      if (
        track &&
        track.fit >= 0.9 &&
        track.releaseTime >= start &&
        track.arrivalTime <= end &&
        track.arrivalTime > track.releaseTime
      ) {
        setRelease(track.releaseTime);
        setArrival(track.arrivalTime);
        setTrackPoints(track.points);
        await seek(video, track.releaseTime);
        if (request !== scanRequest.current) return;
        setScan({
          busy: false,
          progress: 100,
          message: `Candidate motion track: ${track.points.length} samples. Review both timing marks before saving.`,
        });
      } else {
        await seek(video, back);
        if (request !== scanRequest.current) return;
        setScan({
          busy: false,
          progress: 100,
          message: "No reliable candidate track. Mark the two visible crossing times manually.",
        });
      }
    } catch {
      if (request === scanRequest.current)
        setScan({ busy: false, progress: 0, message: "Frame scan failed. Try manual timing." });
    } finally {
      if (request === scanRequest.current) scanLock.current = false;
    }
  };

  const cancelScan = () => {
    scanRequest.current += 1;
    scanLock.current = false;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.playbackRate = 1;
    }
    setRelease(null);
    setArrival(null);
    setTrackPoints([]);
    setScan({ busy: false, progress: 0, message: "Scan cancelled." });
  };

  const saveToBall = () => {
    if (!match || !onSave || !reading || !canSave || !balls.some((ball) => ball.id === deliveryId))
      return;
    onSave(setDeliverySpeed(match, deliveryId, reading.kph));
    setDeliveryId("");
  };

  return (
    <section className="broadcast-panel space-y-4 p-4 md:p-5" aria-label="Ball speed">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="panel-kicker flex items-center gap-2">
            <Gauge className="size-4" aria-hidden="true" /> Ball speed
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Local video estimate, not a radar reading. Use a fixed side-on camera with a measured
            distance and a known recording timebase. Automatic motion tracking proposes marks for
            human review; it does not independently identify or certify the ball.
          </p>
        </div>
        <label className="action-secondary cursor-pointer">
          <Upload className="size-4" /> Choose clip
          <input
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(event) => load(event.target.files?.[0])}
          />
        </label>
      </div>

      {src && (
        <div className="space-y-3">
          <div className="speed-stage">
            <video
              key={src}
              ref={videoRef}
              src={src}
              playsInline
              muted
              controls={!picking && !scan.busy}
              preload="metadata"
              className="speed-video"
              onLoadedMetadata={(event) => {
                const video = event.currentTarget;
                setSize({ width: video.videoWidth || 1280, height: video.videoHeight || 720 });
                setDuration(Number.isFinite(video.duration) ? video.duration : 0);
              }}
            />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${size.width} ${size.height}`}
              preserveAspectRatio="xMidYMid meet"
              className={`speed-overlay ${picking ? "is-picking" : ""}`}
              onClick={onTap}
              role={picking ? "button" : undefined}
              aria-label={
                picking === "a"
                  ? "Tap where the bowler lets go of the ball"
                  : picking === "b"
                    ? "Tap the batter's end"
                    : undefined
              }
            >
              {(picking ? draftA : marks?.a) && (
                <circle
                  cx={(picking ? draftA : marks?.a)!.x}
                  cy={(picking ? draftA : marks?.a)!.y}
                  r={size.width / 90}
                  className="speed-mark"
                />
              )}
              {!picking && marks && (
                <>
                  <line
                    x1={marks.a.x}
                    y1={marks.a.y}
                    x2={marks.b.x}
                    y2={marks.b.y}
                    className="speed-line"
                  />
                  <circle
                    cx={marks.b.x}
                    cy={marks.b.y}
                    r={size.width / 90}
                    className="speed-mark"
                  />
                  {trackPoints.map((p, i) => (
                    <circle
                      key={i}
                      cx={marks.a.x + (marks.b.x - marks.a.x) * p.t}
                      cy={marks.a.y + (marks.b.y - marks.a.y) * p.t}
                      r={size.width / 220}
                      className="speed-track"
                    />
                  ))}
                </>
              )}
            </svg>
            {picking && (
              <p className="speed-hint" role="status">
                {picking === "a"
                  ? "1 of 2: tap where the bowler lets go (their front crease)"
                  : "2 of 2: tap the batter's stumps"}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="app-chip-button"
              disabled={scan.busy}
              onClick={() => step(-1)}
              aria-label="Back one frame"
            >
              <ChevronLeft className="size-4" /> Frame
            </button>
            <button
              type="button"
              className="app-chip-button"
              disabled={scan.busy}
              onClick={() => step(1)}
              aria-label="Forward one frame"
            >
              Frame <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              className="app-chip-button"
              disabled={scan.busy}
              onClick={() => {
                setCalibrationConfirmed(false);
                setPicking("a");
              }}
            >
              <Crosshair className="size-4" /> {camera ? "Re-mark camera" : "Mark camera"}
            </button>
            <label className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Media frame rate</span>
              <select
                className="scorer-input w-auto"
                value={fps}
                disabled={scan.busy}
                onChange={(event) => {
                  setFps(Number(event.target.value));
                  setFpsDetected(false);
                  setCalibrationConfirmed(false);
                }}
              >
                {[24, 25, 30, 50, 60, 100, 120, 240].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate} fps
                  </option>
                ))}
              </select>
              {fpsDetected && (
                <span className="text-[11px] text-muted-foreground">(sampled estimate)</span>
              )}
            </label>
            <select
              className="scorer-input w-auto text-xs"
              aria-label="Distance between the two marks"
              value={distance}
              disabled={scan.busy}
              onChange={(event) => {
                setDistance(event.target.value as SpeedDistance);
                setCalibrationConfirmed(false);
                setMeasuredDistance("");
              }}
            >
              {(Object.keys(speedDistances) as SpeedDistance[]).map((key) => (
                <option key={key} value={key}>
                  {speedDistances[key].label}
                </option>
              ))}
            </select>
          </div>

          <fieldset disabled={scan.busy} className="space-y-3 rounded-xl border border-border p-3">
            <legend className="px-1 text-sm font-semibold">Distance and recording timebase</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-xs">
                Measured distance (m)
                <input
                  type="number"
                  min={1}
                  max={25}
                  step={0.01}
                  inputMode="decimal"
                  value={measuredDistance}
                  placeholder="Measure the two points"
                  className="scorer-input"
                  onChange={(event) => {
                    setMeasuredDistance(event.target.value);
                    setCalibrationConfirmed(false);
                  }}
                />
              </label>
              <label className="grid gap-1 text-xs">
                Distance error (± m)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                  value={distanceError}
                  className="scorer-input"
                  onChange={(event) => {
                    setDistanceError(event.target.value);
                    setCalibrationConfirmed(false);
                  }}
                />
              </label>
              <label className="grid gap-1 text-xs">
                Original video timebase
                <select
                  value={timeScale}
                  className="scorer-input"
                  onChange={(event) => {
                    setTimeScale(Number(event.target.value));
                    setCalibrationConfirmed(false);
                  }}
                >
                  <option value={1}>Real-time recording</option>
                  <option value={0.5}>2× slowed export</option>
                  <option value={0.25}>4× slowed export</option>
                  <option value={0.125}>8× slowed export</option>
                </select>
              </label>
            </div>
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={calibrationConfirmed}
                onChange={(event) => setCalibrationConfirmed(event.target.checked)}
              />
              I verified the measured distance, fixed camera geometry, media frame rate and original
              recording timebase. The two points are on the ball's measured path.
            </label>
            <p className="text-xs text-muted-foreground">
              Preset distances are approximate. Confirm an actual measured distance before saving.
              Slowed exports need manual marks; variable-speed edited clips are unsuitable.
            </p>
            <button type="button" className="action-secondary" onClick={() => void measureFps()}>
              Sample media frame rate
            </button>
          </fieldset>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="action-primary"
              disabled={!marks || !calibrated || timeScale !== 1 || scan.busy}
              onClick={() => void autoTime()}
            >
              <ScanSearch className="size-4" />{" "}
              {scan.busy ? `Scanning motion… ${scan.progress}%` : "Suggest timing marks"}
            </button>
            {scan.busy && (
              <button type="button" className="action-secondary" onClick={cancelScan}>
                Cancel scan
              </button>
            )}
            <button
              type="button"
              className="app-chip-button"
              disabled={scan.busy}
              onClick={() => {
                const video = videoRef.current;
                video?.pause();
                if (video && !video.seeking && video.readyState >= 2) setRelease(video.currentTime);
              }}
            >
              Release is this frame
            </button>
            <button
              type="button"
              className="app-chip-button"
              disabled={scan.busy}
              onClick={() => {
                const video = videoRef.current;
                video?.pause();
                if (video && !video.seeking && video.readyState >= 2) setArrival(video.currentTime);
              }}
            >
              Arrival is this frame
            </button>
          </div>
          {!marks && (
            <p className="text-xs text-amber-200">
              Mark the camera first: pause on a clear frame, tap “Mark camera”, then tap the two
              points.
            </p>
          )}
          {scan.message && (
            <p className="text-xs text-muted-foreground" role="status">
              {scan.message}
            </p>
          )}

          {(release != null || arrival != null) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {(["release", "arrival"] as const).map((which) => {
                const value = which === "release" ? release : arrival;
                return (
                  <div
                    key={which}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <span>
                      {which === "release" ? "Release" : "Arrival"}{" "}
                      <strong className="tabular-nums">
                        {value == null ? "—" : `${value.toFixed(3)} s`}
                      </strong>
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        className="app-chip-button"
                        aria-label={`${which} one frame earlier`}
                        disabled={scan.busy}
                        onClick={() => nudge(which, -1)}
                      >
                        −1
                      </button>
                      <button
                        type="button"
                        className="app-chip-button"
                        aria-label={`${which} one frame later`}
                        disabled={scan.busy}
                        onClick={() => nudge(which, 1)}
                      >
                        +1
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {reading && (
            <div className="speed-reading" role="status" aria-live="polite">
              <p className="text-xs font-semibold text-muted-foreground">Video speed estimate</p>
              <p className="speed-kph">
                {reading.kph.toFixed(1)} <span>km/h</span>
              </p>
              <p className="text-sm">
                {reading.mph.toFixed(1)} mph · {reading.seconds.toFixed(3)} s down the pitch
              </p>
              <p className="text-xs text-muted-foreground">
                Timing and stated distance-error range: {reading.lowKph.toFixed(0)}–
                {Number.isFinite(reading.highKph) ? reading.highKph.toFixed(0) : "?"} km/h at {fps}{" "}
                fps. Estimated average speed over the measured segment; not peak release speed.
                Perspective, blur and tracking errors are not included in this range.
              </p>
              {reading.warning && <p className="text-xs text-amber-200">{reading.warning}</p>}
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={reviewConfirmed}
                  disabled={!calibrated || scan.busy}
                  onChange={(event) => setReviewConfirmed(event.target.checked)}
                />
                I reviewed both marks and confirm this is a video-derived estimate.
              </label>
              {match && onSave && balls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    className="scorer-input min-w-0 flex-1"
                    aria-label="Which ball was this?"
                    value={deliveryId}
                    onChange={(event) => setDeliveryId(event.target.value)}
                  >
                    <option value="">Which ball was this?</option>
                    {balls.map((ball) => (
                      <option key={ball.id} value={ball.id}>
                        Over {ball.over}.{ball.ball} ·{" "}
                        {findPlayer(match, ball.bowlerId)?.name ?? "Bowler"} to{" "}
                        {findPlayer(match, ball.strikerId)?.name ?? "batter"}
                        {ball.speedKph != null ? ` · saved ${ball.speedKph} km/h` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="action-primary"
                    disabled={!deliveryId || !canSave}
                    onClick={saveToBall}
                  >
                    <Save className="size-4" /> Save estimate to ball
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {match && speeds.length > 0 && (
        <div>
          <h3 className="panel-kicker mb-2">Video speed estimates this match</h3>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {speeds.map((row) => (
              <li
                key={row.bowlerId}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
              >
                <span className="font-semibold">
                  {findPlayer(match, row.bowlerId)?.name ?? "Bowler"}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  top {row.fastest} · avg {row.average} km/h · {row.balls} ball
                  {row.balls === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function scaleMarks(marks: CameraMarks, size: { width: number; height: number }): CameraMarks {
  const sx = size.width / marks.width;
  const sy = size.height / marks.height;
  return {
    a: { x: marks.a.x * sx, y: marks.a.y * sy },
    b: { x: marks.b.x * sx, y: marks.b.y * sy },
    ...size,
  };
}
