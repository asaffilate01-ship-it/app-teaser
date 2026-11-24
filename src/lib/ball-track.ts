import type { BallPoint, Delivery } from "./cricket.ts";

/**
 * Pitch map and beehive helpers. Points are stored as tapped from the bowler's end:
 * x 0 = left edge (off side for a right-hander), 0.5 = middle stump, 1 = right edge.
 * Pitch y: 0 = batter's stumps, 1 = halfway down the pitch. Beehive y: 0 = ground, 1 = head height.
 */
export type LengthBand = "Yorker" | "Full" | "Good" | "Short";
export type LineBand = "Wide outside off" | "Outside off" | "Stumps" | "Leg side";

export const lengthBands: readonly LengthBand[] = ["Yorker", "Full", "Good", "Short"];
export const lineBands: readonly LineBand[] = [
  "Wide outside off",
  "Outside off",
  "Stumps",
  "Leg side",
];

/** Half a pitch is about 10 m: yorker under 2 m from the stumps, full 2–6 m, good 6–8 m, short beyond. */
export function lengthBand(point: BallPoint): LengthBand {
  if (point.y < 0.2) return "Yorker";
  if (point.y < 0.6) return "Full";
  if (point.y < 0.8) return "Good";
  return "Short";
}

/** Line relative to the batter, so left-handers' off side is the other way. */
export function lineBand(point: BallPoint, leftHanded = false): LineBand {
  const offSide = leftHanded ? 1 - point.x : point.x;
  if (offSide < 0.3) return "Wide outside off";
  if (offSide < 0.44) return "Outside off";
  if (offSide <= 0.56) return "Stumps";
  return "Leg side";
}

export const clampPoint = (x: number, y: number): BallPoint => ({
  x: Math.round(Math.min(1, Math.max(0, x)) * 1000) / 1000,
  y: Math.round(Math.min(1, Math.max(0, y)) * 1000) / 1000,
});

export interface BandRow {
  band: string;
  balls: number;
  runs: number;
  wickets: number;
  dots: number;
}

const blank = (band: string): BandRow => ({ band, balls: 0, runs: 0, wickets: 0, dots: 0 });

/** Runs, wickets and dots by length (and by line) for balls with a pitch point. */
export function pitchBreakdown(
  deliveries: readonly Delivery[],
  leftHanded: (batterId: string) => boolean = () => false,
) {
  const byLength = new Map(lengthBands.map((band) => [band, blank(band)]));
  const byLine = new Map(lineBands.map((band) => [band, blank(band)]));
  let tracked = 0;
  for (const delivery of deliveries) {
    if (!delivery.pitch) continue;
    tracked += 1;
    const rows = [
      byLength.get(lengthBand(delivery.pitch))!,
      byLine.get(lineBand(delivery.pitch, leftHanded(delivery.strikerId)))!,
    ];
    for (const row of rows) {
      row.balls += 1;
      row.runs += delivery.batterRuns;
      if (delivery.dismissal) row.wickets += 1;
      if (delivery.batterRuns === 0 && !delivery.dismissal) row.dots += 1;
    }
  }
  return { tracked, byLength: [...byLength.values()], byLine: [...byLine.values()] };
}

export type BallTone = "wicket" | "boundary" | "runs" | "dot";
export const ballTone = (delivery: Delivery): BallTone =>
  delivery.dismissal
    ? "wicket"
    : delivery.batterRuns >= 4
      ? "boundary"
      : delivery.batterRuns > 0
        ? "runs"
        : "dot";
