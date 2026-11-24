/**
 * "What do we need to qualify?" — pure league maths.
 * Scenarios use win/loss only for remaining fixtures (ties and washouts are rare and would only add points);
 * level-on-points finishes are reported as "depends on net run rate" rather than guessed.
 */
export interface QualTableRow {
  teamId: string;
  points: number;
  runsFor: number;
  ballsFaced: number;
  runsAgainst: number;
  ballsBowled: number;
}

export interface RemainingFixture {
  homeTeamId: string;
  awayTeamId: string;
}

export type QualStatus = "through" | "out" | "in-hand" | "needs-help";

export interface QualificationReport {
  teamId: string;
  status: QualStatus;
  maxPoints: number;
  remaining: number;
  /** Of every win/loss combination of the remaining fixtures: */
  scenarios: number;
  qualifies: number;
  /** Level on points with the team at the cut-off — net run rate decides. */
  onNrr: number;
  /** Win every remaining game: "through", "nrr" (level on points, run rate decides) or "help" (needs other results). */
  ifWinAll: "through" | "nrr" | "help" | "no-games";
  /** Fewest of its own remaining games that can still be enough (null if none can be). */
  winsNeeded: number | null;
  /** True when scenarios were sampled because there are too many remaining fixtures to try them all. */
  estimated: boolean;
}

const MAX_EXACT = 14;
const SAMPLES = 16_384;

/** Where `teamId` finishes: "in" (clear inside the top spots), "nrr" (level on points at the cut-off) or "out". */
function placing(points: Map<string, number>, teamId: string, spots: number): "in" | "nrr" | "out" {
  const mine = points.get(teamId) ?? 0;
  let above = 0;
  let level = 0;
  for (const [id, value] of points) {
    if (id === teamId) continue;
    if (value > mine) above += 1;
    else if (value === mine) level += 1;
  }
  if (above >= spots) return "out";
  if (above + level < spots) return "in";
  return "nrr";
}

/** Deterministic pseudo-random bits so sampled answers do not jump around between renders. */
function sampler(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function qualificationReport(input: {
  rows: readonly QualTableRow[];
  remaining: readonly RemainingFixture[];
  teamId: string;
  spots: number;
  winPoints: number;
  lossPoints?: number;
}): QualificationReport {
  const { rows, remaining, teamId, spots, winPoints } = input;
  const lossPoints = input.lossPoints ?? 0;
  const own = remaining.filter(
    (fixture) => fixture.homeTeamId === teamId || fixture.awayTeamId === teamId,
  );
  const current = rows.find((row) => row.teamId === teamId)?.points ?? 0;
  const maxPoints = current + own.length * winPoints;
  const estimated = remaining.length > MAX_EXACT;
  const total = estimated ? SAMPLES : 2 ** remaining.length;
  const random = sampler(remaining.length * 7919 + rows.length);

  let qualifies = 0;
  let onNrr = 0;
  // Per number of own wins: [scenarios, qualify-or-nrr].
  const byWins = new Map<number, { all: number; ok: number; clear: number }>();
  for (let index = 0; index < total; index += 1) {
    const points = new Map(rows.map((row) => [row.teamId, row.points]));
    let ownWins = 0;
    remaining.forEach((fixture, position) => {
      const homeWins = estimated ? random() < 0.5 : ((index >> position) & 1) === 1;
      const winner = homeWins ? fixture.homeTeamId : fixture.awayTeamId;
      const loser = homeWins ? fixture.awayTeamId : fixture.homeTeamId;
      points.set(winner, (points.get(winner) ?? 0) + winPoints);
      points.set(loser, (points.get(loser) ?? 0) + lossPoints);
      if (winner === teamId) ownWins += 1;
    });
    const place = placing(points, teamId, spots);
    if (place === "in") qualifies += 1;
    if (place === "nrr") onNrr += 1;
    const bucket = byWins.get(ownWins) ?? { all: 0, ok: 0, clear: 0 };
    bucket.all += 1;
    if (place !== "out") bucket.ok += 1;
    if (place === "in") bucket.clear += 1;
    byWins.set(ownWins, bucket);
  }

  let winsNeeded: number | null = null;
  for (let wins = 0; wins <= own.length; wins += 1) {
    if ((byWins.get(wins)?.ok ?? 0) > 0) {
      winsNeeded = wins;
      break;
    }
  }
  const allWins = byWins.get(own.length);
  const ifWinAll: QualificationReport["ifWinAll"] =
    own.length === 0
      ? "no-games"
      : !allWins || allWins.ok === 0
        ? "help"
        : allWins.clear === allWins.all
          ? "through"
          : allWins.ok === allWins.all
            ? "nrr"
            : "help";
  const status: QualStatus =
    qualifies === total
      ? "through"
      : qualifies + onNrr === 0
        ? "out"
        : ifWinAll === "through"
          ? "in-hand"
          : "needs-help";
  return {
    teamId,
    status,
    maxPoints,
    remaining: own.length,
    scenarios: total,
    qualifies,
    onNrr,
    ifWinAll,
    winsNeeded,
    estimated,
  };
}

/** Net run rate in runs per over. */
export function netRunRate(
  row: Pick<QualTableRow, "runsFor" | "ballsFaced" | "runsAgainst" | "ballsBowled">,
  ballsPerOver = 6,
): number {
  const forRate = row.ballsFaced > 0 ? (row.runsFor * ballsPerOver) / row.ballsFaced : 0;
  const againstRate = row.ballsBowled > 0 ? (row.runsAgainst * ballsPerOver) / row.ballsBowled : 0;
  return forRate - againstRate;
}

/**
 * Batting first and scoring `score` in the full `overs`: the smallest winning margin (runs) that lifts the
 * team's net run rate above `targetNrr`. Null if even bowling the opponent out for 0 is not enough.
 */
export function marginToPassNrr(
  row: QualTableRow,
  targetNrr: number,
  score: number,
  overs: number,
  ballsPerOver = 6,
): number | null {
  const balls = overs * ballsPerOver;
  for (let margin = 1; margin <= score; margin += 1) {
    const next = {
      ...row,
      runsFor: row.runsFor + score,
      ballsFaced: row.ballsFaced + balls,
      runsAgainst: row.runsAgainst + score - margin,
      ballsBowled: row.ballsBowled + balls,
    };
    if (netRunRate(next, ballsPerOver) > targetNrr) return margin;
  }
  return null;
}

/**
 * Chasing `target` (opponent made target − 1 in the full `overs`): the latest ball by which the team must win
 * to lift its net run rate above `targetNrr`, as balls used. Null if no finish is quick enough.
 */
export function ballsToPassNrr(
  row: QualTableRow,
  targetNrr: number,
  target: number,
  overs: number,
  ballsPerOver = 6,
): number | null {
  const full = overs * ballsPerOver;
  for (let balls = full; balls >= 1; balls -= 1) {
    const next = {
      ...row,
      runsFor: row.runsFor + target,
      ballsFaced: row.ballsFaced + balls,
      runsAgainst: row.runsAgainst + target - 1,
      ballsBowled: row.ballsBowled + full,
    };
    if (netRunRate(next, ballsPerOver) > targetNrr) return balls;
  }
  return null;
}
