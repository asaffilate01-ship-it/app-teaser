import { ChevronDown, Gauge } from "lucide-react";
import { useState } from "react";
import type { Prediction, MatchConditions } from "@/lib/win-predictor";
import { defaultConditions } from "@/lib/win-predictor";
import type { WinPoint } from "@/lib/win-timeline";

function Worm({ points, firstName }: { points: WinPoint[]; firstName: string }) {
  if (points.length < 2) return null;
  const width = 300;
  const height = 64;
  const x = (index: number) => (index / (points.length - 1)) * width;
  const y = (value: number) => height - (value / 100) * height;
  const line = points.map((point, index) => `${x(index).toFixed(1)},${y(point.firstTeamWin).toFixed(1)}`).join(" ");
  const area = `0,${height / 2} ${line} ${width},${height / 2}`;
  const last = points.at(-1)!;
  return (
    <figure className="win-worm" aria-label={`${firstName} win chance over the match, now ${last.firstTeamWin}%`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <line x1={0} x2={width} y1={height / 2} y2={height / 2} className="win-worm-mid" />
        <polygon points={area} className="win-worm-area" />
        <polyline points={line} className="win-worm-line" />
        <circle cx={x(points.length - 1)} cy={y(last.firstTeamWin)} r={3.5} className="win-worm-dot" />
      </svg>
      <figcaption>
        <span>{points[0]!.label}</span>
        <span>{last.label}</span>
      </figcaption>
    </figure>
  );
}

type Option<T> = [T, string];

function Segmented<T extends string | number | boolean>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="win-option">
      <p className="shot-step-label">{label}</p>
      <div className="win-segmented">
        {options.map(([option, text]) => (
          <button key={String(option)} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ConditionsEditor({
  conditions,
  onChange,
  homeName,
  awayName,
}: {
  conditions: MatchConditions;
  onChange: (conditions: MatchConditions) => void;
  homeName: string;
  awayName: string;
}) {
  const set = <K extends keyof MatchConditions>(key: K, value: MatchConditions[K]) => onChange({ ...conditions, [key]: value });
  return (
    <div className="win-conditions">
      <Segmented label="Pitch" value={conditions.pitch} onChange={(v) => set("pitch", v)} options={[["batting", "Batting"], ["balanced", "Balanced"], ["bowling", "Bowling"]]} />
      <Segmented label="Outfield" value={conditions.outfield} onChange={(v) => set("outfield", v)} options={[["fast", "Fast"], ["average", "Average"], ["slow", "Slow"]]} />
      <Segmented label="Sky" value={conditions.weather} onChange={(v) => set("weather", v)} options={[["clear", "Clear"], ["overcast", "Overcast"]]} />
      <Segmented label="Evening dew" value={conditions.dew} onChange={(v) => set("dew", v)} options={[[false, "No"], [true, "Expected"]]} />
      <Segmented
        label="Stronger side on paper"
        value={conditions.edge}
        onChange={(v) => set("edge", v)}
        options={[[1, homeName], [0, "Even"], [-1, awayName]]}
      />
    </div>
  );
}

/** WinViz-style win chance bar for the two teams, with an optional "worm" and conditions editor. */
export function WinPredictor({
  firstName,
  secondName,
  firstWin,
  prediction,
  battingName,
  timeline = [],
  conditions,
  onConditionsChange,
  homeName,
  awayName,
  unavailableReason,
}: {
  firstName: string;
  secondName: string;
  /** Win chance of `firstName`, or null when the predictor does not apply. */
  firstWin: number | null;
  prediction?: Prediction | null;
  battingName?: string;
  timeline?: WinPoint[];
  conditions?: MatchConditions | undefined;
  onConditionsChange?: ((conditions: MatchConditions) => void) | undefined;
  homeName?: string;
  awayName?: string;
  unavailableReason?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  if (firstWin == null) {
    return (
      <section className="broadcast-panel win-card" aria-label="Win predictor">
        <p className="panel-kicker inline-flex items-center gap-1.5">
          <Gauge className="size-3.5" aria-hidden="true" /> Win predictor
        </p>
        <p className="scoreboard-muted mt-2 text-sm">
          {unavailableReason ?? "The win predictor works for limited-overs matches with one innings each."}
        </p>
        <Worm points={timeline} firstName={firstName} />
      </section>
    );
  }
  const secondWin = 100 - firstWin;
  return (
    <section className="broadcast-panel win-card" aria-label="Win predictor">
      <div className="flex items-center justify-between gap-3">
        <p className="panel-kicker inline-flex items-center gap-1.5">
          <Gauge className="size-3.5" aria-hidden="true" /> Win predictor
        </p>
        {prediction && battingName ? (
          <p className="scoreboard-muted text-[11px]">
            {battingName} projected <strong className="text-foreground">{prediction.projected}</strong> · par {prediction.par}
          </p>
        ) : null}
      </div>
      <div className="win-teams">
        <div className="min-w-0">
          <p className="win-team truncate">{firstName}</p>
          <p className="win-pct win-pct-a">{firstWin}%</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="win-team truncate">{secondName}</p>
          <p className="win-pct win-pct-b">{secondWin}%</p>
        </div>
      </div>
      <div className="win-bar" role="img" aria-label={`${firstName} ${firstWin}%, ${secondName} ${secondWin}%`}>
        <span className="win-bar-a" style={{ width: `${firstWin}%` }} />
        <span className="win-bar-b" style={{ width: `${secondWin}%` }} />
      </div>
      <Worm points={timeline} firstName={firstName} />
      {onConditionsChange && homeName && awayName ? (
        <>
          <button type="button" className="win-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            Match conditions
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {open && (
            <ConditionsEditor
              conditions={conditions ?? defaultConditions}
              onChange={onConditionsChange}
              homeName={homeName}
              awayName={awayName}
            />
          )}
        </>
      ) : null}
      <p className="win-note">Estimate from score, wickets, balls left and conditions. Not an official result.</p>
    </section>
  );
}
