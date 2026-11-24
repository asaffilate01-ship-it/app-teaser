/**
 * CricLume win predictor: a transparent probability model for limited-overs matches.
 * It projects how many more runs the batting side should get from the balls and wickets left,
 * adjusted for match conditions, then turns the gap to the target (or to a par score) into a percentage.
 * It is an estimate for audiences, not an official result or rain-rule calculation.
 */

export type PitchCondition = "batting" | "balanced" | "bowling";
export type OutfieldCondition = "fast" | "average" | "slow";
export type WeatherCondition = "clear" | "overcast";

export interface MatchConditions {
  pitch: PitchCondition;
  outfield: OutfieldCondition;
  weather: WeatherCondition;
  /** Evening dew makes the ball hard to grip, which helps the side batting second. */
  dew: boolean;
  /** Which side looks stronger on paper: 0 even, positive favours the home side, negative the away side (-2..2). */
  edge: number;
}

export const defaultConditions: MatchConditions = {
  pitch: "balanced",
  outfield: "average",
  weather: "clear",
  dew: false,
  edge: 0,
};

export interface PredictorState {
  oversPerInnings: number | null;
  inningsPerSide: number;
  ballsPerOver: number;
  /** 1 = first innings, 2 = chase. */
  inningsNumber: number;
  runs: number;
  wickets: number;
  legalBalls: number;
  /** Runs needed to win, only for the chase. */
  target?: number | null;
  /** Wickets that end the innings (players − 1, at most 10). */
  maxWickets?: number;
  /** +1 when the batting side is the home team, −1 when away (for `edge`). */
  battingIsHome?: boolean;
  conditions?: MatchConditions | undefined;
}

export interface Prediction {
  /** Chance the batting side wins, 1–99 while the match is open, 0 or 100 once decided. */
  battingWin: number;
  bowlingWin: number;
  /** Projected innings total for the batting side. */
  projected: number;
  /** Par total for a full innings in these conditions. */
  par: number;
}

/** Club-level par runs per over by innings length; shorter games are scored faster. */
export function parRunRate(overs: number): number {
  const points: [number, number][] = [
    [5, 9],
    [10, 8.4],
    [20, 7.2],
    [30, 6.2],
    [40, 5.5],
    [50, 5.1],
  ];
  if (overs <= points[0]![0]) return points[0]![1];
  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1]!;
    const [x2, y2] = points[index]!;
    if (overs <= x2) return y1 + ((overs - x1) / (x2 - x1)) * (y2 - y1);
  }
  return points.at(-1)![1];
}

export function conditionsFactor(conditions: MatchConditions, inningsNumber: number): number {
  let factor = 1;
  factor *= conditions.pitch === "batting" ? 1.1 : conditions.pitch === "bowling" ? 0.88 : 1;
  factor *= conditions.outfield === "fast" ? 1.05 : conditions.outfield === "slow" ? 0.93 : 1;
  factor *= conditions.weather === "overcast" ? 0.95 : 1;
  if (conditions.dew && inningsNumber === 2) factor *= 1.05;
  return factor;
}

function strengthFactor(
  conditions: MatchConditions,
  battingIsHome: boolean | undefined,
  batting: boolean,
) {
  if (!conditions.edge || battingIsHome === undefined) return 1;
  const homeBatting = batting ? battingIsHome : !battingIsHome;
  const sign = homeBatting ? 1 : -1;
  return 1 + 0.04 * Math.max(-2, Math.min(2, conditions.edge)) * sign;
}

/**
 * Expected further runs from `balls` left with `wicketsInHand`. Runs come at a rate a little above par
 * early on but are capped by how many batters remain, so late wickets slow scoring down.
 */
export function expectedRuns(
  balls: number,
  wicketsInHand: number,
  maxWickets: number,
  rpoPar: number,
  ballsPerOver: number,
  fullBalls: number,
) {
  if (balls <= 0 || wicketsInHand <= 0) return 0;
  const parTotal = (rpoPar * fullBalls) / ballsPerOver;
  const capacityAll = 2 * parTotal;
  const startRate = (Math.LN2 * capacityAll) / fullBalls;
  const capacity = capacityAll * Math.pow(wicketsInHand / maxWickets, 1.3);
  return capacity * (1 - Math.exp((-startRate * balls) / capacity));
}

function spread(balls: number, expected: number) {
  return Math.sqrt(balls * 1.6) + 0.12 * expected + 2;
}

/** Standard normal cumulative distribution. */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

const clampOpen = (value: number) => Math.min(99, Math.max(1, Math.round(value)));

/** Win chances for a limited-overs, one-innings-per-side match. Returns null when the model does not apply. */
export function predictWin(state: PredictorState): Prediction | null {
  const overs = state.oversPerInnings;
  if (!overs || overs <= 0 || state.inningsPerSide !== 1) return null;
  if (state.inningsNumber !== 1 && state.inningsNumber !== 2) return null;
  const conditions = state.conditions ?? defaultConditions;
  const bpo = state.ballsPerOver > 0 ? state.ballsPerOver : 6;
  const fullBalls = overs * bpo;
  const maxWickets = Math.max(1, Math.min(10, state.maxWickets ?? 10));
  const rpo = parRunRate(overs);
  const ballsLeft = Math.max(0, fullBalls - state.legalBalls);
  const wicketsInHand = Math.max(0, maxWickets - state.wickets);

  const batFactor =
    conditionsFactor(conditions, state.inningsNumber) *
    strengthFactor(conditions, state.battingIsHome, true);
  const rest = expectedRuns(ballsLeft, wicketsInHand, maxWickets, rpo * batFactor, bpo, fullBalls);
  const projected = Math.round(state.runs + rest);
  const sdRest = spread(ballsLeft, rest);

  if (state.inningsNumber === 2) {
    const target = state.target ?? 0;
    const par = Math.round(
      expectedRuns(fullBalls, maxWickets, maxWickets, rpo * batFactor, bpo, fullBalls),
    );
    const needed = target - state.runs;
    if (needed <= 0) return { battingWin: 100, bowlingWin: 0, projected, par };
    if (ballsLeft === 0 || wicketsInHand === 0)
      return { battingWin: 0, bowlingWin: 100, projected, par };
    const chance = 100 * (1 - normalCdf((needed - 0.5 - rest) / sdRest));
    const battingWin = clampOpen(chance);
    return { battingWin, bowlingWin: 100 - battingWin, projected, par };
  }

  // First innings: compare the projected total with what the other side should chase down.
  const chaseFactor =
    conditionsFactor(conditions, 2) * strengthFactor(conditions, state.battingIsHome, false);
  const chasePar = expectedRuns(
    fullBalls,
    maxWickets,
    maxWickets,
    rpo * chaseFactor,
    bpo,
    fullBalls,
  );
  const sdChase = spread(fullBalls, chasePar);
  const sd = Math.sqrt(sdRest * sdRest + sdChase * sdChase);
  const battingWin = clampOpen(100 * normalCdf((state.runs + rest - chasePar) / sd));
  return { battingWin, bowlingWin: 100 - battingWin, projected, par: Math.round(chasePar) };
}
