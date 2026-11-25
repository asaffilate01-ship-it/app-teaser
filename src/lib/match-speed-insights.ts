import type { Delivery } from "./cricket.ts";
import { validateVideoSpeedEvidence, type VideoSpeedEvidence } from "./speed-evidence.ts";

export type SpeedReview =
  | { status: "reviewed"; evidence: VideoSpeedEvidence }
  | { status: "missing" | "legacy" | "invalid" };

type SpeedFields = Pick<Delivery, "speedKph" | "speedEvidence">;

/** Calculation consistency is not independent measurement certification. */
export function deliverySpeedReview(delivery: SpeedFields): SpeedReview {
  if (delivery.speedEvidence !== undefined) {
    const evidence = validateVideoSpeedEvidence(delivery.speedEvidence);
    return evidence && evidence.kph === delivery.speedKph
      ? { status: "reviewed", evidence }
      : { status: "invalid" };
  }
  if (delivery.speedKph === undefined) return { status: "missing" };
  return Number.isFinite(delivery.speedKph) && delivery.speedKph > 0
    ? { status: "legacy" }
    : { status: "invalid" };
}

/** Never show a previous ball's speed as the current delivery's reading. */
export function latestDeliverySpeed(deliveries: readonly Delivery[]) {
  const delivery = deliveries.at(-1);
  if (!delivery) return null;
  const review = deliverySpeedReview(delivery);
  return review.status === "reviewed" ? { delivery, evidence: review.evidence } : null;
}

type BowlerAccumulator = {
  bowlerId: string;
  deliveries: number;
  reviewed: number;
  legacy: number;
  invalid: number;
  missing: number;
  sum: number;
  fastest: number | null;
  slowest: number | null;
};

export function bowlingSpeedInsights(deliveries: readonly Delivery[]) {
  const groups = new Map<string, BowlerAccumulator>();
  const recent: Array<{ delivery: Delivery; evidence: VideoSpeedEvidence }> = [];
  let reviewed = 0;
  let legacy = 0;
  let invalid = 0;
  let missing = 0;
  for (const delivery of deliveries) {
    const group = groups.get(delivery.bowlerId) ?? {
      bowlerId: delivery.bowlerId,
      deliveries: 0,
      reviewed: 0,
      legacy: 0,
      invalid: 0,
      missing: 0,
      sum: 0,
      fastest: null,
      slowest: null,
    };
    group.deliveries += 1;
    const result = deliverySpeedReview(delivery);
    if (result.status === "reviewed") {
      reviewed += 1;
      group.reviewed += 1;
      const kph = result.evidence.kph;
      group.sum += kph;
      group.fastest = group.fastest === null ? kph : Math.max(group.fastest, kph);
      group.slowest = group.slowest === null ? kph : Math.min(group.slowest, kph);
      recent.push({ delivery, evidence: result.evidence });
      if (recent.length > 12) recent.shift();
    } else {
      group[result.status] += 1;
      if (result.status === "legacy") legacy += 1;
      else if (result.status === "invalid") invalid += 1;
      else missing += 1;
    }
    groups.set(delivery.bowlerId, group);
  }

  return {
    deliveries: deliveries.length,
    reviewed,
    legacy,
    invalid,
    missing,
    coveragePercent: deliveries.length ? (reviewed / deliveries.length) * 100 : 0,
    bowlers: [...groups.values()]
      .map(({ sum, ...group }) => ({
        ...group,
        average: group.reviewed ? sum / group.reviewed : null,
        coveragePercent: (group.reviewed / group.deliveries) * 100,
      }))
      .sort((a, b) => b.reviewed - a.reviewed || a.bowlerId.localeCompare(b.bowlerId)),
    recent: recent.reverse(),
  };
}
