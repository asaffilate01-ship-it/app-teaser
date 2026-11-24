import type { CompetitionRules, TableRow } from "./platform.ts";
import { predictWin, type MatchConditions } from "./win-predictor.ts";

/** The name-free live state each scoring device publishes. */
export interface LiveStateLike {
  battingTeamId?: unknown;
  runs?: unknown;
  wickets?: unknown;
  overs?: unknown;
  target?: unknown;
  inningsNumber?: unknown;
  maxWickets?: unknown;
  conditions?: unknown;
  settings?: unknown;
}

export interface LiveMatchSituation {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  battingTeamId: string | null;
  runs: number;
  wickets: number;
  overs: string;
  legalBalls: number;
  target: number | null;
  oversPerInnings: number | null;
  ballsPerOver: number;
  /** Home side's chance of winning, or null when the predictor does not apply. */
  homeWin: number | null;
}

const num = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export function legalBallsFromOvers(overs: string, ballsPerOver: number) {
  const match = /^(\d+)\.(\d+)$/.exec(overs);
  return match ? Number(match[1]) * ballsPerOver + Number(match[2]) : 0;
}

/** Turn a published live state into a match situation with a home-side win chance. */
export function readLiveSituation(match: {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  liveState: LiveStateLike;
}): LiveMatchSituation {
  const state = match.liveState ?? {};
  const settings = (
    state.settings && typeof state.settings === "object" ? state.settings : {}
  ) as Record<string, unknown>;
  const ballsPerOver = num(settings["ballsPerOver"], 6) || 6;
  const limit = (state as Record<string, unknown>)["oversLimit"];
  const oversPerInnings =
    typeof limit === "number"
      ? limit
      : typeof settings["oversPerInnings"] === "number"
        ? (settings["oversPerInnings"] as number)
        : null;
  const overs = typeof state.overs === "string" ? state.overs : "0.0";
  const battingTeamId = typeof state.battingTeamId === "string" ? state.battingTeamId : null;
  const target = typeof state.target === "number" ? state.target : null;
  const legalBalls = legalBallsFromOvers(overs, ballsPerOver);
  const runs = num(state.runs);
  const wickets = num(state.wickets);
  const battingIsHome = battingTeamId === match.homeTeamId;
  const prediction = battingTeamId
    ? predictWin({
        oversPerInnings,
        inningsPerSide: num(settings["inningsPerSide"], 1),
        ballsPerOver,
        inningsNumber: num(state.inningsNumber, target ? 2 : 1),
        runs,
        wickets,
        legalBalls,
        target,
        maxWickets: num(state.maxWickets, 10),
        battingIsHome,
        conditions:
          state.conditions && typeof state.conditions === "object"
            ? (state.conditions as MatchConditions)
            : undefined,
      })
    : null;
  return {
    matchId: match.id,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    battingTeamId,
    runs,
    wickets,
    overs,
    legalBalls,
    target,
    oversPerInnings,
    ballsPerOver,
    homeWin: prediction ? (battingIsHome ? prediction.battingWin : prediction.bowlingWin) : null,
  };
}

export interface LiveTableRow extends TableRow {
  position: number;
  /** Positive = climbing compared with the signed-off table. */
  movement: number;
  /** "W" or "L" (or "T") if the team is in a live match: how it stands right now. */
  liveOutcome: "W" | "L" | "T" | null;
}

/**
 * "If it finished now" table: signed-off rows plus each live match awarded to the side the win predictor
 * favours (a dead-even 50% counts as a tie). Net run rate is left as signed off, never estimated.
 */
export function projectLiveTable(
  base: readonly TableRow[],
  live: readonly LiveMatchSituation[],
  rules: Pick<CompetitionRules, "points" | "tieBreakers">,
): LiveTableRow[] {
  const rows = new Map(base.map((row) => [row.teamId, { ...row }]));
  const outcome = new Map<string, "W" | "L" | "T">();
  const ensure = (teamId: string) => {
    if (!rows.has(teamId)) {
      rows.set(teamId, {
        teamId,
        played: 0,
        won: 0,
        tied: 0,
        lost: 0,
        noResult: 0,
        points: 0,
        runsFor: 0,
        ballsFaced: 0,
        runsAgainst: 0,
        ballsBowled: 0,
        netRunRate: 0,
      });
    }
    return rows.get(teamId)!;
  };
  for (const match of live) {
    if (match.homeWin == null) continue;
    const home = ensure(match.homeTeamId);
    const away = ensure(match.awayTeamId);
    home.played += 1;
    away.played += 1;
    if (match.homeWin === 50) {
      home.tied += 1;
      away.tied += 1;
      home.points += rules.points.tie;
      away.points += rules.points.tie;
      outcome.set(home.teamId, "T");
      outcome.set(away.teamId, "T");
    } else {
      const [winner, loser] = match.homeWin > 50 ? [home, away] : [away, home];
      winner.won += 1;
      loser.lost += 1;
      winner.points += rules.points.win;
      loser.points += rules.points.loss;
      outcome.set(winner.teamId, "W");
      outcome.set(loser.teamId, "L");
    }
  }
  const sorter = (a: TableRow, b: TableRow) => {
    for (const tieBreaker of rules.tieBreakers) {
      if (tieBreaker === "points" && a.points !== b.points) return b.points - a.points;
      if (tieBreaker === "wins" && a.won !== b.won) return b.won - a.won;
      if (tieBreaker === "net-run-rate" && a.netRunRate !== b.netRunRate)
        return b.netRunRate - a.netRunRate;
    }
    return a.teamId.localeCompare(b.teamId);
  };
  const before = [...base].sort(sorter).map((row) => row.teamId);
  return [...rows.values()].sort(sorter).map((row, index) => {
    const previous = before.indexOf(row.teamId);
    return {
      ...row,
      position: index + 1,
      movement: previous === -1 ? 0 : previous - index,
      liveOutcome: outcome.get(row.teamId) ?? null,
    };
  });
}
