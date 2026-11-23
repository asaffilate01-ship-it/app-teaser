import {
  battingCard,
  bowlingCard,
  isBowlerWicket,
  isSuperOver,
  matchResult,
  type CricketMatch,
  type Innings,
} from "./cricket.ts";
import { seasonStats, type BattingStat, type BowlingStat, type FieldingStat } from "./season-stats.ts";

const regular = (match: CricketMatch) => match.innings.filter((innings) => !isSuperOver(innings));

// ---------------------------------------------------------------------------
// Player of the Match
// ---------------------------------------------------------------------------

export interface MatchImpact {
  playerId: string;
  name: string;
  teamId: string;
  runs: number;
  wickets: number;
  dismissalsFielded: number;
  score: number;
}

/**
 * Impact score for every player in a match: runs + 20 per wicket + 10 per catch, stumping or run out,
 * with +10 for a fifty, +25 for a hundred and +25 for a five-wicket innings. Super Overs do not count.
 */
export function matchImpacts(match: CricketMatch): MatchImpact[] {
  const lines = new Map<string, MatchImpact>();
  const line = (playerId: string) => {
    const existing = lines.get(playerId);
    if (existing) return existing;
    const team = match.teams.find((item) => item.players.some((player) => player.id === playerId));
    const created: MatchImpact = {
      playerId,
      name: team?.players.find((player) => player.id === playerId)?.name ?? "Player",
      teamId: team?.id ?? "",
      runs: 0,
      wickets: 0,
      dismissalsFielded: 0,
      score: 0,
    };
    lines.set(playerId, created);
    return created;
  };
  for (const innings of regular(match)) {
    for (const row of battingCard(match, innings)) {
      if (!row.balls && !row.runs) continue;
      const entry = line(row.playerId);
      entry.runs += row.runs;
      entry.score += row.runs + (row.runs >= 100 ? 25 : row.runs >= 50 ? 10 : 0);
    }
    for (const row of bowlingCard(match, innings)) {
      const entry = line(row.playerId);
      entry.wickets += row.wickets;
      entry.score += row.wickets * 20 + (row.wickets >= 5 ? 25 : 0);
    }
    for (const ball of innings.deliveries) {
      const fielder = ball.dismissal?.fielderId;
      if (!fielder || !["caught", "stumped", "run-out"].includes(ball.dismissal!.type)) continue;
      const entry = line(fielder);
      entry.dismissalsFielded += 1;
      entry.score += 10;
    }
  }
  return [...lines.values()].sort((a, b) => b.score - a.score);
}

/** Highest impact score in a finished match; a tie on score goes to the winning side. Null until the match is decided. */
export function playerOfTheMatch(match: CricketMatch): MatchImpact | null {
  const result = matchResult(match);
  if (!result || result.noResult) return null;
  const impacts = matchImpacts(match);
  const best = impacts[0];
  if (!best || best.score <= 0) return null;
  const tied = impacts.filter((item) => item.score === best.score);
  return tied.find((item) => item.teamId === result.winnerTeamId) ?? best;
}

// ---------------------------------------------------------------------------
// Badges and milestones
// ---------------------------------------------------------------------------

export type BadgeKind =
  | "fifty"
  | "hundred"
  | "five-for"
  | "hat-trick"
  | "six-hitter"
  | "safe-hands"
  | "player-of-match"
  | "runs-500"
  | "runs-1000"
  | "wickets-25"
  | "wickets-50";

export interface Badge {
  kind: BadgeKind;
  label: string;
  detail: string;
  matchId: string | null;
  date: string | null;
}

/** True when the bowler took wickets with three consecutive legal deliveries they bowled in this innings. */
export function hasHatTrick(innings: Innings, bowlerId: string): boolean {
  let streak = 0;
  for (const ball of innings.deliveries) {
    if (ball.bowlerId !== bowlerId || !ball.legal) continue;
    if (ball.dismissal && isBowlerWicket(ball.dismissal.type)) {
      streak += 1;
      if (streak >= 3) return true;
    } else streak = 0;
  }
  return false;
}

export interface FormLine {
  matchId: string;
  date: string;
  opponent: string;
  runs: number | null;
  balls: number | null;
  out: boolean;
  wickets: number | null;
  runsConceded: number | null;
}

export interface PlayerProfile {
  playerId: string;
  name: string;
  team: string;
  matches: number;
  batting: BattingStat | null;
  bowling: BowlingStat | null;
  fielding: FieldingStat | null;
  /** Most recent first. */
  form: FormLine[];
  badges: Badge[];
  playerOfMatchAwards: number;
}

const byDate = (a: CricketMatch, b: CricketMatch) =>
  (a.settings.startTime || a.createdAt).localeCompare(b.settings.startTime || b.createdAt);

/** Career page for one player across loaded match snapshots (Super Overs excluded). */
export function playerProfile(matches: readonly CricketMatch[], playerId: string): PlayerProfile | null {
  const played = matches
    .filter((match) => match.teams.some((team) => team.players.some((player) => player.id === playerId)))
    .sort(byDate);
  if (!played.length) return null;
  const stats = seasonStats(played);
  const team = played.at(-1)!.teams.find((item) => item.players.some((player) => player.id === playerId))!;
  const name = team.players.find((player) => player.id === playerId)!.name;
  const badges: Badge[] = [];
  const form: FormLine[] = [];
  let careerRuns = 0;
  let careerWickets = 0;
  let awards = 0;
  const milestone = (kind: BadgeKind, label: string, detail: string, match: CricketMatch) =>
    badges.push({ kind, label, detail, matchId: match.id, date: match.settings.startTime || match.createdAt });

  for (const match of played) {
    const own = match.teams.find((item) => item.players.some((player) => player.id === playerId))!;
    const opponent = match.teams.find((item) => item.id !== own.id)!.name;
    const versus = `v ${opponent}`;
    let runs: number | null = null;
    let balls: number | null = null;
    let out = false;
    let wickets: number | null = null;
    let conceded: number | null = null;
    let catches = 0;
    for (const innings of regular(match)) {
      if (innings.battingTeamId === own.id) {
        const row = battingCard(match, innings).find((item) => item.playerId === playerId);
        const batted = innings.deliveries.some((ball) => ball.strikerId === playerId || ball.nonStrikerId === playerId);
        if (row && batted) {
          runs = (runs ?? 0) + row.runs;
          balls = (balls ?? 0) + row.balls;
          out = out || row.dismissal !== "not out";
          if (row.runs >= 100) milestone("hundred", "Century", `${row.runs} ${versus}`, match);
          else if (row.runs >= 50) milestone("fifty", "Fifty", `${row.runs} ${versus}`, match);
          if (row.sixes >= 5) milestone("six-hitter", "Six hitter", `${row.sixes} sixes ${versus}`, match);
          const before = careerRuns;
          careerRuns += row.runs;
          if (before < 500 && careerRuns >= 500) milestone("runs-500", "500 runs", `Reached ${versus}`, match);
          if (before < 1000 && careerRuns >= 1000) milestone("runs-1000", "1,000 runs", `Reached ${versus}`, match);
        }
      } else {
        const row = bowlingCard(match, innings).find((item) => item.playerId === playerId);
        if (row) {
          wickets = (wickets ?? 0) + row.wickets;
          conceded = (conceded ?? 0) + row.runs;
          if (row.wickets >= 5) milestone("five-for", "Five-wicket haul", `${row.wickets}/${row.runs} ${versus}`, match);
          if (hasHatTrick(innings, playerId)) milestone("hat-trick", "Hat-trick", versus, match);
          const before = careerWickets;
          careerWickets += row.wickets;
          if (before < 25 && careerWickets >= 25) milestone("wickets-25", "25 wickets", `Reached ${versus}`, match);
          if (before < 50 && careerWickets >= 50) milestone("wickets-50", "50 wickets", `Reached ${versus}`, match);
        }
        catches += innings.deliveries.filter(
          (ball) => ball.dismissal?.type === "caught" && ball.dismissal.fielderId === playerId,
        ).length;
      }
    }
    if (catches >= 3) milestone("safe-hands", "Safe hands", `${catches} catches ${versus}`, match);
    if (playerOfTheMatch(match)?.playerId === playerId) {
      awards += 1;
      milestone("player-of-match", "Player of the Match", versus, match);
    }
    form.push({
      matchId: match.id,
      date: match.settings.startTime || match.createdAt,
      opponent,
      runs,
      balls,
      out,
      wickets,
      runsConceded: conceded,
    });
  }

  return {
    playerId,
    name,
    team: team.name,
    matches: played.length,
    batting: stats.batting.find((row) => row.playerId === playerId) ?? null,
    bowling: stats.bowling.find((row) => row.playerId === playerId) ?? null,
    fielding: stats.fielding.find((row) => row.playerId === playerId) ?? null,
    form: form.reverse(),
    badges: badges.reverse(),
    playerOfMatchAwards: awards,
  };
}
