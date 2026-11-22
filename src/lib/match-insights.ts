import { isBowlerWicket, type DismissalType, type FieldZone } from "./cricket.ts";

/** One recorded ball, reduced to what the club dashboard charts need. */
export interface InsightBall {
  over: number;
  legal: boolean;
  batterRuns: number;
  wide: number;
  noBall: number;
  bye: number;
  legBye: number;
  strikerId: string;
  bowlerId: string;
  fieldZone: FieldZone;
  dismissalType: DismissalType | null;
}

export interface OverPoint {
  over: number;
  runs: number;
  wickets: number;
  totalRuns: number;
  runRate: number;
}

export const ballTotal = (ball: InsightBall) =>
  ball.batterRuns + ball.wide + ball.noBall + ball.bye + ball.legBye;

/** Runs, wickets and running run rate for each over that has at least one ball. */
export function overProgression(balls: InsightBall[], ballsPerOver = 6): OverPoint[] {
  const byOver = new Map<number, { runs: number; wickets: number; legal: number }>();
  for (const ball of balls) {
    const entry = byOver.get(ball.over) ?? { runs: 0, wickets: 0, legal: 0 };
    entry.runs += ballTotal(ball);
    if (ball.dismissalType) entry.wickets += 1;
    if (ball.legal) entry.legal += 1;
    byOver.set(ball.over, entry);
  }
  let totalRuns = 0;
  let totalLegal = 0;
  return [...byOver.entries()]
    .sort(([a], [b]) => a - b)
    .map(([over, entry]) => {
      totalRuns += entry.runs;
      totalLegal += entry.legal;
      const oversBowled = totalLegal / ballsPerOver;
      return {
        over: over + 1,
        runs: entry.runs,
        wickets: entry.wickets,
        totalRuns,
        runRate: oversBowled > 0 ? Math.round((totalRuns / oversBowled) * 100) / 100 : 0,
      };
    });
}

/** Wagon wheel segments, clockwise from just right of the keeper (right-handed batter view). */
export const wheelZones = [
  "Fine leg",
  "Square leg",
  "Mid-wicket",
  "Long on",
  "Straight",
  "Long off",
  "Cover",
  "Point",
  "Third",
] as const satisfies readonly FieldZone[];

export type WheelZone = (typeof wheelZones)[number];

export interface WagonWheel {
  zones: { zone: WheelZone; runs: number; share: number }[];
  placedRuns: number;
  unplacedRuns: number;
}

/** Bat runs by field zone. Runs without a recorded outfield zone are counted as unplaced. */
export function wagonWheel(balls: InsightBall[]): WagonWheel {
  const totals = new Map<WheelZone, number>(wheelZones.map((zone) => [zone, 0]));
  let unplacedRuns = 0;
  for (const ball of balls) {
    if (ball.batterRuns <= 0) continue;
    const zone = ball.fieldZone as WheelZone;
    if (totals.has(zone)) totals.set(zone, (totals.get(zone) ?? 0) + ball.batterRuns);
    else unplacedRuns += ball.batterRuns;
  }
  const placedRuns = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return {
    zones: wheelZones.map((zone) => {
      const runs = totals.get(zone) ?? 0;
      return { zone, runs, share: placedRuns > 0 ? Math.round((runs / placedRuns) * 100) : 0 };
    }),
    placedRuns,
    unplacedRuns,
  };
}

export interface BatterLine {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
}

/** Highest run scorers; ties go to the batter who faced fewer balls. Wides are not balls faced. */
export function topBatters(balls: InsightBall[], limit = 3): BatterLine[] {
  const lines = new Map<string, BatterLine>();
  for (const ball of balls) {
    const line = lines.get(ball.strikerId) ?? {
      playerId: ball.strikerId,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
    };
    line.runs += ball.batterRuns;
    if (ball.wide === 0) line.balls += 1;
    if (ball.batterRuns === 4) line.fours += 1;
    if (ball.batterRuns === 6) line.sixes += 1;
    if (ball.dismissalType) line.out = true;
    lines.set(ball.strikerId, line);
  }
  return [...lines.values()]
    .sort((a, b) => b.runs - a.runs || a.balls - b.balls)
    .slice(0, limit);
}

export interface BowlerLine {
  playerId: string;
  wickets: number;
  runs: number;
  legalBalls: number;
  overs: string;
}

/** Best bowlers by wickets, then fewest runs conceded. Byes and leg byes are not charged. */
export function topBowlers(balls: InsightBall[], ballsPerOver = 6, limit = 3): BowlerLine[] {
  const lines = new Map<string, BowlerLine>();
  for (const ball of balls) {
    const line = lines.get(ball.bowlerId) ?? {
      playerId: ball.bowlerId,
      wickets: 0,
      runs: 0,
      legalBalls: 0,
      overs: "0.0",
    };
    line.runs += ball.batterRuns + ball.wide + ball.noBall;
    if (ball.legal) line.legalBalls += 1;
    if (ball.dismissalType && isBowlerWicket(ball.dismissalType)) line.wickets += 1;
    lines.set(ball.bowlerId, line);
  }
  return [...lines.values()]
    .map((line) => ({
      ...line,
      overs: `${Math.floor(line.legalBalls / ballsPerOver)}.${line.legalBalls % ballsPerOver}`,
    }))
    .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
    .slice(0, limit);
}
