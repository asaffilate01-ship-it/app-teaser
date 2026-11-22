import { X } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { FieldZone, Player, ShotOutcome } from "@/lib/cricket";
import { pickerZones } from "@/lib/shot-entry";

const SIZE = 300;
const C = SIZE / 2;
const INNER = 58;
const OUTER = 142;
const STEP = 360 / pickerZones.length;

function point(r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}

function wedgePath(start: number, end: number) {
  const a = point(INNER, start);
  const b = point(OUTER, start);
  const d = point(OUTER, end);
  const e = point(INNER, end);
  return `M${a.x},${a.y} L${b.x},${b.y} A${OUTER},${OUTER} 0 0 1 ${d.x},${d.y} L${e.x},${e.y} A${INNER},${INNER} 0 0 0 ${a.x},${a.y} Z`;
}

const pressKeys = (event: KeyboardEvent, action: () => void) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
};

/** Tap-the-field picker for where the ball went (right-handed batter view, keeper at the top). */
export function ShotZonePicker({
  value,
  onChange,
  label = "Shot area",
}: {
  value: FieldZone;
  onChange: (zone: FieldZone) => void;
  label?: string;
}) {
  const toggle = (zone: FieldZone) => onChange(value === zone ? "Not recorded" : zone);
  const inner: { zone: FieldZone; d: string; y: number }[] = [
    { zone: "Keeper", d: `M${C - INNER + 3},${C} A${INNER - 3},${INNER - 3} 0 0 1 ${C + INNER - 3},${C} Z`, y: C - 30 },
    { zone: "Bowler", d: `M${C + INNER - 3},${C} A${INNER - 3},${INNER - 3} 0 0 1 ${C - INNER + 3},${C} Z`, y: C + 38 },
  ];
  return (
    <div className="zone-picker-wrap">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="zone-picker" role="group" aria-label={label}>
        <circle cx={C} cy={C} r={OUTER + 4} className="zone-boundary" />
        {pickerZones.map((zone, index) => {
          const start = index * STEP;
          const mid = point((INNER + OUTER) / 2 + 6, start + STEP / 2);
          const selected = value === zone;
          const [first, ...rest] = zone.split(" ");
          return (
            <g
              key={zone}
              role="button"
              tabIndex={0}
              aria-label={zone}
              aria-pressed={selected}
              className="zone-wedge"
              onClick={() => toggle(zone)}
              onKeyDown={(event) => pressKeys(event, () => toggle(zone))}
            >
              <path d={wedgePath(start, start + STEP)} />
              <text x={mid.x} y={mid.y + (rest.length ? -2 : 4)} textAnchor="middle" className="zone-label">
                {first}
              </text>
              {rest.length > 0 && (
                <text x={mid.x} y={mid.y + 12} textAnchor="middle" className="zone-label">
                  {rest.join(" ")}
                </text>
              )}
            </g>
          );
        })}
        {inner.map((item) => (
          <g
            key={item.zone}
            role="button"
            tabIndex={0}
            aria-label={item.zone}
            aria-pressed={value === item.zone}
            className="zone-wedge zone-inner"
            onClick={() => toggle(item.zone)}
            onKeyDown={(event) => pressKeys(event, () => toggle(item.zone))}
          >
            <path d={item.d} />
            <text x={C} y={item.y} textAnchor="middle" className="zone-label zone-label-small">
              {item.zone}
            </text>
          </g>
        ))}
        <rect x={C - 6} y={C - 20} width={12} height={40} rx={3} className="zone-pitch" />
        <text x={14} y={22} className="zone-side">OFF</text>
        <text x={SIZE - 14} y={22} textAnchor="end" className="zone-side">LEG</text>
      </svg>
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
            onClick={() => onChange(value === player.id && allowNone ? "" : player.id)}
            className="fielder-chip"
          >
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
        Next ball: <strong>{zone === "Not recorded" ? "area not set" : zone}</strong>
        {fielderName ? (
          <>
            {" "}· fielded by <strong>{fielderName}</strong>
          </>
        ) : null}
      </span>
      <button type="button" onClick={onClear} className="shot-summary-clear" aria-label="Clear shot area and fielder">
        <X className="size-3.5" aria-hidden="true" /> Clear
      </button>
    </div>
  );
}
