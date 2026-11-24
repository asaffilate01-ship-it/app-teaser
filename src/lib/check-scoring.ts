/**
 * Away-club check scoring: pure helpers for the read-only view.
 * Check scorers only follow and query balls — the database refuses any score change from them.
 */
export type FlagStatus = "open" | "fixed" | "kept";

export interface CheckBall {
  id: string;
  innings_id: string;
  sequence: number;
  over: number;
  ball: number;
  outcome: string | null;
  batter_runs: number;
  extras: Record<string, number> | null;
  total_runs: number;
  legal: boolean;
  wicket: boolean;
  dismissal: { type?: string } | null;
  striker: string | null;
  bowler: string | null;
}

export interface CheckFlag {
  id: string;
  delivery_id: string | null;
  innings_number: number | null;
  ball_label: string | null;
  note: string;
  status: FlagStatus;
  raised_at: string;
  reply: string | null;
  resolved_at: string | null;
}

export interface CheckInnings {
  id: string;
  number: number;
  batting_team_id: string;
  runs: number;
  wickets: number;
  legal_balls: number;
  target: number | null;
  status: string;
}

export interface CheckChecker {
  user_id: string;
  name: string;
  confirmed_at: string | null;
  confirm_note: string | null;
}

export interface CheckView {
  match: {
    id: string;
    status: string;
    scheduled_at: string | null;
    completed_at: string | null;
    home: string;
    away: string;
    home_team_id: string;
    away_team_id: string;
  } | null;
  innings: CheckInnings[];
  balls: CheckBall[];
  flags: CheckFlag[];
  checkers: CheckChecker[];
  me: { checker: boolean; home: boolean; can_name: boolean };
}

/** The same label the database stores on a query, e.g. "3.4". */
export function ballLabel(ball: Pick<CheckBall, "over" | "ball">): string {
  return `${ball.over}.${ball.ball}`;
}

const dismissalNames: Record<string, string> = {
  bowled: "bowled",
  caught: "caught",
  lbw: "lbw",
  stumped: "stumped",
  "run-out": "run out",
  "hit-wicket": "hit wicket",
  "obstructing-the-field": "obstructing the field",
};

/** Short plain-English description of one ball, e.g. "Wide +1", "4 runs", "WICKET (caught)". */
export function ballText(
  ball: Pick<CheckBall, "batter_runs" | "extras" | "total_runs" | "wicket" | "dismissal">,
): string {
  const extras = ball.extras ?? {};
  const parts: string[] = [];
  const wide = extras["wide"] ?? 0;
  const noBall = extras["noBall"] ?? 0;
  const bye = extras["bye"] ?? 0;
  const legBye = extras["legBye"] ?? 0;
  const penalty = extras["penalty"] ?? 0;
  if (wide > 0) parts.push(`Wide +${ball.total_runs}`);
  else if (noBall > 0) parts.push(`No-ball +${ball.total_runs}`);
  if (wide === 0 && bye > 0) parts.push(`${bye} ${bye === 1 ? "bye" : "byes"}`);
  if (wide === 0 && legBye > 0) parts.push(`${legBye} ${legBye === 1 ? "leg-bye" : "leg-byes"}`);
  if (wide === 0 && ball.batter_runs > 0)
    parts.push(`${ball.batter_runs} ${ball.batter_runs === 1 ? "run" : "runs"}`);
  if (penalty > 0) parts.push(`${penalty} penalty`);
  if (ball.wicket) {
    const how = dismissalNames[ball.dismissal?.type ?? ""];
    parts.push(how ? `WICKET (${how})` : "WICKET");
  }
  return parts.length ? parts.join(" · ") : "Dot ball";
}

/** Balls of one innings grouped by over, newest over first, with the runs in each over. */
export function oversOf(
  balls: readonly CheckBall[],
  inningsId: string,
): { over: number; balls: CheckBall[]; runs: number; wickets: number }[] {
  const groups = new Map<number, CheckBall[]>();
  for (const ball of [...balls]
    .filter((b) => b.innings_id === inningsId)
    .sort((a, b) => a.sequence - b.sequence)) {
    const list = groups.get(ball.over) ?? [];
    list.push(ball);
    groups.set(ball.over, list);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([over, list]) => ({
      over,
      balls: list,
      runs: list.reduce((sum, b) => sum + b.total_runs, 0),
      wickets: list.filter((b) => b.wicket).length,
    }));
}

/** Overs from legal balls, e.g. 23 balls → "3.5". */
export function oversText(legalBalls: number, ballsPerOver = 6): string {
  return `${Math.floor(legalBalls / ballsPerOver)}.${legalBalls % ballsPerOver}`;
}

export function openFlags(flags: readonly CheckFlag[]): CheckFlag[] {
  return flags.filter((flag) => flag.status === "open");
}

/** The check scorer can confirm only when every query has been answered (the database checks this too). */
export function canConfirmScorecard(flags: readonly CheckFlag[]): boolean {
  return openFlags(flags).length === 0;
}

export const flagStatusLabels: Record<FlagStatus, string> = {
  open: "Waiting for the scorer",
  fixed: "Scorer fixed it",
  kept: "Scorer kept it as is",
};
