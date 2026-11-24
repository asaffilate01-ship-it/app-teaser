import type { FieldZone, ShotOutcome } from "./cricket.ts";
import { zoneArea } from "./field-positions.ts";

interface FieldedBall {
  fieldZone: FieldZone;
  fielderId?: string | undefined;
}

/**
 * The fielder who most recently stopped a ball at this position.
 * Falls back to the last fielder anywhere in the same broad area (e.g. Cover → Extra cover).
 */
export function lastFielderInZone(
  balls: readonly FieldedBall[],
  zone: FieldZone,
): string | undefined {
  if (zone === "Not recorded") return undefined;
  for (let index = balls.length - 1; index >= 0; index -= 1) {
    const ball = balls[index];
    if (ball && ball.fieldZone === zone && ball.fielderId) return ball.fielderId;
  }
  const area = zoneArea(zone);
  if (!area) return undefined;
  for (let index = balls.length - 1; index >= 0; index -= 1) {
    const ball = balls[index];
    if (ball && ball.fielderId && zoneArea(ball.fieldZone) === area) return ball.fielderId;
  }
  return undefined;
}

/** Fielder ids ordered for quick picking: the last fielder in this zone first, then recent fielders, then the rest. */
export function orderFielders(
  playerIds: readonly string[],
  balls: readonly FieldedBall[],
  zone: FieldZone,
): string[] {
  const order: string[] = [];
  const add = (id: string | undefined) => {
    if (id && playerIds.includes(id) && !order.includes(id)) order.push(id);
  };
  add(lastFielderInZone(balls, zone));
  for (let index = balls.length - 1; index >= 0; index -= 1) add(balls[index]?.fielderId);
  playerIds.forEach(add);
  return order;
}

/** Most recently used positions, newest first, without repeats — for one-tap re-use. */
export function recentZones(balls: readonly FieldedBall[], limit = 4): FieldZone[] {
  const zones: FieldZone[] = [];
  for (let index = balls.length - 1; index >= 0 && zones.length < limit; index -= 1) {
    const zone = balls[index]?.fieldZone;
    if (zone && zone !== "Not recorded" && !zones.includes(zone)) zones.push(zone);
  }
  return zones;
}

/** Picking a field area means the bat found the ball, so "left" or "missed" no longer fits. */
export function outcomeAfterZone(zone: FieldZone, current: ShotOutcome): ShotOutcome {
  if (zone === "Not recorded") return current;
  return current === "left" || current === "missed" ? "hit-no-run" : current;
}
