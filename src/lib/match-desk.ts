import type { GroundRecord, MatchRecord, TeamRecord } from "./platform-cloud";

export const matchDeskFilters = ["all", "live", "scheduled", "draft", "archive"] as const;
export type MatchDeskFilter = (typeof matchDeskFilters)[number];

type DeskMatch = Pick<
  MatchRecord,
  "id" | "homeTeamId" | "awayTeamId" | "groundId" | "status" | "scheduledAt" | "updatedAt"
>;

export function matchDeskGroup(status: string): Exclude<MatchDeskFilter, "all"> {
  if (status === "live" || status === "innings_break") return "live";
  if (status === "scheduled") return "scheduled";
  if (status === "draft") return "draft";
  return "archive";
}

export function matchDeskCounts(matches: readonly DeskMatch[]) {
  const counts = { all: matches.length, live: 0, scheduled: 0, draft: 0, archive: 0 };
  for (const match of matches) counts[matchDeskGroup(match.status)] += 1;
  return counts;
}

function normalise(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function dateValue(value: string | null, fallback: number) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Search and sort only the current workspace's already-loaded match records. */
export function selectDeskMatches<T extends DeskMatch>(
  matches: readonly T[],
  teams: readonly Pick<TeamRecord, "id" | "name" | "shortName">[],
  grounds: readonly Pick<GroundRecord, "id" | "name">[],
  filter: MatchDeskFilter,
  query: string,
): T[] {
  const teamLabels = new Map(
    teams.map((team) => [team.id, normalise(`${team.name} ${team.shortName}`)]),
  );
  const groundLabels = new Map(grounds.map((ground) => [ground.id, normalise(ground.name)]));
  const words = normalise(query).split(/\s+/).filter(Boolean);
  const rank = { live: 0, scheduled: 1, draft: 2, archive: 3 };
  return matches
    .filter((match) => {
      if (filter !== "all" && matchDeskGroup(match.status) !== filter) return false;
      const haystack = [
        teamLabels.get(match.homeTeamId),
        teamLabels.get(match.awayTeamId),
        match.groundId ? groundLabels.get(match.groundId) : "",
      ].join(" ");
      return words.every((word) => haystack.includes(word));
    })
    .sort((a, b) => {
      const groupA = matchDeskGroup(a.status);
      const groupB = matchDeskGroup(b.status);
      if (groupA !== groupB) return rank[groupA] - rank[groupB];
      if (groupA === "scheduled") {
        const difference =
          dateValue(a.scheduledAt, Number.MAX_SAFE_INTEGER) -
          dateValue(b.scheduledAt, Number.MAX_SAFE_INTEGER);
        if (difference !== 0) return difference;
      }
      return dateValue(b.updatedAt, 0) - dateValue(a.updatedAt, 0) || a.id.localeCompare(b.id);
    });
}
