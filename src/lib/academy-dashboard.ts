import type { PlatformDashboardData } from "./platform-cloud";

export type AcademyCohort = {
  teamId: string;
  name: string;
  ageGroup: string;
  registered: number;
  juniors: number;
  coachingConsentsToReview: number;
  upcomingFixtures: number;
};

type AcademyData = Pick<
  PlatformDashboardData,
  "teams" | "players" | "members" | "fixtures" | "matches"
>;

function upcoming(iso: string | null, now: number): boolean {
  if (!iso) return false;
  const value = Date.parse(iso);
  return Number.isFinite(value) && value >= now;
}

/**
 * Only existing club/team/fixture data is used. Session attendance, guardian
 * permissions and coaching hours are not inferred from cricket matches.
 */
export function academyOverview(data: AcademyData, asOf: Date = new Date()) {
  const playerById = new Map(data.players.map((player) => [player.id, player]));
  const now = asOf.valueOf();
  const cohorts: AcademyCohort[] = data.teams.map((team) => {
    const registered = [...new Set(team.playerIds)]
      .map((id) => playerById.get(id))
      .filter((player) => player !== undefined);
    const juniorPlayers = registered.filter((player) => player.isJunior);
    return {
      teamId: team.id,
      name: team.name,
      ageGroup: team.ageGroup?.trim() || "Unspecified",
      registered: registered.length,
      juniors: juniorPlayers.length,
      coachingConsentsToReview: juniorPlayers.filter(
        (player) => player.consent?.coachingAnalysis !== "granted",
      ).length,
      upcomingFixtures: data.fixtures.filter(
        (fixture) =>
          (fixture.homeTeamId === team.id || fixture.awayTeamId === team.id) &&
          !["cancelled", "canceled", "abandoned", "completed"].includes(
            fixture.status.toLowerCase(),
          ) &&
          upcoming(fixture.startsAt, now),
      ).length,
    };
  });
  cohorts.sort((a, b) => a.ageGroup.localeCompare(b.ageGroup) || a.name.localeCompare(b.name));
  const assigned = new Set(data.teams.flatMap((team) => team.playerIds));
  return {
    cohorts,
    teams: data.teams.length,
    registeredPlayers: data.players.length,
    juniorPlayers: data.players.filter((player) => player.isJunior).length,
    activeCoaches: data.members.filter(
      (member) => member.role === "coach" && member.status === "active",
    ).length,
    unassignedPlayers: data.players.filter((player) => !assigned.has(player.id)).length,
    coachingConsentsToReview: data.players.filter(
      (player) => player.isJunior && player.consent?.coachingAnalysis !== "granted",
    ).length,
    recordedMatches: data.matches.length,
  };
}

/** Aggregate team-only export; no player names, guardian details or medical data. */
export function academyCohortsCsv(cohorts: readonly AcademyCohort[]): string {
  const cell = (value: string | number) => {
    const raw = String(value);
    const protectedValue = /^[\t\r\n ]*[=+@-]/.test(raw) ? `'${raw}` : raw;
    return `"${protectedValue.replaceAll('"', '""')}"`;
  };
  return [
    [
      "Team",
      "Age group",
      "Registered",
      "Juniors",
      "Coaching consents to review",
      "Upcoming fixtures",
    ],
    ...cohorts.map((cohort) => [
      cohort.name,
      cohort.ageGroup,
      cohort.registered,
      cohort.juniors,
      cohort.coachingConsentsToReview,
      cohort.upcomingFixtures,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
