/** Result confirmation: both teams report, the league signs off. Pure rules so they can be tested. */

export interface FixtureResult {
  winnerTeamId?: string;
  /** The loser conceded (forfeit / walkover): winner gets the win points, no runs count for net run rate. */
  walkover?: boolean;
  tied?: boolean;
  noResult?: boolean;
  homeRuns?: number;
  awayRuns?: number;
  homeLegalBalls?: number;
  awayLegalBalls?: number;
  homeBonusPoints?: number;
  awayBonusPoints?: number;
}
export interface ResultReport {
  teamId: string;
  result: FixtureResult;
  note: string;
  submittedAt: string;
}
export interface InboxFixture {
  fixtureId: string;
  competitionId: string;
  competition: string;
  round: string | null;
  startsAt: string | null;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  home: string;
  away: string;
  signedOffAt: string | null;
  officialResult: FixtureResult | null;
  isLeagueAdmin: boolean;
  myTeamIds: string[];
  reports: ResultReport[];
  suggested: {
    matchId: string;
    homeRuns: number | null;
    homeLegalBalls: number | null;
    awayRuns: number | null;
    awayLegalBalls: number | null;
    status: string;
    resultText: string | null;
  } | null;
}

export type DeskState =
  "signed-off" | "ready" | "disputed" | "awaiting-one" | "awaiting-both" | "overdue" | "upcoming";

/** A result is due this long after the start; after that an unreported fixture is overdue. */
export const resultDueHours = 48;

const outcomeKeys = [
  "winnerTeamId",
  "walkover",
  "tied",
  "noResult",
  "homeRuns",
  "awayRuns",
  "homeLegalBalls",
  "awayLegalBalls",
  "homeBonusPoints",
  "awayBonusPoints",
] as const;

/** Same shape the database cleans results into, so two reports can be compared field by field. */
export function canonicalResult(result: FixtureResult): FixtureResult {
  const out: FixtureResult = {};
  if (result.winnerTeamId) out.winnerTeamId = result.winnerTeamId;
  if (result.walkover && result.winnerTeamId) out.walkover = true;
  if (result.tied) out.tied = true;
  if (result.noResult) out.noResult = true;
  for (const key of [
    "homeRuns",
    "awayRuns",
    "homeLegalBalls",
    "awayLegalBalls",
    "homeBonusPoints",
    "awayBonusPoints",
  ] as const) {
    const value = result[key];
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

export function resultsAgree(a: FixtureResult, b: FixtureResult): boolean {
  const x = canonicalResult(a);
  const y = canonicalResult(b);
  return outcomeKeys.every((key) => (x[key] ?? null) === (y[key] ?? null));
}

/** Checks a result the way the database does. Returns a plain-language problem, or null when it's fine. */
export function resultProblem(
  result: FixtureResult,
  homeTeamId: string,
  awayTeamId: string,
): string | null {
  const outcomes =
    Number(Boolean(result.winnerTeamId)) +
    Number(Boolean(result.tied)) +
    Number(Boolean(result.noResult));
  if (outcomes !== 1) return "Pick a winner, a tie or no result.";
  if (
    result.winnerTeamId &&
    result.winnerTeamId !== homeTeamId &&
    result.winnerTeamId !== awayTeamId
  )
    return "The winner must be one of the two teams.";
  for (const key of ["homeBonusPoints", "awayBonusPoints"] as const) {
    const value = result[key];
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100))
      return "Bonus points must be between 0 and 100.";
  }
  if (result.noResult) return null;
  if (result.walkover)
    return result.winnerTeamId ? null : "A walkover needs the team that was awarded the match.";
  for (const key of ["homeRuns", "awayRuns", "homeLegalBalls", "awayLegalBalls"] as const) {
    const value = result[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
      return "Enter whole numbers for runs and balls for both sides.";
  }
  if (!result.homeLegalBalls || !result.awayLegalBalls)
    return "Each side must have faced at least one ball.";
  if (result.winnerTeamId && !result.tied) {
    const homeWon = result.winnerTeamId === homeTeamId;
    const winnerRuns = homeWon ? result.homeRuns! : result.awayRuns!;
    const loserRuns = homeWon ? result.awayRuns! : result.homeRuns!;
    if (winnerRuns < loserRuns)
      return "The winning side scored fewer runs — check the scores or the winner.";
  }
  if (result.tied && result.homeRuns !== result.awayRuns)
    return "A tie needs both sides on the same score.";
  return null;
}

export function deskState(fixture: InboxFixture, nowMs: number): DeskState {
  if (fixture.signedOffAt) return "signed-off";
  const [first, second] = fixture.reports;
  if (first && second) return resultsAgree(first.result, second.result) ? "ready" : "disputed";
  const started = fixture.startsAt ? Date.parse(fixture.startsAt) : NaN;
  if (Number.isFinite(started) && started > nowMs) return "upcoming";
  if (first) return "awaiting-one";
  if (Number.isFinite(started) && nowMs - started > resultDueHours * 3_600_000) return "overdue";
  return "awaiting-both";
}

export const deskStateLabels: Record<DeskState, string> = {
  "signed-off": "Signed off",
  ready: "Both teams agree",
  disputed: "Teams disagree",
  "awaiting-one": "Waiting for the other team",
  "awaiting-both": "Waiting for results",
  overdue: "Overdue",
  upcoming: "Not started",
};

/** Ordered for the "needs action" list: problems first, then ready to sign off, then waiting. */
export const deskPriority: Record<DeskState, number> = {
  disputed: 0,
  overdue: 1,
  ready: 2,
  "awaiting-one": 3,
  "awaiting-both": 4,
  upcoming: 5,
  "signed-off": 6,
};

export function sortForAction(fixtures: InboxFixture[], nowMs: number): InboxFixture[] {
  return [...fixtures].sort(
    (a, b) =>
      deskPriority[deskState(a, nowMs)] - deskPriority[deskState(b, nowMs)] ||
      (Date.parse(b.startsAt ?? "") || 0) - (Date.parse(a.startsAt ?? "") || 0),
  );
}

/** Result from the scored match: higher total wins; equal totals tie. */
export function suggestedResult(fixture: InboxFixture): FixtureResult | null {
  const s = fixture.suggested;
  if (!s || s.status !== "completed") return null;
  if (s.homeRuns == null || s.awayRuns == null || !s.homeLegalBalls || !s.awayLegalBalls)
    return null;
  const base = {
    homeRuns: s.homeRuns,
    awayRuns: s.awayRuns,
    homeLegalBalls: s.homeLegalBalls,
    awayLegalBalls: s.awayLegalBalls,
  };
  if (s.homeRuns === s.awayRuns) return { ...base, tied: true };
  return {
    ...base,
    winnerTeamId: s.homeRuns > s.awayRuns ? fixture.homeTeamId : fixture.awayTeamId,
  };
}

function overs(balls: number | undefined, ballsPerOver = 6): string {
  if (!balls) return "0";
  return `${Math.floor(balls / ballsPerOver)}${balls % ballsPerOver ? `.${balls % ballsPerOver}` : ""}`;
}

export function describeResult(
  result: FixtureResult | null | undefined,
  names: { home: string; away: string; homeTeamId: string },
): string {
  if (!result) return "No result yet";
  if (result.noResult) return "No result";
  if (result.walkover)
    return `${result.winnerTeamId === names.homeTeamId ? names.home : names.away} won (walkover — the other team conceded)`;
  const score = `${names.home} ${result.homeRuns ?? "?"} (${overs(result.homeLegalBalls)} ov) · ${names.away} ${result.awayRuns ?? "?"} (${overs(result.awayLegalBalls)} ov)`;
  if (result.tied) return `Tied · ${score}`;
  const winner = result.winnerTeamId === names.homeTeamId ? names.home : names.away;
  return `${winner} won · ${score}`;
}
