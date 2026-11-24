export interface ExternalTeamRecord {
  id: string;
  name: string;
  shortName: string;
  ageGroup: null;
  playerIds: string[];
  external: true;
  clubName: string;
  competitionIds: string[];
}

/** Other clubs' teams entered in this organisation's competitions, named with their club so fixtures read clearly. */
export function externalTeams(
  rows: ReadonlyArray<{ competition_id: string; team_id: string; name: string; short_name: string; club_name: string }>,
  ownIds: ReadonlySet<string>,
): ExternalTeamRecord[] {
  const byId = new Map<string, ExternalTeamRecord>();
  for (const row of rows) {
    if (ownIds.has(row.team_id)) continue;
    const existing = byId.get(row.team_id);
    if (existing) {
      existing.competitionIds = [...(existing.competitionIds ?? []), row.competition_id];
      continue;
    }
    const named = row.name.toLowerCase().includes(row.club_name.toLowerCase()) ? row.name : `${row.club_name} ${row.name}`;
    byId.set(row.team_id, {
      id: row.team_id,
      name: named,
      shortName: row.short_name,
      ageGroup: null,
      playerIds: [],
      external: true,
      clubName: row.club_name,
      competitionIds: [row.competition_id],
    });
  }
  return [...byId.values()];
}

