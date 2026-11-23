import { buildGroundFeed, type GroundFeed } from "./ground-feed.ts";

/** Pages a ground (big) screen can rotate through. */
export const groundPageIds = ["score", "batting", "bowling", "manhattan", "worm", "chase"] as const;
export type GroundPageId = (typeof groundPageIds)[number];

export const groundPageLabels: Record<GroundPageId, string> = {
  score: "Scoreboard",
  batting: "Batting",
  bowling: "Bowling",
  manhattan: "Manhattan",
  worm: "Worm",
  chase: "Run chase",
};

export type ReplayMode = "off" | "manual" | "auto";

export interface GroundScreenSettings {
  mode: "auto" | "manual";
  pages: GroundPageId[];
  intervalSeconds: number;
  manualPage: GroundPageId;
  replays: ReplayMode;
  showNames: boolean;
}

export const defaultGroundSettings: GroundScreenSettings = {
  mode: "auto",
  pages: [...groundPageIds],
  intervalSeconds: 15,
  manualPage: "score",
  replays: "off",
  showNames: false,
};

export const minPageSeconds = 5;
export const maxPageSeconds = 120;

const isPage = (value: unknown): value is GroundPageId => groundPageIds.includes(value as GroundPageId);

/** Reads saved or public settings defensively; unknown values fall back to the defaults. */
export function readGroundSettings(raw: unknown): GroundScreenSettings {
  if (!raw || typeof raw !== "object") return { ...defaultGroundSettings, pages: [...defaultGroundSettings.pages] };
  const value = raw as Record<string, unknown>;
  const pages = Array.isArray(value["pages"]) ? groundPageIds.filter((id) => (value["pages"] as unknown[]).includes(id)) : [];
  const interval = Number(value["intervalSeconds"] ?? value["interval_seconds"]);
  const replays = value["replays"];
  const manual = value["manualPage"] ?? value["manual_page"];
  return {
    mode: value["mode"] === "manual" ? "manual" : "auto",
    pages: pages.length ? pages : [...groundPageIds],
    intervalSeconds: Number.isFinite(interval) ? Math.min(maxPageSeconds, Math.max(minPageSeconds, Math.round(interval))) : 15,
    manualPage: isPage(manual) ? manual : "score",
    replays: replays === "manual" || replays === "auto" ? replays : "off",
    showNames: (value["showNames"] ?? value["show_names"]) === true,
  };
}

export interface BattingLine {
  no: number;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number | null;
  how: string;
  atCrease: boolean;
  onStrike: boolean;
}

export interface BowlingLine {
  no: number;
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  current: boolean;
}

export interface InningsProgress {
  team: string;
  superOver: boolean;
  /** [runs, wickets] for each over, in order. */
  overs: Array<[number, number]>;
}

export interface GroundBoard {
  feed: GroundFeed;
  batting: BattingLine[];
  bowling: BowlingLine[];
  extras: number;
  progress: InningsProgress[];
  partnership: { runs: number; balls: number } | null;
  homeTeam: string;
  awayTeam: string;
  sponsor: string | null;
}

type Team = { id: string; name: string; shortName?: string | null };
export interface PublicBoardInput {
  status?: string;
  homeTeam: Team;
  awayTeam: Team;
  liveState?: Record<string, unknown> | null;
  sponsor?: Record<string, unknown> | null;
}

const num = (value: unknown, fallback = 0) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const howOut = (type: unknown) => (typeof type === "string" && type ? type.replaceAll("-", " ") : "not out");

/**
 * Builds every ground-screen page from the public, name-free live state. Names appear only when the
 * database handed them out for this board (club switched names on; juniors need granted consent).
 */
export function buildGroundBoard(board: PublicBoardInput, names: Readonly<Record<string, string>> = {}): GroundBoard {
  const state = (board.liveState ?? {}) as Record<string, unknown>;
  const card = (state["card"] ?? {}) as Record<string, unknown>;
  const label = (prefix: string, row: Record<string, unknown>) => {
    const ref = typeof row["ref"] === "string" ? (row["ref"] as string) : "";
    return (ref && names[ref]) || `${prefix} ${num(row["no"])}`;
  };
  const batting = (Array.isArray(card["batting"]) ? (card["batting"] as Record<string, unknown>[]) : []).map((row) => {
    const runs = num(row["runs"]);
    const balls = num(row["balls"]);
    return {
      no: num(row["no"]),
      name: label("No.", row),
      runs,
      balls,
      fours: num(row["fours"]),
      sixes: num(row["sixes"]),
      strikeRate: balls > 0 ? Math.round((runs * 1000) / balls) / 10 : null,
      how: howOut(row["how"]),
      atCrease: row["atCrease"] === true,
      onStrike: row["onStrike"] === true,
    };
  });
  const bowling = (Array.isArray(card["bowling"]) ? (card["bowling"] as Record<string, unknown>[]) : []).map((row) => ({
    no: num(row["no"]),
    name: label("Bowler", row),
    overs: String(row["overs"] ?? "0.0"),
    maidens: num(row["maidens"]),
    runs: num(row["runs"]),
    wickets: num(row["wickets"]),
    economy: num(row["economy"]),
    current: row["current"] === true,
  }));
  const teamName = (id: unknown) =>
    id === board.awayTeam.id ? board.awayTeam.shortName || board.awayTeam.name : board.homeTeam.shortName || board.homeTeam.name;
  const progress = (Array.isArray(state["progress"]) ? (state["progress"] as Record<string, unknown>[]) : []).map((item) => ({
    team: teamName(item["battingTeamId"]),
    superOver: item["superOver"] === true,
    overs: (Array.isArray(item["overs"]) ? (item["overs"] as unknown[]) : []).map((over): [number, number] =>
      Array.isArray(over) ? [num(over[0]), num(over[1])] : [0, 0],
    ),
  }));
  const stand = state["partnership"] as Record<string, unknown> | undefined;
  const sponsorName = board.sponsor && typeof board.sponsor["name"] === "string" ? (board.sponsor["name"] as string) : null;
  return {
    feed: buildGroundFeed(board),
    batting,
    bowling,
    extras: num(card["extras"]),
    progress,
    partnership: stand ? { runs: num(stand["runs"]), balls: num(stand["balls"]) } : null,
    homeTeam: board.homeTeam.name,
    awayTeam: board.awayTeam.name,
    sponsor: sponsorName,
  };
}

/** Pages that have something to show right now (no empty charts, chase only when there is a target). */
export function availablePages(board: GroundBoard): GroundPageId[] {
  const hasOvers = board.progress.some((innings) => innings.overs.length > 0);
  return groundPageIds.filter((id) => {
    switch (id) {
      case "score":
        return true;
      case "batting":
        return board.batting.length > 0;
      case "bowling":
        return board.bowling.length > 0;
      case "manhattan":
      case "worm":
        return hasOvers;
      case "chase":
        return board.feed.target != null && !board.feed.result;
    }
  });
}

/**
 * Which page is on screen. Automatic mode follows the wall clock so every screen at the ground turns
 * the page together; manual mode holds the page the club picked (or the scoreboard if it has nothing yet).
 */
export function pageOnScreen(
  settings: GroundScreenSettings,
  available: readonly GroundPageId[],
  nowMs: number,
): { page: GroundPageId; index: number; count: number; progress: number } {
  const rotation = settings.pages.filter((id) => available.includes(id));
  if (settings.mode === "manual" || rotation.length <= 1) {
    const page = settings.mode === "manual" && available.includes(settings.manualPage) ? settings.manualPage : (rotation[0] ?? "score");
    return { page, index: Math.max(0, rotation.indexOf(page)), count: Math.max(1, rotation.length), progress: 0 };
  }
  const intervalMs = settings.intervalSeconds * 1000;
  const tick = Math.floor(nowMs / intervalMs);
  const index = tick % rotation.length;
  return { page: rotation[index]!, index, count: rotation.length, progress: (nowMs % intervalMs) / intervalMs };
}

/** Cumulative total at the end of each over (starts at 0) for the worm chart. */
export function wormLine(overs: ReadonlyArray<readonly [number, number]>): number[] {
  const line = [0];
  for (const [runs] of overs) line.push(line.at(-1)! + runs);
  return line;
}
