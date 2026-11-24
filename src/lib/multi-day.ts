/** Multi-day cricket: close of play ("stumps"), the next day's start, and a draw when time runs out. */
import {
  currentInnings,
  summarizeInnings,
  teamTotals,
  type CloseOfPlay,
  type CricketMatch,
} from "./cricket.ts";

export const isMultiDay = (match: CricketMatch) => match.settings.inningsPerSide === 2;

export function currentDay(match: CricketMatch): number {
  return match.days?.current ?? 1;
}

export function scheduledDays(match: CricketMatch): number | null {
  const days = match.settings.rules?.days;
  return typeof days === "number" && days >= 1 ? days : null;
}

/** "Lions lead by 42" / "Tigers need 118 more" / "Tigers trail by 30" for the close-of-play line. */
export function situationNote(match: CricketMatch): string | undefined {
  const innings = match.innings.filter((item) => item.kind !== "super-over");
  const latest = innings.at(-1);
  if (!latest || innings.length < 2) return undefined;
  const totals = teamTotals(match);
  const name = (id: string) => match.teams.find((team) => team.id === id)?.name ?? "Team";
  const batting = latest.battingTeamId;
  const other = match.teams.find((team) => team.id !== batting)!.id;
  const diff = (totals.get(batting) ?? 0) - (totals.get(other) ?? 0);
  if (innings.length === 4) return diff < 0 ? `${name(batting)} need ${-diff + 1} more` : undefined;
  if (diff > 0) return `${name(batting)} lead by ${diff}`;
  if (diff < 0) return `${name(batting)} trail by ${-diff}`;
  return "Scores level";
}

/** Draws stumps: play stops and today's close-of-play score is recorded. Two-innings matches only. */
export function callStumps(match: CricketMatch, now = new Date()): CricketMatch {
  if (!isMultiDay(match) || match.status === "completed" || match.days?.atStumps) return match;
  const innings = currentInnings(match);
  const summary = summarizeInnings(innings, match.settings.ballsPerOver);
  const day = currentDay(match);
  const close: CloseOfPlay = {
    day,
    inningsIndex: match.innings.length - 1,
    battingTeamId: innings.battingTeamId,
    runs: summary.runs,
    wickets: summary.wickets,
    overs: summary.overs,
    note: situationNote(match),
    at: now.toISOString(),
  };
  const closes = [...(match.days?.closes ?? []).filter((item) => item.day !== day), close];
  return { ...match, updatedAt: now.toISOString(), days: { current: day, atStumps: true, closes } };
}

/** Starts the next day's play after stumps. */
export function startNextDay(match: CricketMatch, now = new Date()): CricketMatch {
  if (!match.days?.atStumps || match.status === "completed") return match;
  return {
    ...match,
    updatedAt: now.toISOString(),
    days: { ...match.days, current: match.days.current + 1, atStumps: false },
  };
}

/** True once stumps have been drawn on the last scheduled day. */
export function outOfTime(match: CricketMatch): boolean {
  const days = scheduledDays(match);
  return days !== null && !!match.days?.atStumps && match.days.current >= days;
}

/** Time has run out: the current innings closes unfinished and the match ends. The result follows the usual
 *  rules, so an unfinished chase or an unplayed innings is a draw. */
export function endMatchOutOfTime(match: CricketMatch, now = new Date()): CricketMatch {
  if (!isMultiDay(match) || match.status === "completed") return match;
  const stumped = match.days?.atStumps ? match : callStumps(match, now);
  const innings = stumped.innings.map((item, index) =>
    index === stumped.innings.length - 1
      ? {
          ...item,
          status: "completed" as const,
          ...(item.status === "live" ? { unfinished: true } : {}),
        }
      : item,
  );
  return {
    ...stumped,
    innings,
    days: { ...stumped.days!, timeUp: true },
    status: "completed",
    updatedAt: now.toISOString(),
  };
}

/** "Stumps, Day 2: Lions 245/6 (78.0 ov) — Lions lead by 42". */
export function closeOfPlayText(match: CricketMatch, close: CloseOfPlay): string {
  const name = match.teams.find((team) => team.id === close.battingTeamId)?.name ?? "Team";
  return `Stumps, Day ${close.day}: ${name} ${close.runs}/${close.wickets} (${close.overs} ov)${close.note ? ` — ${close.note}` : ""}`;
}
