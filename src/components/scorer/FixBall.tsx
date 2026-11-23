import { useState } from "react";
import { Wrench, X } from "lucide-react";
import {
  correctDelivery,
  currentInnings,
  findTeam,
  type CricketMatch,
  type Delivery,
  type DismissalType,
  type Extras,
} from "@/lib/cricket";

type SaveWithPayload = (match: CricketMatch, eventType?: string, extra?: Record<string, unknown>) => void;

const outs: { value: DismissalType; label: string }[] = [
  { value: "bowled", label: "Bowled" },
  { value: "caught", label: "Caught" },
  { value: "lbw", label: "LBW" },
  { value: "stumped", label: "Stumped" },
  { value: "run-out", label: "Run out" },
  { value: "hit-wicket", label: "Hit wicket" },
  { value: "obstructing-the-field", label: "Obstructing the field" },
];

/** Later balls whose over.ball number moved after the change, so the server's copy matches. */
export function renumbered(before: readonly Delivery[], after: readonly Delivery[]) {
  const old = new Map(before.map((d) => [d.id, `${d.over}.${d.ball}`]));
  return after.filter((d) => old.get(d.id) !== `${d.over}.${d.ball}`).map((d) => ({ id: d.id, over: d.over, ball: d.ball }));
}

/** Change any earlier ball in this innings: runs, extras, bowler, batter, fielder or the wicket. */
export function FixBallPanel({ match, delivery, onSave, onClose }: { match: CricketMatch; delivery: Delivery; onSave: SaveWithPayload; onClose: () => void }) {
  const innings = currentInnings(match);
  const batting = findTeam(match, innings.battingTeamId);
  const bowling = findTeam(match, innings.bowlingTeamId);
  const [runs, setRuns] = useState(delivery.batterRuns);
  const [extras, setExtras] = useState<Extras>({ ...delivery.extras });
  const [bowlerId, setBowlerId] = useState(delivery.bowlerId);
  const [strikerId, setStrikerId] = useState(delivery.strikerId);
  const [fielderId, setFielderId] = useState(delivery.fielderId ?? "");
  const [out, setOut] = useState<DismissalType | "">(delivery.dismissal?.type ?? "");
  const [outBatter, setOutBatter] = useState(delivery.dismissal?.batterId ?? delivery.strikerId);
  const [outFielder, setOutFielder] = useState(delivery.dismissal?.fielderId ?? "");
  const [error, setError] = useState<string | null>(null);
  const needsFielder = out === "caught" || out === "stumped" || out === "run-out";
  const setExtra = (key: keyof Extras, value: number) => setExtras((current) => ({ ...current, [key]: Math.max(0, Math.min(9, value)) }));

  const save = () => {
    setError(null);
    if (extras.wide > 0 && extras.noBall > 0) return setError("A ball can't be both a wide and a no-ball.");
    const result = correctDelivery(match, delivery.id, {
      batterRuns: runs,
      extras,
      bowlerId,
      strikerId,
      nonStrikerId: strikerId === delivery.strikerId ? delivery.nonStrikerId : strikerId === delivery.nonStrikerId ? delivery.strikerId : delivery.nonStrikerId,
      fielderId: fielderId || undefined,
      dismissal: out ? { type: out, batterId: outBatter, ...(needsFielder && outFielder ? { fielderId: outFielder } : {}) } : null,
    });
    if ("error" in result) return setError(result.error);
    const fixed = currentInnings(result.match).deliveries.find((d) => d.id === delivery.id)!;
    const renumber = renumbered(innings.deliveries, currentInnings(result.match).deliveries).filter((d) => d.id !== delivery.id);
    onSave(result.match, "delivery.corrected", { delivery: fixed, deliveryId: fixed.id, renumber });
    onClose();
  };

  const extraField = (key: keyof Extras, label: string) => (
    <label className="block text-xs">
      {label}
      <input type="number" min={0} max={9} inputMode="numeric" className="scorer-input mt-1" value={extras[key]} onChange={(e) => setExtra(key, Number(e.target.value) || 0)} />
    </label>
  );

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card/60 p-4" role="group" aria-label={`Fix ball ${delivery.over}.${delivery.ball}`}>
      <div className="flex items-center justify-between">
        <p className="panel-kicker flex items-center gap-2">
          <Wrench className="size-4" aria-hidden="true" /> Fix ball {delivery.over}.{delivery.ball}
        </p>
        <button type="button" className="app-chip-button" aria-label="Close" onClick={onClose}>
          <X className="size-4" />
        </button>
      </div>
      <div>
        <p className="mb-1 text-xs">Runs off the bat</p>
        <div className="grid grid-cols-7 gap-1.5">
          {[0, 1, 2, 3, 4, 5, 6].map((value) => (
            <button key={value} type="button" className="app-chip-button justify-center" aria-pressed={runs === value} onClick={() => setRuns(value)}>
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {extraField("wide", "Wides")}
        {extraField("noBall", "No-balls")}
        {extraField("bye", "Byes")}
        {extraField("legBye", "Leg byes")}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-xs">
          Bowler
          <select className="scorer-input mt-1" value={bowlerId} onChange={(e) => setBowlerId(e.target.value)}>
            {bowling.players.filter((p) => p.id === bowlerId || (p.substitute !== "fielding" && !p.replacedBy)).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          On strike
          <select className="scorer-input mt-1" value={strikerId} onChange={(e) => setStrikerId(e.target.value)}>
            {[delivery.strikerId, delivery.nonStrikerId].filter((id, i, all) => all.indexOf(id) === i).map((id) => (
              <option key={id} value={id}>{batting.players.find((p) => p.id === id)?.name ?? "Batter"}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          Fielded by
          <select className="scorer-input mt-1" value={fielderId} onChange={(e) => setFielderId(e.target.value)}>
            <option value="">Not recorded</option>
            {bowling.players.filter((p) => !p.replacedBy || p.id === fielderId).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-xs">
          Wicket
          <select className="scorer-input mt-1" value={out} onChange={(e) => setOut(e.target.value as DismissalType | "")}>
            <option value="">Not out</option>
            {outs.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        {out && (
          <label className="block text-xs">
            Who was out
            <select className="scorer-input mt-1" value={outBatter} onChange={(e) => setOutBatter(e.target.value)}>
              {[delivery.strikerId, delivery.nonStrikerId].filter((id, i, all) => all.indexOf(id) === i).map((id) => (
                <option key={id} value={id}>{batting.players.find((p) => p.id === id)?.name ?? "Batter"}</option>
              ))}
            </select>
          </label>
        )}
        {needsFielder && (
          <label className="block text-xs">
            {out === "stumped" ? "Keeper" : out === "caught" ? "Caught by" : "Run out by"}
            <select className="scorer-input mt-1" value={outFielder} onChange={(e) => setOutFielder(e.target.value)}>
              <option value="">Not recorded</option>
              {bowling.players.filter((p) => !p.replacedBy || p.id === outFielder).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        The innings is worked out again from the first ball, so totals, overs, the scorecard and the public scoreboard all update. Every fix is kept in the match history.
      </p>
      {error && <p className="text-xs text-rose-300" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="action-primary" onClick={save}>Save fix</button>
        <button type="button" className="action-secondary" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
