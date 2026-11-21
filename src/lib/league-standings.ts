import { calculateCompetitionTable, type CompletedFixture, type TableRow } from "./platform.ts";
import type { CompetitionRecord, FixtureRecord, TeamRecord } from "./platform-cloud";

type LeagueInput = {
  competition: Pick<CompetitionRecord, "id" | "rules" | "ruleVersionId">;
  fixtures: readonly FixtureRecord[];
  teams: readonly Pick<TeamRecord, "id" | "name">[];
};

export type LeagueStandingsPreview = {
  rows: TableRow[];
  counted: number;
  awaitingReview: number;
  scheduled: number;
  participants: number;
  blockedReason: string | null;
};

const recordedStatuses = new Set(["completed", "abandoned"]);

function signedOff(fixture: FixtureRecord): boolean {
  return (
    typeof fixture.signedOffAt === "string" &&
    Number.isFinite(Date.parse(fixture.signedOffAt)) &&
    typeof fixture.signedOffBy === "string" &&
    fixture.signedOffBy.length > 0
  );
}

function numberField(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function bonusField(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  if (value === undefined) return 0;
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100 &&
    Number.isInteger(value * 100)
    ? value
    : null;
}

/** Reject ambiguous and incomplete outcomes rather than awarding fictional league points. */
function validatedResult(fixture: FixtureRecord): CompletedFixture | null {
  const result = fixture.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const camelWinner = result["winnerTeamId"];
  const snakeWinner = result["winner_team_id"];
  if (
    camelWinner !== undefined &&
    snakeWinner !== undefined &&
    camelWinner !== snakeWinner
  ) {
    return null;
  }
  const winner = camelWinner ?? snakeWinner;
  const tied = result["tied"] === true;
  const noResult = result["noResult"] === true || result["no_result"] === true;
  const hasWinner = typeof winner === "string" && winner.length > 0;
  if (winner != null && !hasWinner) return null;
  if (hasWinner && winner !== fixture.homeTeamId && winner !== fixture.awayTeamId) return null;
  if (Number(hasWinner) + Number(tied) + Number(noResult) !== 1) return null;
  if (fixture.status.toLowerCase() === "abandoned" && !noResult) return null;
  const homeBonusPoints = bonusField(result, "homeBonusPoints");
  const awayBonusPoints = bonusField(result, "awayBonusPoints");
  if (homeBonusPoints === null || awayBonusPoints === null) return null;
  if (noResult) {
    // A no-result decision has no validated NRR innings. Never invent score data.
    if (homeBonusPoints !== 0 || awayBonusPoints !== 0) return null;
    return {
      id: fixture.id,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      status: fixture.status.toLowerCase() as CompletedFixture["status"],
      noResult: true,
    };
  }
  const homeRuns = numberField(result, "homeRuns");
  const awayRuns = numberField(result, "awayRuns");
  const homeLegalBalls = numberField(result, "homeLegalBalls");
  const awayLegalBalls = numberField(result, "awayLegalBalls");
  if (
    homeRuns === null ||
    awayRuns === null ||
    homeLegalBalls === null ||
    awayLegalBalls === null ||
    homeLegalBalls === 0 ||
    awayLegalBalls === 0
  ) {
    return null;
  }
  return {
    id: fixture.id,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    status: "completed",
    ...(hasWinner ? { winnerTeamId: winner as string } : {}),
    ...(tied ? { tied: true } : {}),
    homeRuns,
    awayRuns,
    homeLegalBalls,
    awayLegalBalls,
    homeBonusPoints,
    awayBonusPoints,
  };
}

function validRules(rules: CompetitionRecord["rules"]): rules is NonNullable<
  CompetitionRecord["rules"]
> {
  if (!rules || !Number.isInteger(rules.ballsPerOver) || rules.ballsPerOver < 1) return false;
  if (
    rules.ballsPerOver > 12 ||
    !Array.isArray(rules.tieBreakers) ||
    rules.tieBreakers.length === 0
  ) {
    return false;
  }
  if (!rules.points || !["win", "tie", "noResult", "loss"].every((key) => {
    const value = rules.points[key as keyof typeof rules.points];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
  })) {
    return false;
  }
  return rules.tieBreakers.every((value) =>
    ["points", "wins", "net-run-rate", "head-to-head"].includes(value),
  );
}

/**
 * A conservative, read-only preview. Uses only signed-off fixtures with
 * complete explicit result facts and the matching versioned competition rules.
 *
 * This is not a results sign-off or publishing mechanism. A signed-off result
 * remains authoritative in the source database, never in this browser helper.
 */
export function buildLeagueStandings(input: LeagueInput): LeagueStandingsPreview {
  const { competition, fixtures, teams } = input;
  const visible = fixtures.filter((fixture) => fixture.competitionId === competition.id);
  const knownTeams = new Set(teams.map((team) => team.id));
  const participantIds = [
    ...new Set(visible.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId])),
  ].filter((id) => knownTeams.has(id));
  const unique = [...new Map(visible.map((fixture) => [fixture.id, fixture])).values()];
  const recorded = unique.filter((fixture) =>
    recordedStatuses.has(fixture.status.toLowerCase()),
  );
  const base = {
    rows: [] as TableRow[],
    counted: 0,
    awaitingReview: recorded.length,
    scheduled: unique.length - recorded.length,
    participants: participantIds.length,
  };
  if (!validRules(competition.rules) || !competition.ruleVersionId) {
    return { ...base, blockedReason: "An active, valid competition rule version is required." };
  }
  if (competition.rules.tieBreakers.includes("head-to-head")) {
    return {
      ...base,
      blockedReason: "Head-to-head tie-breaking needs an approved competition calculation.",
    };
  }
  const accepted: CompletedFixture[] = [];
  for (const fixture of recorded) {
    if (
      !signedOff(fixture) ||
      fixture.ruleVersionId !== competition.ruleVersionId ||
      fixture.homeTeamId === fixture.awayTeamId ||
      !knownTeams.has(fixture.homeTeamId) ||
      !knownTeams.has(fixture.awayTeamId)
    ) {
      continue;
    }
    const result = validatedResult(fixture);
    if (result) accepted.push(result);
  }
  return {
    ...base,
    rows: accepted.length
      ? calculateCompetitionTable(participantIds, accepted, competition.rules)
      : [],
    counted: accepted.length,
    awaitingReview: recorded.length - accepted.length,
    blockedReason: null,
  };
}

/** Export team-level standings only. Player identities are not included. */
export function leagueStandingsCsv(
  rows: readonly TableRow[],
  teamNames: ReadonlyMap<string, string>,
): string {
  const cell = (value: string | number) => {
    const raw = String(value);
    const protectedValue = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
    return `"${protectedValue.replaceAll('"', '""')}"`;
  };
  return [
    ["Position", "Team", "Played", "Won", "Tied", "Lost", "No result", "Points", "NRR"],
    ...rows.map((row, index) => [
      index + 1,
      teamNames.get(row.teamId) ?? "Unknown team",
      row.played,
      row.won,
      row.tied,
      row.lost,
      row.noResult,
      row.points,
      row.netRunRate,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
