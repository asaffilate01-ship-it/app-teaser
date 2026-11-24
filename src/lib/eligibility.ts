/** Who may play for a team in a competition: registration, overseas limit, playing down, suspensions. */
export interface EligibilityData {
  settings: {
    overseas_limit: number | null;
    played_down_limit: number | null;
    registered_only: boolean;
  } | null;
  registrations: { playerId: string; overseas: boolean; status: string; teamId: string }[];
  permits: { playerId: string; validUntil: string | null }[];
  suspensions: { playerId: string; until: string }[];
  /** Games for a higher team of the same club in the last year. */
  higherTeamGames: Record<string, number>;
}

export interface EligibilityIssue {
  playerId: string | null;
  kind: "suspended" | "not-registered" | "rejected" | "overseas" | "played-down";
  message: string;
}

export function checkEligibility(
  selected: readonly string[],
  data: EligibilityData,
  nameOf: (id: string) => string,
): EligibilityIssue[] {
  const issues: EligibilityIssue[] = [];
  const permitted = new Set(data.permits.map((p) => p.playerId));
  const reg = new Map(data.registrations.map((r) => [r.playerId, r]));
  for (const id of selected) {
    const suspension = data.suspensions.find((s) => s.playerId === id);
    if (suspension)
      issues.push({
        playerId: id,
        kind: "suspended",
        message: `${nameOf(id)} is suspended until ${suspension.until}.`,
      });
    const row = reg.get(id);
    if (row?.status === "rejected")
      issues.push({
        playerId: id,
        kind: "rejected",
        message: `${nameOf(id)}'s registration was rejected by the league.`,
      });
    else if (data.settings?.registered_only && !row && !permitted.has(id)) {
      issues.push({
        playerId: id,
        kind: "not-registered",
        message: `${nameOf(id)} isn't registered for this competition.`,
      });
    }
    const limit = data.settings?.played_down_limit;
    const games = data.higherTeamGames[id] ?? 0;
    if (limit && games >= limit && !permitted.has(id)) {
      issues.push({
        playerId: id,
        kind: "played-down",
        message: `${nameOf(id)} has played ${games} games for a higher team (limit ${limit}) and needs a permit to play down.`,
      });
    }
  }
  const overseasLimit = data.settings?.overseas_limit;
  if (overseasLimit != null) {
    const overseas = selected.filter((id) => reg.get(id)?.overseas);
    if (overseas.length > overseasLimit) {
      issues.push({
        playerId: null,
        kind: "overseas",
        message: `${overseas.length} overseas players picked; the league allows ${overseasLimit}.`,
      });
    }
  }
  return issues;
}
