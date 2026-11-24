import {
  isBowlerWicket,
  isSuperOver,
  matchResult,
  summarizeInnings,
  type CricketMatch,
} from "./cricket.ts";

export interface TeamHeadToHead {
  played: number;
  wins: Record<string, number>;
  tied: number;
  /** Draws and no results. */
  other: number;
  highest: Record<string, number | null>;
  /** Most recent first. */
  recent: { matchId: string; date: string; text: string; winnerTeamId: string | null }[];
}

const hasTeam = (match: CricketMatch, id: string) => match.teams.some((team) => team.id === id);
const dateOf = (match: CricketMatch) => match.settings.startTime || match.createdAt;

/** Record between two teams over finished matches. */
export function teamHeadToHead(
  matches: readonly CricketMatch[],
  teamA: string,
  teamB: string,
): TeamHeadToHead {
  const meetings = matches
    .filter((match) => hasTeam(match, teamA) && hasTeam(match, teamB))
    .map((match) => ({ match, result: matchResult(match) }))
    .filter(
      (
        item,
      ): item is { match: CricketMatch; result: NonNullable<ReturnType<typeof matchResult>> } =>
        item.result !== null,
    )
    .sort((a, b) => dateOf(b.match).localeCompare(dateOf(a.match)));
  const summary: TeamHeadToHead = {
    played: meetings.length,
    wins: { [teamA]: 0, [teamB]: 0 },
    tied: 0,
    other: 0,
    highest: { [teamA]: null, [teamB]: null },
    recent: [],
  };
  for (const { match, result } of meetings) {
    if (result.winnerTeamId)
      summary.wins[result.winnerTeamId] = (summary.wins[result.winnerTeamId] ?? 0) + 1;
    else if (result.tied) summary.tied += 1;
    else summary.other += 1;
    for (const innings of match.innings) {
      if (isSuperOver(innings)) continue;
      const runs = summarizeInnings(innings, match.settings.ballsPerOver).runs;
      const current = summary.highest[innings.battingTeamId];
      if (current === undefined) continue;
      if (current === null || runs > current) summary.highest[innings.battingTeamId] = runs;
    }
    if (summary.recent.length < 5) {
      summary.recent.push({
        matchId: match.id,
        date: dateOf(match),
        text: result.text,
        winnerTeamId: result.winnerTeamId,
      });
    }
  }
  return summary;
}

export interface Matchup {
  batterId: string;
  bowlerId: string;
  balls: number;
  runs: number;
  dots: number;
  fours: number;
  sixes: number;
  dismissals: number;
  strikeRate: number;
}

/** Every batter-v-bowler contest in the loaded matches (Super Overs excluded). Wides are not balls faced. */
export function matchups(matches: readonly CricketMatch[]): Matchup[] {
  const lines = new Map<string, Matchup>();
  for (const match of matches) {
    for (const innings of match.innings) {
      if (isSuperOver(innings)) continue;
      for (const ball of innings.deliveries) {
        const key = `${ball.strikerId}|${ball.bowlerId}`;
        const line = lines.get(key) ?? {
          batterId: ball.strikerId,
          bowlerId: ball.bowlerId,
          balls: 0,
          runs: 0,
          dots: 0,
          fours: 0,
          sixes: 0,
          dismissals: 0,
          strikeRate: 0,
        };
        if (ball.extras.wide === 0) {
          line.balls += 1;
          if (ball.batterRuns === 0) line.dots += 1;
        }
        line.runs += ball.batterRuns;
        if (ball.batterRuns === 4) line.fours += 1;
        if (ball.batterRuns === 6) line.sixes += 1;
        if (
          ball.dismissal &&
          ball.dismissal.batterId === ball.strikerId &&
          isBowlerWicket(ball.dismissal.type)
        )
          line.dismissals += 1;
        lines.set(key, line);
      }
    }
  }
  return [...lines.values()]
    .map((line) => ({
      ...line,
      strikeRate: line.balls ? Math.round((line.runs * 1000) / line.balls) / 10 : 0,
    }))
    .sort((a, b) => b.balls - a.balls);
}

/** Players who appear in the loaded matches, for pickers: id → name and team. */
export function knownPlayers(matches: readonly CricketMatch[]) {
  const players = new Map<string, { id: string; name: string; team: string }>();
  for (const match of matches) {
    for (const team of match.teams)
      for (const player of team.players)
        players.set(player.id, { id: player.id, name: player.name, team: team.name });
  }
  return [...players.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Which teams appear in the loaded matches. */
export function knownTeams(matches: readonly CricketMatch[]) {
  const teams = new Map<string, string>();
  for (const match of matches) for (const team of match.teams) teams.set(team.id, team.name);
  return [...teams.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
