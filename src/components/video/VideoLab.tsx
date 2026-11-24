import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import {
  ArrowUpRight,
  Camera,
  Circle,
  Columns2,
  Download,
  FileVideo,
  Link2,
  Minus,
  Pause,
  PenLine,
  Play,
  SkipBack,
  SkipForward,
  Trash2,
  Triangle,
  Undo2,
} from "lucide-react";
import {
  angleAt,
  pointsNeeded,
  syncedTime,
  type Pt,
  type Shape,
  type Tool,
} from "@/lib/video-annotate";

type Angle = { id: string; name: string; url: string };
const W = 1280;
const H = 720;
const palette = ["--gold", "--destructive", "--success", "--foreground"] as const;
const tools: { id: Tool; label: string; icon: typeof PenLine }[] = [
  { id: "pen", label: "Draw", icon: PenLine },
  { id: "line", label: "Line", icon: Minus },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "angle", label: "Angle", icon: Triangle },
];

const cssColor = (token: string) =>
  typeof window === "undefined"
    ? "#f5c542"
    : getComputedStyle(document.documentElement).getPropertyValue(token).trim() || "#f5c542";

function paint(ctx: CanvasRenderingContext2D, shapes: readonly Shape[]) {
  ctx.clearRect(0, 0, W, H);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const shape of shapes) {
    const [a, b, c] = shape.points;
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.color;
    ctx.lineWidth = 5;
    if (!a) continue;
    ctx.beginPath();
    if (shape.tool === "pen") {
      ctx.moveTo(a.x, a.y);
      shape.points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (shape.tool === "circle" && b) {
      ctx.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2);
      ctx.stroke();
    } else if ((shape.tool === "line" || shape.tool === "arrow") && b) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (shape.tool === "arrow") {
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - 26 * Math.cos(angle - 0.45), b.y - 26 * Math.sin(angle - 0.45));
        ctx.lineTo(b.x - 26 * Math.cos(angle + 0.45), b.y - 26 * Math.sin(angle + 0.45));
        ctx.closePath();
        ctx.fill();
      }
    } else if (shape.tool === "angle" && b) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      if (c) ctx.lineTo(c.x, c.y);
      ctx.stroke();
      if (c) {
        ctx.font = "bold 34px system-ui, sans-serif";
        const label = `${angleAt(a, b, c)}°`;
        const width = ctx.measureText(label).width;
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(b.x + 14, b.y - 42, width + 16, 44);
        ctx.globalAlpha = 1;
        ctx.fillStyle = shape.color;
        ctx.fillText(label, b.x + 22, b.y - 10);
      }
    }
  }
}

function Clip({
  angle,
  videoRef,
  zoom,
  shapes,
  onShapes,
  tool,
  color,
  onPlayState,
}: {
  angle: Angle;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  zoom: number;
  shapes: Shape[];
  onShapes: (shapes: Shape[]) => void;
  tool: Tool;
  color: string;
  onPlayState?: (playing: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draft = useRef<Shape | null>(null);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) paint(ctx, shapes);
  }, [shapes]);
  const point = (event: PointerEvent<HTMLCanvasElement>): Pt => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H,
    };
  };
  const redraw = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) paint(ctx, draft.current ? [...shapes, draft.current] : shapes);
  };
  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    videoRef.current?.pause();
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = point(event);
    if (draft.current?.tool === "angle" && draft.current.points.length === 2) {
      draft.current = { ...draft.current, points: [...draft.current.points, p] };
      onShapes([...shapes, draft.current]);
      draft.current = null;
      return;
    }
    draft.current = { tool, color, points: tool === "pen" ? [p] : [p, p] };
    redraw();
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!draft.current || event.buttons === 0) return;
    const p = point(event);
    const d = draft.current;
    draft.current =
      d.tool === "pen"
        ? { ...d, points: [...d.points, p] }
        : { ...d, points: [d.points[0]!, p, ...d.points.slice(2)] };
    redraw();
  };
  const up = () => {
    const d = draft.current;
    if (!d) return;
    if (d.tool === "angle" && d.points.length < pointsNeeded("angle")) {
      redraw(); // wait for the third tap
      return;
    }
    onShapes([...shapes, d]);
    draft.current = null;
  };
  return (
    <div className="relative aspect-video overflow-hidden bg-black">
      <video
        ref={videoRef}
        key={angle.url}
        src={angle.url}
        onPlay={() => onPlayState?.(true)}
        onPause={() => onPlayState?.(false)}
        className="size-full object-contain"
        style={{ transform: `scale(${zoom})` }}
        playsInline
        muted
        preload="auto"
      />
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        className="absolute inset-0 size-full touch-none"
        aria-label={`Drawing layer for ${angle.name}`}
      />
      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/90">
        {angle.name}
      </span>
    </div>
  );
}

/** Coaching video review: draw on a paused frame, measure angles, and play two clips side by side in step. */
export function VideoLab() {
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);
  const urls = useRef<string[]>([]);
  const [angles, setAngles] = useState<Angle[]>([]);
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [compare, setCompare] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool>("line");
  const [colorToken, setColorToken] = useState<(typeof palette)[number]>("--gold");
  const [shapes, setShapes] = useState<Record<string, Shape[]>>({});
  const [offset, setOffset] = useState<number | null>(null);
  const a = angles.find((x) => x.id === aId);
  const b = compare ? angles.find((x) => x.id === bId && x.id !== aId) : undefined;

  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const addVideos = (event: ChangeEvent<HTMLInputElement>) => {
    const added = Array.from(event.target.files ?? []).map((file, index) => {
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return {
        id: `${file.name}-${file.lastModified}-${index}-${Date.now()}`,
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 40),
        url,
      };
    });
    event.target.value = "";
    setAngles((current) => [...current, ...added]);
    if (!aId && added[0]) setAId(added[0].id);
    if (!bId && added[1]) setBId(added[1].id);
  };

  const both = (fn: (video: HTMLVideoElement) => void) => {
    if (aRef.current) fn(aRef.current);
    if (b && bRef.current) fn(bRef.current);
  };
  const follow = () => {
    if (!b || offset === null || !aRef.current || !bRef.current) return;
    bRef.current.currentTime = syncedTime(
      aRef.current.currentTime,
      offset,
      bRef.current.duration || 0,
    );
  };
  const step = (frames: number) => {
    aRef.current?.pause();
    bRef.current?.pause();
    if (aRef.current)
      aRef.current.currentTime = Math.max(0, aRef.current.currentTime + frames / 30);
    if (b && bRef.current) {
      if (offset !== null) follow();
      else bRef.current.currentTime = Math.max(0, bRef.current.currentTime + frames / 30);
    }
  };
  const toggle = () => {
    if (!aRef.current) return;
    if (aRef.current.paused) {
      follow();
      both((v) => {
        v.playbackRate = rate;
        void v.play();
      });
    } else both((v) => v.pause());
  };
  const snapshot = () => {
    const video = aRef.current;
    if (!video || !a) return;
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const scale = Math.min(W / (video.videoWidth || W), H / (video.videoHeight || H));
    const vw = (video.videoWidth || W) * scale;
    const vh = (video.videoHeight || H) * scale;
    ctx.drawImage(video, (W - vw) / 2, (H - vh) / 2, vw, vh);
    const layer = document.createElement("canvas");
    layer.width = W;
    layer.height = H;
    const lctx = layer.getContext("2d");
    if (lctx) {
      paint(lctx, shapes[a.id] ?? []);
      ctx.drawImage(layer, 0, 0);
    }
    const link = document.createElement("a");
    link.download = `${a.name}-${video.currentTime.toFixed(2)}s.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  };
  const color = cssColor(colorToken);
  const setFor = (id: string) => (next: Shape[]) =>
    setShapes((current) => ({ ...current, [id]: next }));

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="panel-kicker">Coaching review</p>
          <h2 className="font-display text-3xl font-bold">Video lab</h2>
          <p className="text-xs text-muted-foreground">
            Draw on a paused frame, measure body angles, and compare two clips side by side.
          </p>
        </div>
        <label className="action-primary cursor-pointer">
          <Camera className="size-4" /> Add clips
          <input type="file" accept="video/*" multiple onChange={addVideos} className="sr-only" />
        </label>
      </div>
      {a ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="scorer-input w-auto"
              value={aId}
              onChange={(e) => setAId(e.target.value)}
              aria-label="Main clip"
            >
              {angles.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="app-chip-button"
              aria-pressed={compare}
              disabled={angles.length < 2}
              onClick={() => setCompare(!compare)}
            >
              <Columns2 className="size-4" /> Side by side
            </button>
            {compare && (
              <select
                className="scorer-input w-auto"
                value={bId}
                onChange={(e) => {
                  setBId(e.target.value);
                  setOffset(null);
                }}
                aria-label="Second clip"
              >
                <option value="">Choose second clip</option>
                {angles
                  .filter((x) => x.id !== aId)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            )}
            {b && (
              <button
                type="button"
                className="app-chip-button"
                aria-pressed={offset !== null}
                onClick={() =>
                  setOffset(
                    offset !== null
                      ? null
                      : (bRef.current?.currentTime ?? 0) - (aRef.current?.currentTime ?? 0),
                  )
                }
                title="Pause both clips on the same moment (e.g. ball release), then lock them together"
              >
                <Link2 className="size-4" />{" "}
                {offset !== null
                  ? `Locked (${offset >= 0 ? "+" : ""}${offset.toFixed(2)}s)`
                  : "Lock in step"}
              </button>
            )}
          </div>
          <div
            className={`overflow-hidden rounded-3xl border border-border bg-black ${b ? "grid gap-px md:grid-cols-2" : ""}`}
          >
            <Clip
              angle={a}
              videoRef={aRef}
              zoom={zoom}
              shapes={shapes[a.id] ?? []}
              onShapes={setFor(a.id)}
              tool={tool}
              color={color}
              onPlayState={setPlaying}
            />
            {b && (
              <Clip
                angle={b}
                videoRef={bRef}
                zoom={zoom}
                shapes={shapes[b.id] ?? []}
                onShapes={setFor(b.id)}
                tool={tool}
                color={color}
              />
            )}
          </div>
          <div className="broadcast-panel flex flex-wrap items-center gap-2 p-3">
            <button
              type="button"
              onClick={() => step(-1)}
              className="video-control"
              aria-label="Previous frame"
            >
              <SkipBack className="size-4" />
            </button>
            <button
              type="button"
              onClick={toggle}
              className="video-control"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              className="video-control"
              aria-label="Next frame"
            >
              <SkipForward className="size-4" />
            </button>
            <select
              value={rate}
              onChange={(e) => {
                const next = Number(e.target.value);
                setRate(next);
                both((v) => {
                  v.playbackRate = next;
                });
              }}
              className="scorer-input w-auto"
              aria-label="Speed"
            >
              <option value={0.1}>0.1×</option>
              <option value={0.25}>0.25×</option>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
            </select>
            <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
            {tools.map((item) => (
              <button
                key={item.id}
                type="button"
                className="app-chip-button"
                aria-pressed={tool === item.id}
                onClick={() => setTool(item.id)}
                title={item.label}
              >
                <item.icon className="size-4" />{" "}
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
            {palette.map((token) => (
              <button
                key={token}
                type="button"
                aria-label={`Colour ${token.slice(2)}`}
                aria-pressed={colorToken === token}
                onClick={() => setColorToken(token)}
                className="size-7 rounded-full border-2 border-border aria-pressed:border-foreground"
                style={{ background: `var(${token})` }}
              />
            ))}
            <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
            <button
              type="button"
              className="video-control"
              aria-label="Undo last drawing"
              onClick={() =>
                setShapes((c) => ({
                  ...c,
                  [a.id]: (c[a.id] ?? []).slice(0, -1),
                  ...(b ? { [b.id]: c[b.id] ?? [] } : {}),
                }))
              }
            >
              <Undo2 className="size-4" />
            </button>
            <button
              type="button"
              className="video-control"
              aria-label="Clear drawings"
              onClick={() => setShapes((c) => ({ ...c, [a.id]: [], ...(b ? { [b.id]: [] } : {}) }))}
            >
              <Trash2 className="size-4" />
            </button>
            <button
              type="button"
              className="video-control"
              aria-label="Save frame as picture"
              onClick={snapshot}
            >
              <Download className="size-4" />
            </button>
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              Zoom
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-24"
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Angle tool: tap three points (e.g. hip, knee, ankle) to read the angle at the middle
            one. To compare, pause both clips at the same moment, press "Lock in step", then play or
            step frame by frame. Clips stay on this device.
          </p>
        </>
      ) : (
        <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border p-8 text-center">
          <FileVideo className="size-8 text-gold" />
          <div>
            <h3 className="font-bold">Add one or more clips</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Choose videos from this phone or computer: slow them down, step frame by frame, draw
              lines and angles, and put two side by side.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
