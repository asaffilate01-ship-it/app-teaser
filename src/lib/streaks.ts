import {
  battingCard,
  bowlingCard,
  isSuperOver,
  matchResult,
  type CricketMatch,
} from "./cricket.ts";

const dateOf = (match: CricketMatch) => match.settings.startTime || match.createdAt;
const byDate = (matches: readonly CricketMatch[]) =>
  [...matches]
    .filter((match) => matchResult(match) !== null)
    .sort((a, b) => dateOf(a).localeCompare(dateOf(b)));

export type FormLetter = "W" | "L" | "T" | "D";

export interface TeamStreak {
  teamId: string;
  name: string;
  /** Oldest to newest, last five finished matches. */
  form: FormLetter[];
  current: { letter: FormLetter; length: number } | null;
  longestWinning: number;
  longestUnbeaten: number;
}

/** Form, current run and best winning / unbeaten runs for every team in the finished matches. */
export function teamStreaks(matches: readonly CricketMatch[]): TeamStreak[] {
  const letters = new Map<string, { name: string; list: FormLetter[] }>();
  for (const match of byDate(matches)) {
    const result = matchResult(match)!;
    for (const team of match.teams) {
      const letter: FormLetter = result.winnerTeamId
        ? result.winnerTeamId === team.id
          ? "W"
          : "L"
        : result.tied
          ? "T"
          : "D";
      const entry = letters.get(team.id) ?? { name: team.name, list: [] };
      entry.list.push(letter);
      letters.set(team.id, entry);
    }
  }
  return [...letters.entries()]
    .map(([teamId, { name, list }]) => {
      let longestWinning = 0;
      let longestUnbeaten = 0;
      let win = 0;
      let unbeaten = 0;
      for (const letter of list) {
        win = letter === "W" ? win + 1 : 0;
        unbeaten = letter === "L" ? 0 : unbeaten + 1;
        longestWinning = Math.max(longestWinning, win);
        longestUnbeaten = Math.max(longestUnbeaten, unbeaten);
      }
      const last = list.at(-1);
      let length = 0;
      for (let i = list.length - 1; i >= 0 && list[i] === last; i--) length += 1;
      return {
        teamId,
        name,
        form: list.slice(-5),
        current: last ? { letter: last, length } : null,
        longestWinning,
        longestUnbeaten,
      };
    })
    .sort((a, b) => b.longestWinning - a.longestWinning || a.name.localeCompare(b.name));
}

export interface Rivalry {
  teamA: string;
  teamB: string;
  nameA: string;
  nameB: string;
  played: number;
  winsA: number;
  winsB: number;
  /** Ties, draws and no results. */
  other: number;
  lastResult: string;
}

/** Team pairings that have met at least twice, most-played first, then the closest records. */
export function rivalries(matches: readonly CricketMatch[]): Rivalry[] {
  const pairs = new Map<string, Rivalry>();
  for (const match of byDate(matches)) {
    const [home, away] = match.teams;
    const [a, b] = home.id < away.id ? [home, away] : [away, home];
    const key = `${a.id}|${b.id}`;
    const entry = pairs.get(key) ?? {
      teamA: a.id,
      teamB: b.id,
      nameA: a.name,
      nameB: b.name,
      played: 0,
      winsA: 0,
      winsB: 0,
      other: 0,
      lastResult: "",
    };
    const result = matchResult(match)!;
    entry.played += 1;
    if (result.winnerTeamId === a.id) entry.winsA += 1;
    else if (result.winnerTeamId === b.id) entry.winsB += 1;
    else entry.other += 1;
    entry.lastResult = result.text;
    pairs.set(key, entry);
  }
  return [...pairs.values()]
    .filter((pair) => pair.played >= 2)
    .sort(
      (x, y) => y.played - x.played || Math.abs(x.winsA - x.winsB) - Math.abs(y.winsA - y.winsB),
    );
}

export interface PlayerStreak {
  playerId: string;
  name: string;
  team: string;
  current: number;
  longest: number;
}

export const BIG_SCORE = 30;

function streakTable(
  sequences: Map<string, { name: string; team: string; hits: boolean[] }>,
): PlayerStreak[] {
  return [...sequences.entries()]
    .map(([playerId, { name, team, hits }]) => {
      let longest = 0;
      let run = 0;
      for (const hit of hits) {
        run = hit ? run + 1 : 0;
        longest = Math.max(longest, run);
      }
      return { playerId, name, team, current: run, longest };
    })
    .filter((row) => row.longest >= 2)
    .sort((a, b) => b.longest - a.longest || b.current - a.current || a.name.localeCompare(b.name));
}

/** Innings in a row with 30 or more runs (Super Overs left out). */
export function battingStreaks(matches: readonly CricketMatch[]): PlayerStreak[] {
  const sequences = new Map<string, { name: string; team: string; hits: boolean[] }>();
  for (const match of byDate(matches)) {
    for (const innings of match.innings) {
      if (isSuperOver(innings)) continue;
      const team = match.teams.find((item) => item.id === innings.battingTeamId)?.name ?? "";
      const batted = (id: string) =>
        innings.strikerId === id ||
        innings.nonStrikerId === id ||
        innings.deliveries.some(
          (ball) =>
            ball.strikerId === id || ball.nonStrikerId === id || ball.dismissal?.batterId === id,
        );
      for (const row of battingCard(match, innings)) {
        if (!batted(row.playerId)) continue; // did not bat
        const entry = sequences.get(row.playerId) ?? { name: row.name, team, hits: [] };
        entry.hits.push(row.runs >= BIG_SCORE);
        sequences.set(row.playerId, entry);
      }
    }
  }
  return streakTable(sequences);
}

/** Matches in a row with at least one wicket, for bowlers who bowled in them. */
export function wicketStreaks(matches: readonly CricketMatch[]): PlayerStreak[] {
  const sequences = new Map<string, { name: string; team: string; hits: boolean[] }>();
  for (const match of byDate(matches)) {
    const perMatch = new Map<string, { name: string; team: string; wickets: number }>();
    for (const innings of match.innings) {
      if (isSuperOver(innings)) continue;
      const team = match.teams.find((item) => item.id === innings.bowlingTeamId)?.name ?? "";
      for (const row of bowlingCard(match, innings)) {
        if (row.balls === 0) continue;
        const entry = perMatch.get(row.playerId) ?? { name: row.name, team, wickets: 0 };
        entry.wickets += row.wickets;
        perMatch.set(row.playerId, entry);
      }
    }
    for (const [playerId, { name, team, wickets }] of perMatch) {
      const entry = sequences.get(playerId) ?? { name, team, hits: [] };
      entry.hits.push(wickets > 0);
      sequences.set(playerId, entry);
    }
  }
  return streakTable(sequences);
}
