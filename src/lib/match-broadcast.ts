import type { Delivery } from "./cricket";

/** Two-letter monogram for a team crest, e.g. "Kings XI" -> "KX". */
export function teamInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/**
 * Projected total at the current run rate. Only meaningful in a limited-overs
 * innings; returns null for unlimited formats or before the first legal ball.
 */
export function projectedScore(
  runs: number,
  legalBalls: number,
  oversPerInnings: number | null,
  ballsPerOver = 6,
): number | null {
  if (!oversPerInnings || legalBalls === 0) return null;
  const totalBalls = oversPerInnings * ballsPerOver;
  if (legalBalls >= totalBalls) return runs;
  return Math.round((runs / legalBalls) * totalBalls);
}

export interface ChaseState {
  runsNeeded: number;
  ballsLeft: number | null;
  requiredRate: number | null;
}

/** What the chasing side still needs. Null when there is no target. */
export function chaseState(
  target: number | null,
  runs: number,
  legalBalls: number,
  oversPerInnings: number | null,
  ballsPerOver = 6,
): ChaseState | null {
  if (target == null) return null;
  const runsNeeded = Math.max(0, target - runs);
  if (!oversPerInnings) return { runsNeeded, ballsLeft: null, requiredRate: null };
  const ballsLeft = Math.max(0, oversPerInnings * ballsPerOver - legalBalls);
  return {
    runsNeeded,
    ballsLeft,
    requiredRate: ballsLeft > 0 ? (runsNeeded * ballsPerOver) / ballsLeft : null,
  };
}

export type BallTone = "boundary" | "wicket" | "extra" | "dot" | "run";

/** Colour family for a delivery chip on the recent-balls trail. */
export function ballTone(
  delivery: Pick<Delivery, "dismissal" | "extras" | "batterRuns">,
): BallTone {
  if (delivery.dismissal) return "wicket";
  if (delivery.extras.wide || delivery.extras.noBall) return "extra";
  if (delivery.batterRuns === 4 || delivery.batterRuns === 6) return "boundary";
  if (delivery.batterRuns === 0 && !delivery.extras.bye && !delivery.extras.legBye) return "dot";
  return "run";
}

/** Short caption under a delivery chip. */
export function ballCaption(
  delivery: Pick<Delivery, "dismissal" | "extras" | "batterRuns">,
): string {
  if (delivery.dismissal) return "Wicket";
  if (delivery.extras.wide) return "Wide";
  if (delivery.extras.noBall) return "No ball";
  if (delivery.extras.bye) return "Bye";
  if (delivery.extras.legBye) return "Leg bye";
  const captions = ["Dot", "Single", "Two", "Three", "Four", "Five", "Six"];
  return captions[delivery.batterRuns] ?? `${delivery.batterRuns} runs`;
}
