/**
 * Rain-affected chase maths for one-innings, limited-overs matches.
 * - "arr": average run rate — the chasing side's target scales with the overs it gets.
 * - "mpo": most productive overs — the target is the runs from the first side's best N overs.
 * - "dls": the official Duckworth-Lewis-Stern target, entered from the official calculator / umpires
 *   (DLS needs a licence, so CricLume never invents DLS numbers).
 * - "manual": any other target set by the umpires or league.
 * Pure functions with primitive inputs so they stay easy to test.
 */
export type RainMethod = "arr" | "mpo" | "dls" | "manual";

export interface RainState {
  method: RainMethod;
  /** Overs available to the chasing side after the interruption. */
  revisedOvers?: number | null | undefined;
  /** DLS / manual: the official revised target (runs to win). */
  officialTarget?: number | null | undefined;
  /** DLS / manual: the official par score when play was abandoned. */
  officialPar?: number | null | undefined;
  /** No more play is possible; decide the match on the par score. */
  abandoned?: boolean | undefined;
  /** Overs the chasing side must face for a result (otherwise no result). */
  minOversForResult?: number | null | undefined;
}

export const rainMethods: ReadonlyArray<{ id: RainMethod; label: string; short: string; hint: string }> = [
  { id: "arr", label: "Average run rate", short: "ARR", hint: "Target scales with the overs the chasing side gets." },
  { id: "mpo", label: "Most productive overs", short: "MPO", hint: "Target is the runs from the first side's best overs." },
  { id: "dls", label: "DLS (official)", short: "DLS", hint: "Enter the target and par from the official DLS calculator." },
  { id: "manual", label: "Umpires' target", short: "Revised", hint: "Enter the target set by the umpires or league." },
];

export const rainMethodShort = (method: RainMethod) =>
  rainMethods.find((item) => item.id === method)?.short ?? "Revised";

/** Methods CricLume calculates itself. DLS and manual targets are entered. */
export const isCalculatedMethod = (method: RainMethod) => method === "arr" || method === "mpo";

/** Usual minimum overs for a result: 2 in T10-length games, 5 up to 20 overs, 20 in longer games. */
export function defaultMinOversForResult(oversPerInnings: number): number {
  if (oversPerInnings <= 10) return Math.min(2, oversPerInnings);
  if (oversPerInnings <= 20) return 5;
  return 20;
}

/** ARR revised target: floor(first runs × revised overs ÷ first-innings overs) + 1. */
export function arrTarget(firstRuns: number, firstOvers: number, revisedOvers: number): number {
  if (firstOvers <= 0) return firstRuns + 1;
  return Math.floor((firstRuns * revisedOvers) / firstOvers) + 1;
}

/** ARR par: the score that would tie if no more play were possible after `ballsFaced`. */
export function arrPar(firstRuns: number, firstOvers: number, ballsFaced: number, ballsPerOver: number): number {
  if (firstOvers <= 0) return firstRuns;
  return Math.floor((firstRuns * (ballsFaced / ballsPerOver)) / firstOvers);
}

const bestOvers = (overRuns: readonly number[]) => [...overRuns].sort((a, b) => b - a);

/** MPO revised target: the first side's best `revisedOvers` overs, plus one. */
export function mpoTarget(overRuns: readonly number[], revisedOvers: number): number {
  const best = bestOvers(overRuns);
  return best.slice(0, Math.max(0, Math.floor(revisedOvers))).reduce((sum, runs) => sum + runs, 0) + 1;
}

/** MPO par after `ballsFaced`: best whole overs plus the matching share of the next best over. */
export function mpoPar(overRuns: readonly number[], ballsFaced: number, ballsPerOver: number): number {
  const best = bestOvers(overRuns);
  const whole = Math.floor(ballsFaced / ballsPerOver);
  const part = (ballsFaced % ballsPerOver) / ballsPerOver;
  const base = best.slice(0, whole).reduce((sum, runs) => sum + runs, 0);
  return Math.floor(base + part * (best[whole] ?? 0));
}

export interface ChaseInputs {
  firstRuns: number;
  /** Overs used for the first side's rate: the full allocation when bowled out or overs used up. */
  firstOvers: number;
  /** Runs conceded in each over of the first innings. */
  firstOverRuns: readonly number[];
  ballsPerOver: number;
}

/** The revised target for a rain state, or null when the normal target applies. */
export function revisedTarget(rain: RainState | undefined, inputs: ChaseInputs): number | null {
  if (!rain) return null;
  if (!isCalculatedMethod(rain.method)) return rain.officialTarget ?? null;
  if (rain.revisedOvers == null) return null;
  return rain.method === "arr"
    ? arrTarget(inputs.firstRuns, inputs.firstOvers, rain.revisedOvers)
    : mpoTarget(inputs.firstOverRuns, rain.revisedOvers);
}

/** Live par score during the chase, or null when the method has no CricLume-calculated par. */
export function parScore(rain: RainState | undefined, inputs: ChaseInputs, ballsFaced: number): number | null {
  if (!rain) return null;
  if (!isCalculatedMethod(rain.method)) return rain.officialPar ?? null;
  return rain.method === "arr"
    ? arrPar(inputs.firstRuns, inputs.firstOvers, ballsFaced, inputs.ballsPerOver)
    : mpoPar(inputs.firstOverRuns, ballsFaced, inputs.ballsPerOver);
}

export type AbandonedOutcome =
  | { kind: "no-result" }
  | { kind: "tie"; par: number }
  | { kind: "chasing-won"; par: number }
  | { kind: "defending-won"; par: number; margin: number }
  | { kind: "needs-par" };

/** Decides an abandoned chase on the par score. */
export function abandonedOutcome(
  rain: RainState,
  inputs: ChaseInputs,
  chase: { runs: number; ballsFaced: number },
  minOvers: number,
): AbandonedOutcome {
  if (chase.ballsFaced < minOvers * inputs.ballsPerOver) return { kind: "no-result" };
  const par = parScore(rain, inputs, chase.ballsFaced);
  if (par === null) return { kind: "needs-par" };
  if (chase.runs > par) return { kind: "chasing-won", par };
  if (chase.runs === par) return { kind: "tie", par };
  return { kind: "defending-won", par, margin: par - chase.runs };
}
