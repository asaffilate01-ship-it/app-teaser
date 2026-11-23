/**
 * Pure geometry for the wagon wheel: where each recorded shot is drawn.
 * Angles follow field-positions.ts (degrees clockwise from the keeper for a right-handed batter,
 * leg side 0–180, off side 180–360). Line length comes from runs and the recorded depth; the exact
 * spot is not measured, so a small, stable spread per ball keeps overlapping shots readable.
 */
import { closeCatchers, ringSectors, zoneInfo, type ZoneDepth } from "./field-positions.ts";

export interface WheelBall {
  id: string;
  over: number;
  ball: number;
  strikerId: string;
  bowlerId: string;
  batterRuns: number;
  fieldZone: string | null | undefined;
  wicket: boolean;
  /** The striker bats left-handed. */
  leftHanded?: boolean | undefined;
}

/**
 * Which way round to draw the wheel: a left-hander's own view when one batter is picked and they bat
 * left-handed (or every shot shown is by left-handers); otherwise the right-hander view.
 */
export function viewHandFor(balls: readonly WheelBall[], batterId = ""): boolean {
  const scoped = batterId ? balls.filter((ball) => ball.strikerId === batterId) : balls;
  return scoped.length > 0 && scoped.every((ball) => ball.leftHanded === true);
}

/** True when the shots shown come from both right- and left-handers. */
export function mixedHands(balls: readonly WheelBall[]): boolean {
  return balls.some((ball) => ball.leftHanded === true) && balls.some((ball) => ball.leftHanded !== true);
}

export type WheelFilter = "all" | "1" | "2" | "3" | "4" | "6" | "wickets";

const closeAngles: Record<string, number> = {
  "first slip": 345, "second slip": 338, "third slip": 331, "fourth slip": 324, "fly slip": 336,
  gully: 315, "silly point": 292, "short extra cover": 252, "silly mid-off": 205,
  "leg slip": 14, "leg gully": 38, "backward short leg": 58, "short leg": 84, "short mid-wicket": 116, "silly mid-on": 156,
};
const areaAngles: Record<string, [number, number]> = {
  "fine leg": [0, 33], "square leg": [33, 99], "mid-wicket": [99, 132], "long on": [132, 165], straight: [165, 195],
  "long off": [195, 228], cover: [228, 294], point: [294, 327], third: [327, 360],
};

const key = (zone: string | null | undefined) => (zone ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** The slice of the ground (start/end angles, right-hander view) a saved position covers. */
export function zoneSpan(zone: string | null | undefined): [number, number] | null {
  const name = key(zone);
  if (!name || name === "not recorded") return null;
  for (const sector of ringSectors) {
    if (sector.inner.toLowerCase() === name || sector.deep.toLowerCase() === name) return [sector.start, sector.end];
  }
  if (name in closeAngles) {
    const a = closeAngles[name]!;
    return [a - 4, a + 4];
  }
  if (name === "keeper") return [354, 366];
  if (name === "bowler") return [174, 186];
  return areaAngles[name] ?? null;
}

/** Stable 0..1 value from a ball id, so a shot never jumps between redraws. */
export function stableSpread(id: string, salt = 0): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return ((hash >>> 0) % 10000) / 10000;
}

/** Line length as a share of the boundary radius (1 = the rope; sixes clear it). */
export function shotLength(runs: number, depth: ZoneDepth | undefined, wicket: boolean): number {
  if (runs >= 6) return 1.12;
  if (runs === 4) return 0.98;
  if (wicket || runs <= 0) return depth === "close" ? 0.16 : depth === "deep" ? 0.88 : depth === "centre" ? 0.12 : 0.4;
  if (depth === "close") return 0.2;
  if (depth === "deep") return Math.min(0.9, 0.6 + runs * 0.09);
  return Math.min(0.72, 0.28 + runs * 0.13);
}

export interface PlottedShot {
  ball: WheelBall;
  /** Degrees, right-hander or left-hander view already applied. */
  angle: number;
  length: number;
  /** End point in unit space: batter at (0,0), straight down the ground is y = -1, off side is +x for a right-hander. */
  x: number;
  y: number;
  side: "off" | "leg" | "straight";
  area: string;
}

/** Where a ball is drawn; null when no field position was recorded. */
export function plotShot(ball: WheelBall, leftHanded = false): PlottedShot | null {
  const span = zoneSpan(ball.fieldZone);
  if (!span) return null;
  const info = zoneInfo(ball.fieldZone);
  const [start, end] = span;
  const width = end - start;
  const base = start + width * (0.18 + 0.64 * stableSpread(ball.id));
  const rhAngle = ((base % 360) + 360) % 360;
  const angle = leftHanded ? (360 - rhAngle) % 360 : rhAngle;
  const length = shotLength(ball.batterRuns, info?.depth, ball.wicket) * (0.97 + 0.06 * stableSpread(ball.id, 7));
  // Keeper at the bottom, bowler at the top; off side on the right for a right-hander.
  const rad = ((angle + 90) * Math.PI) / 180;
  const x = Math.cos(rad) * length;
  const y = Math.sin(rad) * length;
  return {
    ball,
    angle,
    length,
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    side: rhAngle > 172 && rhAngle < 188 ? "straight" : rhAngle < 180 ? "leg" : "off",
    area: info?.area ?? "Not recorded",
  };
}

export function matchesFilter(ball: WheelBall, filter: WheelFilter): boolean {
  if (filter === "wickets") return ball.wicket;
  if (filter === "all") return ball.batterRuns > 0 || ball.wicket;
  if (filter === "3") return ball.batterRuns === 3 || ball.batterRuns === 5;
  return ball.batterRuns === Number(filter);
}

export interface WheelSummary {
  runs: number;
  offRuns: number;
  legRuns: number;
  straightRuns: number;
  fours: number;
  sixes: number;
  dots: number;
  scoringShots: number;
  unplacedRuns: number;
  areas: { area: string; runs: number; shots: number }[];
}

/** Bat runs split by side and area (right-hander view; sides don't flip for left-handers). */
export function summarizeWheel(balls: WheelBall[]): WheelSummary {
  const summary: WheelSummary = { runs: 0, offRuns: 0, legRuns: 0, straightRuns: 0, fours: 0, sixes: 0, dots: 0, scoringShots: 0, unplacedRuns: 0, areas: [] };
  const areas = new Map<string, { runs: number; shots: number }>();
  for (const ball of balls) {
    summary.runs += ball.batterRuns;
    if (ball.batterRuns === 0 && !ball.wicket) summary.dots += 1;
    if (ball.batterRuns > 0) summary.scoringShots += 1;
    if (ball.batterRuns === 4) summary.fours += 1;
    if (ball.batterRuns >= 6) summary.sixes += 1;
    if (ball.batterRuns <= 0) continue;
    const shot = plotShot(ball);
    if (!shot) {
      summary.unplacedRuns += ball.batterRuns;
      continue;
    }
    if (shot.side === "off") summary.offRuns += ball.batterRuns;
    else if (shot.side === "leg") summary.legRuns += ball.batterRuns;
    else summary.straightRuns += ball.batterRuns;
    const entry = areas.get(shot.area) ?? { runs: 0, shots: 0 };
    entry.runs += ball.batterRuns;
    entry.shots += 1;
    areas.set(shot.area, entry);
  }
  summary.areas = [...areas.entries()].map(([area, value]) => ({ area, ...value })).sort((a, b) => b.runs - a.runs);
  return summary;
}

export const closeCatcherNames = closeCatchers.map((catcher) => catcher.name);
