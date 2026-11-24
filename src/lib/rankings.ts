/** Player rankings and head-to-head comparison from career totals. */
export interface CareerTotals {
  runs?: number | null;
  ballsFaced?: number | null;
  fours?: number | null;
  sixes?: number | null;
  ballsBowled?: number | null;
  runsConceded?: number | null;
  wickets?: number | null;
  catches?: number | null;
  stumpings?: number | null;
  runOuts?: number | null;
}

export type RankBy = "points" | "runs" | "wickets" | "strikeRate" | "economy";

const n = (value: number | null | undefined) => value ?? 0;

/** All-round points: 1 per run, 20 per wicket, 10 per catch/stumping/run out. */
export const rankingPoints = (t: CareerTotals) =>
  n(t.runs) + 20 * n(t.wickets) + 10 * (n(t.catches) + n(t.stumpings) + n(t.runOuts));
export const strikeRate = (t: CareerTotals) =>
  n(t.ballsFaced) ? Math.round((n(t.runs) / n(t.ballsFaced)) * 1000) / 10 : null;
export const economy = (t: CareerTotals) =>
  n(t.ballsBowled) ? Math.round((n(t.runsConceded) / (n(t.ballsBowled) / 6)) * 100) / 100 : null;

/** Strike rate needs 60 balls faced and economy 60 balls bowled, so one lucky over can't top the list. */
export const minimumBalls = 60;

export function rankPlayers<T extends CareerTotals>(rows: readonly T[], by: RankBy): T[] {
  const value = (row: T): number | null => {
    switch (by) {
      case "runs":
        return n(row.runs);
      case "wickets":
        return n(row.wickets);
      case "strikeRate":
        return n(row.ballsFaced) >= minimumBalls ? strikeRate(row) : null;
      case "economy":
        return n(row.ballsBowled) >= minimumBalls ? economy(row) : null;
      default:
        return rankingPoints(row);
    }
  };
  return rows
    .map((row) => ({ row, v: value(row) }))
    .filter((item): item is { row: T; v: number } => item.v !== null)
    .sort((a, b) => (by === "economy" ? a.v - b.v : b.v - a.v))
    .map((item) => item.row);
}

export interface CompareLine {
  label: string;
  a: string;
  b: string;
  /** Which side is better on this line, if either. */
  better: "a" | "b" | null;
}

export function comparePlayers(a: CareerTotals, b: CareerTotals): CompareLine[] {
  const line = (
    label: string,
    x: number | null,
    y: number | null,
    lowerIsBetter = false,
    digits = 0,
  ): CompareLine => ({
    label,
    a: x == null ? "–" : x.toFixed(digits),
    b: y == null ? "–" : y.toFixed(digits),
    better: x == null || y == null || x === y ? null : (lowerIsBetter ? x < y : x > y) ? "a" : "b",
  });
  return [
    line("Runs", n(a.runs), n(b.runs)),
    line("Strike rate", strikeRate(a), strikeRate(b), false, 1),
    line("Fours", n(a.fours), n(b.fours)),
    line("Sixes", n(a.sixes), n(b.sixes)),
    line("Wickets", n(a.wickets), n(b.wickets)),
    line("Economy", economy(a), economy(b), true, 2),
    line("Catches", n(a.catches), n(b.catches)),
    line("Ranking points", rankingPoints(a), rankingPoints(b)),
  ];
}
