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
    return value && value.a && value.b && value.width > 0 ? value : null;
  } catch {
    return null;
  }
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    window.setTimeout(done, 1500);
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
  const [scan, setScan] = useState<{ busy: boolean; progress: number; message: string | null }>({
    busy: false,
    progress: 0,
    message: null,
  });
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [deliveryId, setDeliveryId] = useState("");

  useEffect(() => setCamera(readCamera()), []);
  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);

  const metres = speedDistances[distance].metres;
  const reading =
    release != null && arrival != null ? ballSpeed(release, arrival, metres, fps) : null;
  const marks =
    camera && camera.width === size.width && camera.height === size.height
      ? camera
      : camera
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
    setSrc(URL.createObjectURL(file));
    setRelease(null);
    setArrival(null);
    setTrackPoints([]);
    setScan({ busy: false, progress: 0, message: null });
    setFpsDetected(false);
  };

  // Frame rate: watch a few frames play (muted) and read their timestamps.
  const measureFps = async () => {
    const video = videoRef.current as
      | (HTMLVideoElement & {
          requestVideoFrameCallback?: (
            cb: (now: number, meta: { mediaTime: number }) => void,
          ) => number;
        })
      | null;
    if (!video?.requestVideoFrameCallback) return;
    const times: number[] = [];
    video.muted = true;
    // Play slowly so the screen shows every frame, even from 240 fps slow-motion clips.
    video.playbackRate = 0.125;
    await new Promise<void>((resolve) => {
      const step = (_now: number, meta: { mediaTime: number }) => {
        times.push(meta.mediaTime);
        if (times.length < 14) video.requestVideoFrameCallback!(step);
        else resolve();
      };
      video.requestVideoFrameCallback!(step);
      void video.play().catch(() => resolve());
      window.setTimeout(resolve, 4500);
    });
    video.pause();
    video.playbackRate = 1;
    await seek(video, 0);
    const found = detectFps(times);
    if (found) {
      setFps(found);
      setFpsDetected(true);
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
    if (!picking) return;
    const p = toVideoPoint(event);
    if (!p) return;
    if (picking === "a") {
      setDraftA(p);
      setPicking("b");
      return;
    }
    if (!draftA) return;
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
    if (!video || !marks) return;
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
    if (!context)
      return setScan({
        busy: false,
        progress: 0,
        message: "This browser can't read video frames.",
      });
    const a = { x: marks.a.x * scale, y: marks.a.y * scale };
    const b = { x: marks.b.x * scale, y: marks.b.y * scale };
    // Look from just before where the clip is paused (or the start) for up to 2.5 seconds.
    const start = Math.max(0, (video.duration || 0) <= 4 ? 0 : video.currentTime - 0.4);
    const end = Math.min(video.duration || 0, start + 2.5);
    const count = Math.max(3, Math.floor((end - start) * fps));
    const frames: { time: number; grey: Uint8ClampedArray }[] = [];
    const points: TrackPoint[] = [];
    for (let k = 0; k < count; k += 1) {
      const time = start + k / fps;
      await seek(video, time + 0.5 / fps);
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
    if (track) {
      setRelease(Math.max(0, track.releaseTime));
      setArrival(track.arrivalTime);
      setTrackPoints(track.points);
      await seek(video, Math.max(0, track.releaseTime));
      setScan({
        busy: false,
        progress: 100,
        message: `Found the ball in ${track.points.length} frames${track.fit < 0.9 ? " — the path is a bit uneven, so check the marks" : ""}.`,
      });
    } else {
      await seek(video, back);
      setScan({
        busy: false,
        progress: 100,
        message:
          "Couldn't follow the ball in this clip. Pause where the ball leaves the hand and try again, or set the two marks by hand.",
      });
    }
  };

  const saveToBall = () => {
    if (!match || !onSave || !reading || !deliveryId) return;
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
            Free and on this phone: the clip is never uploaded. Film side-on from a fixed spot
            (slow-motion 120 or 240 fps is most accurate), mark the camera once, then each ball is
            timed automatically.
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
              ref={videoRef}
              src={src}
              playsInline
              muted
              controls={!picking}
              preload="auto"
              className="speed-video"
              onLoadedMetadata={(event) => {
                const video = event.currentTarget;
                setSize({ width: video.videoWidth || 1280, height: video.videoHeight || 720 });
                void measureFps();
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
              onClick={() => step(-1)}
              aria-label="Back one frame"
            >
              <ChevronLeft className="size-4" /> Frame
            </button>
            <button
              type="button"
              className="app-chip-button"
              onClick={() => step(1)}
              aria-label="Forward one frame"
            >
              Frame <ChevronRight className="size-4" />
            </button>
            <button type="button" className="app-chip-button" onClick={() => setPicking("a")}>
              <Crosshair className="size-4" /> {camera ? "Re-mark camera" : "Mark camera"}
            </button>
            <label className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Frame rate</span>
              <select
                className="scorer-input w-auto"
                value={fps}
                onChange={(event) => {
                  setFps(Number(event.target.value));
                  setFpsDetected(false);
                }}
              >
                {[24, 25, 30, 50, 60, 100, 120, 240].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate} fps
                  </option>
                ))}
              </select>
              {fpsDetected && (
                <span className="text-[11px] text-muted-foreground">(read from the clip)</span>
              )}
            </label>
            <select
              className="scorer-input w-auto text-xs"
              aria-label="Distance between the two marks"
              value={distance}
              onChange={(event) => setDistance(event.target.value as SpeedDistance)}
            >
              {(Object.keys(speedDistances) as SpeedDistance[]).map((key) => (
                <option key={key} value={key}>
                  {speedDistances[key].label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="action-primary"
              disabled={!marks || scan.busy}
              onClick={() => void autoTime()}
            >
              <ScanSearch className="size-4" />{" "}
              {scan.busy ? `Following the ball… ${scan.progress}%` : "Time it automatically"}
            </button>
            <button
              type="button"
              className="app-chip-button"
              onClick={() => setRelease(videoRef.current?.currentTime ?? null)}
            >
              Release is this frame
            </button>
            <button
              type="button"
              className="app-chip-button"
              onClick={() => setArrival(videoRef.current?.currentTime ?? null)}
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
                        onClick={() => nudge(which, -1)}
                      >
                        −1
                      </button>
                      <button
                        type="button"
                        className="app-chip-button"
                        aria-label={`${which} one frame later`}
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
              <p className="speed-kph">
                {reading.kph.toFixed(1)} <span>km/h</span>
              </p>
              <p className="text-sm">
                {reading.mph.toFixed(1)} mph · {reading.seconds.toFixed(3)} s down the pitch
              </p>
              <p className="text-xs text-muted-foreground">
                Likely between {reading.lowKph.toFixed(0)} and{" "}
                {Number.isFinite(reading.highKph) ? reading.highKph.toFixed(0) : "?"} km/h at {fps}{" "}
                fps. Average speed down the pitch; speed guns show the release speed, which is a
                little higher.
              </p>
              {reading.warning && <p className="text-xs text-amber-200">{reading.warning}</p>}
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
                    disabled={!deliveryId}
                    onClick={saveToBall}
                  >
                    <Save className="size-4" /> Save to ball
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {match && speeds.length > 0 && (
        <div>
          <h3 className="panel-kicker mb-2">Measured this match</h3>
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
