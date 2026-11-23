/**
 * TV-style stream overlay, built from the public live state. Player names appear only when the
 * database handed them out for this board (same rule as the ground screen); otherwise batting numbers.
 */
import { buildGroundBoard, type PublicBoardInput } from "./ground-board.ts";
import { chaseState } from "./match-broadcast.ts";

export interface OverlayBatter {
  key: string;
  name: string;
  runs: number;
  balls: number;
  onStrike: boolean;
}

export interface OverlayFeed {
  battingName: string;
  battingCode: string;
  bowlingCode: string;
  runs: number;
  wickets: number;
  overs: string;
  oversLimit: number | null;
  batters: OverlayBatter[];
  bowler: { name: string; figures: string; overs: string } | null;
  recent: Array<{ label: string; kind: "wicket" | "boundary" | "extra" | "dot" | "run" }>;
  /** Short facts that rotate in the side tab, most important first. */
  facts: string[];
  /** One line that matters most right now (chase, result, rain). */
  headline: string;
  freeHit: boolean;
  superOver: boolean;
  stopped: string | null;
  finished: boolean;
}

const num = (value: unknown, fallback = 0) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

/** Three-to-four letter code for a team ("Riverside CC" -> "RIV", "Kingsmead" -> "KIN"). */
export function teamCode(team: { name: string; shortName?: string | null }): string {
  const short = (team.shortName ?? "").trim();
  if (short && short.length <= 5) return short.toUpperCase();
  const words = team.name.replace(/\b(cc|cricket club|club|xi)\b/gi, "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  return (words[0] ?? team.name).slice(0, 3).toUpperCase();
}

const oversToBalls = (overs: string, bpo: number) => {
  const m = /^(\d+)\.(\d+)$/.exec(overs);
  return m ? Number(m[1]) * bpo + Number(m[2]) : 0;
};

export function buildOverlayFeed(board: PublicBoardInput, names: Readonly<Record<string, string>> = {}): OverlayFeed {
  const state = (board.liveState ?? {}) as Record<string, unknown>;
  const ground = buildGroundBoard(board, names);
  const battingId = state["battingTeamId"];
  const batting = battingId === board.awayTeam.id ? board.awayTeam : board.homeTeam;
  const bowling = batting.id === board.homeTeam.id ? board.awayTeam : board.homeTeam;
  const settings = (state["settings"] ?? {}) as Record<string, unknown>;
  const bpo = num(settings["ballsPerOver"], 6) || 6;
  const runs = num(state["runs"]);
  const wickets = num(state["wickets"]);
  const overs = typeof state["overs"] === "string" ? (state["overs"] as string) : "0.0";
  const superOver = state["superOver"] === true;
  const oversLimit =
    state["oversLimit"] !== undefined
      ? (state["oversLimit"] as number | null)
      : superOver
        ? 1
        : (settings["oversPerInnings"] as number | null | undefined) ?? null;
  const legal = oversToBalls(overs, bpo);
  const target = typeof state["target"] === "number" ? (state["target"] as number) : null;
  const chase = chaseState(target, runs, legal, oversLimit, bpo);
  const result = typeof state["result"] === "string" && state["result"] ? (state["result"] as string) : null;
  const stoppage = state["stoppage"] as Record<string, unknown> | null | undefined;
  const stopped = stoppage && typeof stoppage["reason"] === "string" ? String(stoppage["reason"]).replaceAll("-", " ") : null;

  // Batters at the crease: striker first. Fall back to the simple striker / non-striker figures.
  let batters: OverlayBatter[] = ground.batting
    .filter((b) => b.atCrease)
    .sort((a, b) => Number(b.onStrike) - Number(a.onStrike))
    .slice(0, 2)
    .map((b) => ({ key: `n${b.no}`, name: b.name, runs: b.runs, balls: b.balls, onStrike: b.onStrike }));
  if (batters.length === 0) {
    const s = state["striker"] as Record<string, unknown> | null | undefined;
    const ns = state["nonStriker"] as Record<string, unknown> | null | undefined;
    if (s) batters.push({ key: "striker", name: "Striker", runs: num(s["runs"]), balls: num(s["balls"]), onStrike: true });
    if (ns) batters.push({ key: "non-striker", name: "Non-striker", runs: num(ns["runs"]), balls: num(ns["balls"]), onStrike: false });
  }
  const current = ground.bowling.find((b) => b.current);
  const simpleBowler = state["bowler"] as Record<string, unknown> | null | undefined;
  const bowler = current
    ? { name: current.name, figures: `${current.wickets}-${current.runs}`, overs: current.overs }
    : simpleBowler
      ? { name: "Bowler", figures: `${num(simpleBowler["wickets"])}-${num(simpleBowler["runs"])}`, overs: String(simpleBowler["overs"] ?? "0.0") }
      : null;

  const recent = (Array.isArray(state["recent"]) ? (state["recent"] as Record<string, unknown>[]) : []).slice(-6).map((ball) => {
    const label = String(ball["label"] ?? "·");
    const kind: OverlayFeed["recent"][number]["kind"] =
      ball["kind"] === "wicket" ? "wicket" : ball["kind"] === "boundary" ? "boundary" : /^(Wd|Nb)/.test(label) ? "extra" : label === "·" || label === "0" ? "dot" : "run";
    return { label: label === "0" ? "·" : label, kind };
  });

  const crr = legal > 0 ? (runs * bpo) / legal : null;
  const facts: string[] = [];
  if (chase?.requiredRate != null && chase.runsNeeded > 0) facts.push(`Req. rate ${chase.requiredRate.toFixed(2)}`);
  if (crr != null) facts.push(`Run rate ${crr.toFixed(2)}`);
  if (ground.partnership && ground.partnership.balls > 0) facts.push(`Partnership ${ground.partnership.runs} (${ground.partnership.balls})`);
  if (typeof state["par"] === "number") facts.push(`Par ${state["par"]}`);
  if (target != null && !(chase && chase.runsNeeded > 0)) facts.push(`Target ${target}`);

  const headline = result
    ? result
    : stopped
      ? `Play stopped · ${stopped}`
      : chase && chase.runsNeeded > 0
        ? chase.ballsLeft != null
          ? `Need ${chase.runsNeeded} from ${chase.ballsLeft} ball${chase.ballsLeft === 1 ? "" : "s"}`
          : `Need ${chase.runsNeeded} to win`
        : target != null
          ? `Target ${target}`
          : `v ${teamCode(bowling)}`;

  return {
    battingName: batting.shortName || batting.name,
    battingCode: teamCode(batting),
    bowlingCode: teamCode(bowling),
    runs,
    wickets,
    overs,
    oversLimit,
    batters,
    bowler,
    recent,
    facts,
    headline,
    freeHit: state["freeHit"] === true,
    superOver,
    stopped,
    finished: Boolean(result) || board.status === "completed",
  };
}

export type OverlayMomentKind = "four" | "six" | "wicket" | "fifty" | "hundred";
export interface OverlayMoment {
  kind: OverlayMomentKind;
  title: string;
  detail: string;
}

/**
 * The big "sting" to flash between two feeds: a milestone beats a boundary, a wicket beats both.
 * Null when nothing new happened (or on the very first load).
 */
export function detectMoment(prev: OverlayFeed | null, next: OverlayFeed): OverlayMoment | null {
  if (!prev) return null;
  const sameBall = prev.runs === next.runs && prev.wickets === next.wickets && prev.overs === next.overs;
  if (sameBall) return null;
  if (next.wickets > prev.wickets) return { kind: "wicket", title: "WICKET", detail: `${next.battingCode} ${next.runs}-${next.wickets}` };
  for (const batter of next.batters) {
    const before = prev.batters.find((b) => b.key === batter.key);
    if (!before) continue;
    if (before.runs < 100 && batter.runs >= 100) return { kind: "hundred", title: "HUNDRED", detail: `${batter.name} ${batter.runs} (${batter.balls})` };
    if (before.runs < 50 && batter.runs >= 50) return { kind: "fifty", title: "FIFTY", detail: `${batter.name} ${batter.runs} (${batter.balls})` };
  }
  const last = next.recent.at(-1);
  if (last?.kind === "boundary") {
    const striker = next.batters.find((b) => b.onStrike) ?? next.batters[0];
    const who = striker ? `${striker.name} ${striker.runs} (${striker.balls})` : `${next.battingCode} ${next.runs}-${next.wickets}`;
    if (last.label === "6") return { kind: "six", title: "SIX", detail: who };
    if (last.label === "4") return { kind: "four", title: "FOUR", detail: who };
  }
  return null;
}
