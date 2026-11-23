import type { CricketMatch, Delivery, DeliveryStyle, Innings } from "./cricket.ts";

export type Phase = "Powerplay" | "Middle" | "Death";

export interface SplitRow {
  label: string;
  balls: number;
  runs: number;
  wickets: number;
  dots: number;
  boundaries: number;
  /** Runs per 6 legal balls. */
  runRate: number;
}

/** Powerplay and death overs for a limited-overs innings. The Hundred: first 25 balls are the powerplay. */
export function phaseOvers(oversPerInnings: number | null, format?: string): { powerplay: number; death: number } | null {
  if (!oversPerInnings) return null;
  if (format === "The Hundred") return { powerplay: 5, death: 4 };
  if (oversPerInnings >= 40) return { powerplay: 10, death: 10 };
  if (oversPerInnings >= 15) return { powerplay: 6, death: Math.max(1, Math.round(oversPerInnings / 4)) };
  if (oversPerInnings >= 8) return { powerplay: Math.max(1, Math.round(oversPerInnings * 0.3)), death: Math.max(1, Math.round(oversPerInnings / 5)) };
  return { powerplay: 1, death: 1 };
}

export function phaseOf(over: number, oversPerInnings: number | null, format?: string): Phase | null {
  const phases = phaseOvers(oversPerInnings, format);
  if (!phases || oversPerInnings == null) return null;
  if (over < phases.powerplay) return "Powerplay";
  if (over >= oversPerInnings - phases.death) return "Death";
  return "Middle";
}

const row = (label: string, deliveries: readonly Delivery[]): SplitRow => {
  const balls = deliveries.filter((d) => d.legal).length;
  const runs = deliveries.reduce((sum, d) => sum + d.batterRuns + d.extras.wide + d.extras.noBall + d.extras.bye + d.extras.legBye + d.extras.penalty, 0);
  return {
    label,
    balls,
    runs,
    wickets: deliveries.filter((d) => d.dismissal).length,
    dots: deliveries.filter((d) => d.legal && d.batterRuns === 0 && !d.extras.bye && !d.extras.legBye && !d.dismissal).length,
    boundaries: deliveries.filter((d) => d.batterRuns >= 4).length,
    runRate: balls ? Math.round(((runs * 6) / balls) * 100) / 100 : 0,
  };
};

/** Runs, wickets and scoring rate in the powerplay, middle and death overs. */
export function phaseSplits(match: CricketMatch, innings: Innings, filter: (d: Delivery) => boolean = () => true): SplitRow[] {
  const overs = innings.kind === "super-over" ? null : match.settings.oversPerInnings;
  const balls = innings.deliveries.filter(filter);
  if (!phaseOvers(overs, match.settings.format)) return [row("All overs", balls)];
  return (["Powerplay", "Middle", "Death"] as const).map((phase) =>
    row(phase, balls.filter((d) => phaseOf(d.over, overs, match.settings.format) === phase)),
  );
}

export const paceStyles: readonly DeliveryStyle[] = ["Fast", "Medium"];
export const spinStyles: readonly DeliveryStyle[] = ["Off spin", "Leg spin", "Left-arm spin"];

/** Pace against spin, then each bowling type that was recorded. */
export function bowlingTypeSplits(deliveries: readonly Delivery[]): SplitRow[] {
  const pace = deliveries.filter((d) => paceStyles.includes(d.deliveryStyle));
  const spin = deliveries.filter((d) => spinStyles.includes(d.deliveryStyle));
  const styles = [...new Set(deliveries.map((d) => d.deliveryStyle))];
  return [row("Pace", pace), row("Spin", spin), ...styles.map((style) => row(style, deliveries.filter((d) => d.deliveryStyle === style)))].filter(
    (item) => item.balls > 0 || item.runs > 0,
  );
}
