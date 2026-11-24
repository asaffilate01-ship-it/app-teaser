import { chaseState } from "./match-broadcast.ts";

/** Name-free figures a ground (LED) scoreboard needs, built from the public live state. */
export interface GroundFeed {
  status: string;
  battingTeam: string;
  bowlingTeam: string;
  runs: number;
  wickets: number;
  overs: string;
  oversLimit: number | null;
  target: number | null;
  runsNeeded: number | null;
  ballsLeft: number | null;
  runRate: number | null;
  requiredRate: number | null;
  par: number | null;
  batter1: { runs: number; balls: number } | null;
  batter2: { runs: number; balls: number } | null;
  bowler: { wickets: number; runs: number; overs: string } | null;
  lastBalls: string[];
  freeHit: boolean;
  superOver: boolean;
  result: string | null;
}

type Team = { id: string; name: string; shortName?: string | null };
interface PublicBoard {
  status?: string;
  homeTeam: Team;
  awayTeam: Team;
  liveState?: Record<string, unknown> | null;
}

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const figures = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  return { runs: num(raw["runs"]) ?? 0, balls: num(raw["balls"]) ?? 0 };
};
const label = (team: Team) => (team.shortName?.trim() || team.name).slice(0, 24);

export function buildGroundFeed(board: PublicBoard): GroundFeed {
  const state = (board.liveState ?? {}) as Record<string, unknown>;
  const settings = (state["settings"] ?? {}) as Record<string, unknown>;
  const bpo = num(settings["ballsPerOver"]) ?? 6;
  const batting = state["battingTeamId"] === board.awayTeam.id ? board.awayTeam : board.homeTeam;
  const bowling = batting.id === board.homeTeam.id ? board.awayTeam : board.homeTeam;
  const overs = typeof state["overs"] === "string" ? (state["overs"] as string) : "0.0";
  const parts = /^(\d+)\.(\d+)$/.exec(overs);
  const legal = parts ? Number(parts[1]) * bpo + Number(parts[2]) : 0;
  const runs = num(state["runs"]) ?? 0;
  const superOver = state["superOver"] === true;
  const oversLimit =
    "oversLimit" in state
      ? num(state["oversLimit"])
      : superOver
        ? 1
        : num(settings["oversPerInnings"]);
  const target = num(state["target"]);
  const chase = chaseState(target, runs, legal, oversLimit, bpo);
  const bowler =
    state["bowler"] && typeof state["bowler"] === "object"
      ? (state["bowler"] as Record<string, unknown>)
      : null;
  const recent = Array.isArray(state["recent"])
    ? (state["recent"] as Array<Record<string, unknown>>)
    : [];
  return {
    status: board.status ?? "scheduled",
    battingTeam: label(batting),
    bowlingTeam: label(bowling),
    runs,
    wickets: num(state["wickets"]) ?? 0,
    overs,
    oversLimit,
    target,
    runsNeeded: chase ? chase.runsNeeded : null,
    ballsLeft: chase ? chase.ballsLeft : null,
    runRate: legal > 0 ? Math.round(((runs * bpo) / legal) * 100) / 100 : null,
    requiredRate: chase?.requiredRate != null ? Math.round(chase.requiredRate * 100) / 100 : null,
    par: num(state["par"]),
    batter1: figures(state["striker"]),
    batter2: figures(state["nonStriker"]),
    bowler: bowler
      ? {
          wickets: num(bowler["wickets"]) ?? 0,
          runs: num(bowler["runs"]) ?? 0,
          overs: String(bowler["overs"] ?? "0.0"),
        }
      : null,
    lastBalls: recent
      .slice(-6)
      .filter((ball) => ball && typeof ball === "object")
      .map((ball) => (typeof ball["label"] === "string" ? ball["label"] : "")),
    freeHit: state["freeHit"] === true,
    superOver,
    result: typeof state["result"] === "string" ? (state["result"] as string) : null,
  };
}

/** One "KEY VALUE" pair per line, uppercase keys — the simplest format scoreboard controllers can read. */
export function groundFeedText(feed: GroundFeed): string {
  const rows: Array<[string, string | number | null]> = [
    ["BATTING", feed.battingTeam],
    ["TOTAL", feed.runs],
    ["WICKETS", feed.wickets],
    ["OVERS", feed.overs],
    ["TARGET", feed.target],
    ["NEED", feed.runsNeeded],
    ["BALLS_LEFT", feed.ballsLeft],
    ["RUN_RATE", feed.runRate?.toFixed(2) ?? null],
    ["REQ_RATE", feed.requiredRate?.toFixed(2) ?? null],
    ["PAR", feed.par],
    ["BAT1", feed.batter1 ? `${feed.batter1.runs} (${feed.batter1.balls})` : null],
    ["BAT2", feed.batter2 ? `${feed.batter2.runs} (${feed.batter2.balls})` : null],
    [
      "BOWLER",
      feed.bowler ? `${feed.bowler.wickets}-${feed.bowler.runs} (${feed.bowler.overs})` : null,
    ],
    ["LAST6", feed.lastBalls.join(" ")],
    ["RESULT", feed.result],
  ];
  // Ground controllers parse one record per line. Never let a user-supplied label add a key.
  return (
    rows
      .map(([key, value]) => `${key} ${String(value ?? "-").replace(/[\r\n\u2028\u2029]/g, " ")}`)
      .join("\n") + "\n"
  );
}
