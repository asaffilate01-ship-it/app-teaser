import type { FieldZone, ShotOutcome } from "./cricket.ts";

/** Outfield wedges, clockwise from just right of the keeper (right-handed batter view). */
export const pickerZones = [
  "Fine leg",
  "Square leg",
  "Mid-wicket",
  "Long on",
  "Straight",
  "Long off",
  "Cover",
  "Point",
  "Third",
] as const satisfies readonly FieldZone[];

interface FieldedBall {
  fieldZone: FieldZone;
  fielderId?: string | undefined;
}

/** The fielder who most recently stopped a ball in this zone, if any. */
export function lastFielderInZone(balls: readonly FieldedBall[], zone: FieldZone): string | undefined {
  if (zone === "Not recorded") return undefined;
  for (let index = balls.length - 1; index >= 0; index -= 1) {
    const ball = balls[index];
    if (ball && ball.fieldZone === zone && ball.fielderId) return ball.fielderId;
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

/** Picking a field area means the bat found the ball, so "left" or "missed" no longer fits. */
export function outcomeAfterZone(zone: FieldZone, current: ShotOutcome): ShotOutcome {
  if (zone === "Not recorded") return current;
  return current === "left" || current === "missed" ? "hit-no-run" : current;
}
