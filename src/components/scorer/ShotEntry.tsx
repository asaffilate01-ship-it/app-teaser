import { History, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { FieldZone, Player, ShotOutcome } from "@/lib/cricket";
import { closeCatchers, ringSectors, zoneInfo, type ZoneInfo } from "@/lib/field-positions";

const SIZE = 340;
const C = SIZE / 2;
const CENTRE = 44;
const RING = 102;
const OUTER = 162;

function point(r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}

function bandPath(inner: number, outer: number, start: number, end: number) {
  const a = point(inner, start);
  const b = point(outer, start);
  const d = point(outer, end);
  const e = point(inner, end);
  const large = end - start > 180 ? 1 : 0;
  return `M${a.x},${a.y} L${b.x},${b.y} A${outer},${outer} 0 ${large} 1 ${d.x},${d.y} L${e.x},${e.y} A${inner},${inner} 0 ${large} 0 ${a.x},${a.y} Z`;
}

const pressKeys = (event: KeyboardEvent, action: () => void) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
};

const buzz = () => {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* haptics are optional */
  }
};

const depthText: Record<ZoneInfo["depth"], string> = {
  close: "Close catcher",
  ring: "Inside the ring",
  deep: "In the deep",
  centre: "Around the pitch",
};
const sideText: Record<ZoneInfo["side"], string> = {
  leg: "Leg side",
  off: "Off side",
  straight: "Straight",
  centre: "Centre",
};

function Wedge({
  zone,
  lines,
  inner,
  outer,
  start,
  end,
  selected,
  alt,
  depth,
  onPick,
}: {
  zone: FieldZone;
  lines: readonly string[];
  inner: number;
  outer: number;
  start: number;
  end: number;
  selected: boolean;
  alt: boolean;
  depth: "ring" | "deep";
  onPick: (zone: FieldZone) => void;
}) {
  const mid = point((inner + outer) / 2, (start + end) / 2);
  const lineGap = depth === "deep" ? 12 : 11;
  const firstY = mid.y - ((lines.length - 1) * lineGap) / 2 + 4;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={zone}
      aria-pressed={selected}
      className={`zone-wedge zone-${depth}${alt ? " zone-alt" : ""}`}
      onClick={() => onPick(zone)}
      onKeyDown={(event) => pressKeys(event, () => onPick(zone))}
    >
      <title>{zone}</title>
      <path d={bandPath(inner, outer, start, end)} />
      {lines.map((line, index) => (
        <text
          key={line}
          x={mid.x}
          y={firstY + index * lineGap}
          textAnchor="middle"
          className={`zone-label${depth === "ring" ? " zone-label-small" : ""}`}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

/**
 * Tap-the-field picker for where the ball went. Keeper at the top, bowler at the bottom.
 * Inside-the-ring and deep positions are drawn; close catchers sit underneath as buttons.
 */
export function ShotZonePicker({
  value,
  onChange,
  label = "Fielding position",
  leftHanded = false,
  onHandChange,
  recent = [],
}: {
  value: FieldZone;
  onChange: (zone: FieldZone) => void;
  label?: string;
  leftHanded?: boolean;
  onHandChange?: ((leftHanded: boolean) => void) | undefined;
  recent?: readonly FieldZone[];
}) {
  const pick = (zone: FieldZone) => {
    buzz();
    onChange(value === zone ? "Not recorded" : zone);
  };
  const span = (start: number, end: number) =>
    (leftHanded ? [360 - end, 360 - start] : [start, end]) as [number, number];
  const selectedInfo = value === "Not recorded" ? undefined : zoneInfo(value);
  const centre: { zone: FieldZone; d: string; y: number }[] = [
    {
      zone: "Keeper",
      d: `M${C - CENTRE},${C} A${CENTRE},${CENTRE} 0 0 1 ${C + CENTRE},${C} Z`,
      y: C - 22,
    },
    {
      zone: "Bowler",
      d: `M${C + CENTRE},${C} A${CENTRE},${CENTRE} 0 0 1 ${C - CENTRE},${C} Z`,
      y: C + 30,
    },
  ];
  const recentShown = recent.filter((zone) => zone !== value).slice(0, 4);

  return (
    <div className="zone-picker-wrap" role="group" aria-label={label}>
      <div className="zone-toolbar">
        <div className="zone-legend" aria-hidden="true">
          <span>
            <i className="zone-key zone-key-ring" />
            Ring
          </span>
          <span>
            <i className="zone-key zone-key-deep" />
            Deep
          </span>
        </div>
        {onHandChange && (
          <div className="zone-hand" role="group" aria-label="Batter hand">
            <button type="button" aria-pressed={!leftHanded} onClick={() => onHandChange(false)}>
              Right-hand
            </button>
            <button type="button" aria-pressed={leftHanded} onClick={() => onHandChange(true)}>
              Left-hand
            </button>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="zone-picker"
        aria-label={`${label} — ground view`}
      >
        <circle cx={C} cy={C} r={OUTER + 5} className="zone-boundary" />
        {ringSectors.map((sector, index) => {
          const [start, end] = span(sector.start, sector.end);
          return (
            <g key={sector.deep}>
              <Wedge
                zone={sector.deep}
                lines={sector.deepLabel}
                inner={RING}
                outer={OUTER}
                start={start}
                end={end}
                selected={value === sector.deep}
                alt={index % 2 === 1}
                depth="deep"
                onPick={pick}
              />
              <Wedge
                zone={sector.inner}
                lines={sector.innerLabel}
                inner={CENTRE}
                outer={RING}
                start={start}
                end={end}
                selected={value === sector.inner}
                alt={index % 2 === 1}
                depth="ring"
                onPick={pick}
              />
            </g>
          );
        })}
        <circle cx={C} cy={C} r={RING} className="zone-ring-line" />
        {centre.map((item) => (
          <g
            key={item.zone}
            role="button"
            tabIndex={0}
            aria-label={item.zone}
            aria-pressed={value === item.zone}
            className="zone-wedge zone-centre"
            onClick={() => pick(item.zone)}
            onKeyDown={(event) => pressKeys(event, () => pick(item.zone))}
          >
            <title>{item.zone}</title>
            <path d={item.d} />
            <text x={C} y={item.y} textAnchor="middle" className="zone-label zone-label-small">
              {item.zone}
            </text>
          </g>
        ))}
        <rect x={C - 5} y={C - 16} width={10} height={32} rx={2} className="zone-pitch" />
        <text x={12} y={20} className="zone-side">
          {leftHanded ? "LEG" : "OFF"}
        </text>
        <text x={SIZE - 12} y={20} textAnchor="end" className="zone-side">
          {leftHanded ? "OFF" : "LEG"}
        </text>
      </svg>

      <div className="zone-readout" aria-live="polite">
        {selectedInfo ? (
          <>
            <strong>{value}</strong>
            <span>
              {depthText[selectedInfo.depth]} · {sideText[selectedInfo.side]}
            </span>
          </>
        ) : (
          <span>Tap a position on the ground</span>
        )}
      </div>

      <div className="zone-close">
        {(leftHanded ? (["leg", "off"] as const) : (["off", "leg"] as const)).map((side) => (
          <div key={side} role="group" aria-label={`Close in, ${side} side`}>
            <p className="shot-step-label">Close in · {side} side</p>
            <div className="zone-chips">
              {closeCatchers
                .filter((catcher) => catcher.side === side)
                .map((catcher) => (
                  <button
                    key={catcher.name}
                    type="button"
                    aria-pressed={value === catcher.name}
                    aria-label={catcher.name}
                    title={catcher.name}
                    onClick={() => pick(catcher.name)}
                    className="zone-chip"
                  >
                    {catcher.label}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {recentShown.length > 0 && (
        <div>
          <p className="shot-step-label inline-flex items-center gap-1.5">
            <History className="size-3" aria-hidden="true" /> Recent
          </p>
          <div className="zone-chips">
            {recentShown.map((zone) => (
              <button
                key={zone}
                type="button"
                onClick={() => pick(zone)}
                className="zone-chip zone-chip-recent"
              >
                {zone}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** One-tap fielder chips. The first suggested id gets a "last here" hint. */
export function FielderChips({
  players,
  value,
  onChange,
  suggestedId,
  allowNone = true,
  label,
}: {
  players: Player[];
  value: string;
  onChange: (id: string) => void;
  suggestedId?: string | undefined;
  allowNone?: boolean;
  label: string;
}) {
  return (
    <div role="group" aria-label={label}>
      <p className="shot-step-label">{label}</p>
      <div className="fielder-chips">
        {allowNone && (
          <button
            type="button"
            aria-pressed={value === ""}
            onClick={() => onChange("")}
            className="fielder-chip fielder-chip-none"
          >
            Not sure
          </button>
        )}
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            aria-pressed={value === player.id}
            onClick={() => {
              buzz();
              onChange(value === player.id && allowNone ? "" : player.id);
            }}
            className="fielder-chip"
          >
            <span className="fielder-chip-avatar" aria-hidden="true">
              {player.name
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <span className="truncate">{player.name}</span>
            {suggestedId === player.id && <span className="fielder-chip-hint">last here</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

const outcomes: [ShotOutcome, string][] = [
  ["hit-no-run", "Hit, no run"],
  ["hit", "Shot played"],
  ["left", "Left"],
  ["missed", "Missed"],
];

export function OutcomeChips({
  value,
  onChange,
}: {
  value: ShotOutcome;
  onChange: (outcome: ShotOutcome) => void;
}) {
  return (
    <div role="group" aria-label="What did the batter do?">
      <p className="shot-step-label">What did the batter do?</p>
      <div className="outcome-chips">
        {outcomes.map(([outcome, text]) => (
          <button
            key={outcome}
            type="button"
            aria-pressed={value === outcome}
            onClick={() => onChange(outcome)}
            className="fielder-chip justify-center"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ShotSummary({
  zone,
  fielderName,
  onClear,
}: {
  zone: FieldZone;
  fielderName?: string | undefined;
  onClear: () => void;
}) {
  if (zone === "Not recorded" && !fielderName) {
    return <p className="shot-summary-hint">Tap where the ball went, then tap the runs.</p>;
  }
  return (
    <div className="shot-summary">
      <span>
        Next ball: <strong>{zone === "Not recorded" ? "position not set" : zone}</strong>
        {fielderName ? (
          <>
            {" "}
            · fielded by <strong>{fielderName}</strong>
          </>
        ) : null}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="shot-summary-clear"
        aria-label="Clear position and fielder"
      >
        <X className="size-3.5" aria-hidden="true" /> Clear
      </button>
    </div>
  );
}
