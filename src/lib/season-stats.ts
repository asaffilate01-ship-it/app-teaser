import { bowlingCard, type CricketMatch } from "./cricket.ts";
import { battingSplit } from "./scorecard.ts";

export interface BattingStat {
  playerId: string;
  name: string;
  team: string;
  matches: number;
  innings: number;
  notOuts: number;
  runs: number;
  balls: number;
  highScore: number;
  highScoreNotOut: boolean;
  /** Runs per dismissal; null until the batter has been out. */
  average: number | null;
  strikeRate: number;
  fifties: number;
  hundreds: number;
  ducks: number;
  fours: number;
  sixes: number;
}

export interface BowlingStat {
  playerId: string;
  name: string;
  team: string;
  matches: number;
  innings: number;
  balls: number;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  /** Best figures in one innings. */
  best: { wickets: number; runs: number } | null;
  /** Best figures in one match. */
  bestMatch: { wickets: number; runs: number } | null;
  average: number | null;
  economy: number | null;
  strikeRate: number | null;
  fourWickets: number;
  fiveWickets: number;
  tenWicketMatches: number;
}

export interface FieldingStat {
  playerId: string;
  name: string;
  team: string;
  catches: number;
  stumpings: number;
  runOuts: number;
}

export interface SeasonStats {
  batting: BattingStat[];
  bowling: BowlingStat[];
  fielding: FieldingStat[];
  matches: number;
}

const better = (a: { wickets: number; runs: number } | null, b: { wickets: number; runs: number }) =>
  !a || b.wickets > a.wickets || (b.wickets === a.wickets && b.runs < a.runs) ? b : a;

/** Season batting, bowling and fielding records from full match snapshots. */
export function seasonStats(matches: readonly CricketMatch[]): SeasonStats {
  const batting = new Map<string, BattingStat & { outs: number; matchIds: Set<string> }>();
  const bowling = new Map<string, BowlingStat & { matchIds: Set<string>; byMatch: Map<string, { wickets: number; runs: number }> }>();
  const fielding = new Map<string, FieldingStat>();
  const bpoFor = new Map<string, number>();

  for (const match of matches) {
    const bpo = match.settings.ballsPerOver;
    const teamOf = (id: string) => match.teams.find((team) => team.players.some((player) => player.id === id));
    for (const innings of match.innings) {
      const team = match.teams.find((item) => item.id === innings.battingTeamId)?.name ?? "";
      const bowlingTeam = match.teams.find((item) => item.id === innings.bowlingTeamId)?.name ?? "";
      for (const row of battingSplit(match, innings).batted) {
        const entry =
          batting.get(row.playerId) ??
          { playerId: row.playerId, name: row.name, team, matches: 0, innings: 0, notOuts: 0, runs: 0, balls: 0, highScore: 0, highScoreNotOut: false, average: null, strikeRate: 0, fifties: 0, hundreds: 0, ducks: 0, fours: 0, sixes: 0, outs: 0, matchIds: new Set<string>() };
        const out = row.dismissal !== "not out";
        entry.matchIds.add(match.id);
        entry.innings += 1;
        entry.runs += row.runs;
        entry.balls += row.balls;
        entry.fours += row.fours;
        entry.sixes += row.sixes;
        if (out) entry.outs += 1;
        else entry.notOuts += 1;
        if (row.runs > entry.highScore || (row.runs === entry.highScore && !out)) {
          entry.highScore = row.runs;
          entry.highScoreNotOut = !out;
        }
        if (row.runs >= 100) entry.hundreds += 1;
        else if (row.runs >= 50) entry.fifties += 1;
        if (row.runs === 0 && out) entry.ducks += 1;
        batting.set(row.playerId, entry);
      }
      for (const row of bowlingCard(match, innings)) {
        bpoFor.set(row.playerId, bpo);
        const entry =
          bowling.get(row.playerId) ??
          { playerId: row.playerId, name: row.name, team: bowlingTeam, matches: 0, innings: 0, balls: 0, overs: "0.0", maidens: 0, runs: 0, wickets: 0, best: null, bestMatch: null, average: null, economy: null, strikeRate: null, fourWickets: 0, fiveWickets: 0, tenWicketMatches: 0, matchIds: new Set<string>(), byMatch: new Map() };
        entry.matchIds.add(match.id);
        entry.innings += 1;
        entry.balls += row.balls;
        entry.maidens += row.maidens;
        entry.runs += row.runs;
        entry.wickets += row.wickets;
        entry.best = better(entry.best, { wickets: row.wickets, runs: row.runs });
        if (row.wickets >= 5) entry.fiveWickets += 1;
        else if (row.wickets === 4) entry.fourWickets += 1;
        const sum = entry.byMatch.get(match.id) ?? { wickets: 0, runs: 0 };
        entry.byMatch.set(match.id, { wickets: sum.wickets + row.wickets, runs: sum.runs + row.runs });
        bowling.set(row.playerId, entry);
      }
      for (const ball of innings.deliveries) {
        const dismissal = ball.dismissal;
        if (!dismissal?.fielderId) continue;
        if (!["caught", "stumped", "run-out"].includes(dismissal.type)) continue;
        const player = teamOf(dismissal.fielderId)?.players.find((item) => item.id === dismissal.fielderId);
        const entry = fielding.get(dismissal.fielderId) ?? { playerId: dismissal.fielderId, name: player?.name ?? "Fielder", team: teamOf(dismissal.fielderId)?.name ?? "", catches: 0, stumpings: 0, runOuts: 0 };
        if (dismissal.type === "caught") entry.catches += 1;
        if (dismissal.type === "stumped") entry.stumpings += 1;
        if (dismissal.type === "run-out") entry.runOuts += 1;
        fielding.set(dismissal.fielderId, entry);
      }
    }
  }

  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    matches: matches.length,
    batting: [...batting.values()]
      .map(({ outs, matchIds, ...entry }) => ({
        ...entry,
        matches: matchIds.size,
        average: outs ? round(entry.runs / outs) : null,
        strikeRate: entry.balls ? round((entry.runs * 100) / entry.balls) : 0,
      }))
      .sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name)),
    bowling: [...bowling.values()]
      .map(({ matchIds, byMatch, ...entry }) => {
        const bpo = bpoFor.get(entry.playerId) ?? 6;
        let bestMatch: { wickets: number; runs: number } | null = null;
        let tens = 0;
        for (const figures of byMatch.values()) {
          bestMatch = better(bestMatch, figures);
          if (figures.wickets >= 10) tens += 1;
        }
        return {
          ...entry,
          matches: matchIds.size,
          overs: `${Math.floor(entry.balls / bpo)}.${entry.balls % bpo}`,
          bestMatch,
          tenWicketMatches: tens,
          average: entry.wickets ? round(entry.runs / entry.wickets) : null,
          economy: entry.balls ? round((entry.runs * bpo) / entry.balls) : null,
          strikeRate: entry.wickets ? round(entry.balls / entry.wickets) : null,
        };
      })
      .sort((a, b) => b.wickets - a.wickets || (a.average ?? 999) - (b.average ?? 999)),
    fielding: [...fielding.values()].sort((a, b) => b.catches + b.stumpings + b.runOuts - (a.catches + a.stumpings + a.runOuts)),
  };
}

export const figures = (value: { wickets: number; runs: number } | null) => (value ? `${value.wickets}/${value.runs}` : "–");
