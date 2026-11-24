/** Shapes drawn over a paused clip, in canvas pixels (1280×720). */
export type Tool = "pen" | "line" | "arrow" | "circle" | "angle";
export interface Pt {
  x: number;
  y: number;
}
export interface Shape {
  tool: Tool;
  color: string;
  points: Pt[];
}

/** Angle at the middle point (degrees, 0–180) — e.g. front-knee or elbow angle. */
export function angleAt(a: Pt, vertex: Pt, b: Pt): number {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y };
  const len = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (!len) return 0;
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / len));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
}

/** Time in clip B that matches time `t` in clip A once both were lined up (e.g. at ball release). */
export const syncedTime = (t: number, offset: number, durationB: number) =>
  Math.min(Math.max(0, t + offset), Math.max(0, durationB));

/** How many taps/drags each tool needs before it is finished. */
export const pointsNeeded = (tool: Tool) => (tool === "angle" ? 3 : tool === "pen" ? Infinity : 2);
