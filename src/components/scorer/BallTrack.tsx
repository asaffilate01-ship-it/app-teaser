import { useState, type PointerEvent } from "react";
import { Target } from "lucide-react";
import type { BallPoint, Delivery } from "@/lib/cricket";
import { ballTone, clampPoint, lengthBand, lineBand, pitchBreakdown, type BallTone } from "@/lib/ball-track";

const toneFill: Record<BallTone, string> = {
  wicket: "var(--destructive)",
  boundary: "var(--gold)",
  runs: "var(--success)",
  dot: "var(--muted-foreground)",
};

const tapPoint = (event: PointerEvent<SVGSVGElement>, _width: number, _height: number) => {
  const box = event.currentTarget.getBoundingClientRect();
  return clampPoint((event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
};

/** Pitch strip seen from the bowler's end: batter's stumps at the bottom, halfway at the top. */
function PitchSvg({ dots, onTap, label }: { dots: { point: BallPoint; tone: BallTone; key: string }[]; onTap?: (point: BallPoint) => void; label: string }) {
  const W = 120;
  const H = 200;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`ball-track-svg ${onTap ? "cursor-crosshair" : ""}`}
      role={onTap ? "button" : "img"}
      aria-label={label}
      onPointerDown={
        onTap
          ? (event) => {
              const p = tapPoint(event, W, H);
              onTap({ x: p.x, y: Math.round((1 - p.y) * 1000) / 1000 });
            }
          : undefined
      }
    >
      <rect x={0} y={0} width={W} height={H} rx={8} className="ball-track-pitch" />
      {[0.2, 0.6, 0.8].map((y) => (
        <line key={y} x1={0} x2={W} y1={H * (1 - y)} y2={H * (1 - y)} className="ball-track-band" />
      ))}
      <text x={4} y={H * 0.9} className="ball-track-label">Yorker</text>
      <text x={4} y={H * 0.6} className="ball-track-label">Full</text>
      <text x={4} y={H * 0.3} className="ball-track-label">Good</text>
      <text x={4} y={H * 0.11} className="ball-track-label">Short</text>
      <line x1={0} x2={W} y1={H - 14} y2={H - 14} className="ball-track-crease" />
      {[0.46, 0.5, 0.54].map((x) => (
        <rect key={x} x={W * x - 1.5} y={H - 12} width={3} height={10} className="ball-track-stump" />
      ))}
      {dots.map((dot) => (
        <circle key={dot.key} cx={dot.point.x * W} cy={(1 - dot.point.y) * H} r={5} fill={toneFill[dot.tone]} className="ball-track-dot" />
      ))}
    </svg>
  );
}

/** Batter's end face-on: where the ball passed the batter (the beehive). */
function BeehiveSvg({ dots, onTap, label }: { dots: { point: BallPoint; tone: BallTone; key: string }[]; onTap?: (point: BallPoint) => void; label: string }) {
  const W = 160;
  const H = 120;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`ball-track-svg ${onTap ? "cursor-crosshair" : ""}`}
      role={onTap ? "button" : "img"}
      aria-label={label}
      onPointerDown={
        onTap
          ? (event) => {
              const p = tapPoint(event, W, H);
              onTap({ x: p.x, y: Math.round((1 - p.y) * 1000) / 1000 });
            }
          : undefined
      }
    >
      <rect x={0} y={0} width={W} height={H} rx={8} className="ball-track-pitch" />
      <line x1={0} x2={W} y1={H - 1} y2={H - 1} className="ball-track-crease" />
      {[0.46, 0.5, 0.54].map((x) => (
        <rect key={x} x={W * x - 2} y={H * 0.62} width={4} height={H * 0.38} className="ball-track-stump" />
      ))}
      <line x1={0} x2={W} y1={H * 0.35} y2={H * 0.35} className="ball-track-band" />
      <text x={4} y={H * 0.32} className="ball-track-label">Chest</text>
      <text x={4} y={H * 0.6} className="ball-track-label">Waist</text>
      {dots.map((dot) => (
        <circle key={dot.key} cx={dot.point.x * W} cy={(1 - dot.point.y) * H} r={5} fill={toneFill[dot.tone]} className="ball-track-dot" />
      ))}
    </svg>
  );
}

/** Optional per-ball taps: where it pitched and where it passed the batter. */
export function BallTrackPad({
  pitch,
  beehive,
  onPitch,
  onBeehive,
  leftHanded,
}: {
  pitch: BallPoint | undefined;
  beehive: BallPoint | undefined;
  onPitch: (point: BallPoint | undefined) => void;
  onBeehive: (point: BallPoint | undefined) => void;
  leftHanded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const summary = [pitch ? `${lengthBand(pitch)} · ${lineBand(pitch, leftHanded).toLowerCase()}` : null, beehive ? "beehive set" : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="broadcast-panel p-4" aria-label="Pitch map and beehive">
      <button type="button" className="flex w-full items-center justify-between gap-3" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="panel-kicker flex items-center gap-2">
          <Target className="size-4" aria-hidden="true" /> Pitch map &amp; beehive
        </span>
        <span className="text-[11px] text-muted-foreground">{summary || (open ? "Tap where it pitched" : "Optional")}</span>
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] gap-3">
          <figure className="space-y-1">
            <figcaption className="text-[11px] font-semibold text-muted-foreground">Where it pitched</figcaption>
            <PitchSvg label="Tap where the ball pitched" dots={pitch ? [{ point: pitch, tone: "boundary", key: "p" }] : []} onTap={onPitch} />
          </figure>
          <figure className="space-y-1">
            <figcaption className="text-[11px] font-semibold text-muted-foreground">Where it passed the batter</figcaption>
            <BeehiveSvg label="Tap where the ball passed the batter" dots={beehive ? [{ point: beehive, tone: "boundary", key: "b" }] : []} onTap={onBeehive} />
            {(pitch || beehive) && (
              <button
                type="button"
                className="app-chip-button mt-2"
                onClick={() => {
                  onPitch(undefined);
                  onBeehive(undefined);
                }}
              >
                Clear taps
              </button>
            )}
          </figure>
          <p className="col-span-2 text-[11px] text-muted-foreground">Seen from the bowler's end. Saved with the next ball you record.</p>
        </div>
      )}
    </div>
  );
}

/** Pitch map + beehive for a set of balls, with runs and wickets by length. */
export function BallTrackChart({ deliveries, leftHanded }: { deliveries: readonly Delivery[]; leftHanded: (batterId: string) => boolean }) {
  const breakdown = pitchBreakdown(deliveries, leftHanded);
  const pitched = deliveries.filter((d) => d.pitch).map((d) => ({ point: d.pitch!, tone: ballTone(d), key: d.id }));
  const hive = deliveries.filter((d) => d.beehive).map((d) => ({ point: d.beehive!, tone: ballTone(d), key: d.id }));
  if (!pitched.length && !hive.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No pitch map taps yet. Open "Pitch map &amp; beehive" on the scoring screen and tap where each ball pitched.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] gap-4">
        <figure className="space-y-1">
          <figcaption className="text-xs font-semibold text-muted-foreground">Pitch map · {pitched.length} balls</figcaption>
          <PitchSvg label={`Pitch map of ${pitched.length} balls`} dots={pitched} />
        </figure>
        <figure className="space-y-1">
          <figcaption className="text-xs font-semibold text-muted-foreground">Beehive · {hive.length} balls</figcaption>
          <BeehiveSvg label={`Beehive of ${hive.length} balls`} dots={hive} />
          <ul className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {(Object.keys(toneFill) as BallTone[]).map((tone) => (
              <li key={tone} className="flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-full" style={{ background: toneFill[tone] }} />
                {tone === "runs" ? "1–3 runs" : tone === "boundary" ? "4 or 6" : tone}
              </li>
            ))}
          </ul>
        </figure>
      </div>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 text-left font-semibold">Length</th>
            <th className="text-right font-semibold">Balls</th>
            <th className="text-right font-semibold">Runs</th>
            <th className="text-right font-semibold">Dots</th>
            <th className="text-right font-semibold">Wkts</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {[...breakdown.byLength, ...breakdown.byLine].map((row, index) => (
            <tr key={row.band} className={index === 4 ? "border-t border-border" : ""}>
              <td className="py-1">{row.band}</td>
              <td className="text-right">{row.balls}</td>
              <td className="text-right">{row.runs}</td>
              <td className="text-right">{row.dots}</td>
              <td className="text-right">{row.wickets}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
