import { isCurrentDelivery, type DeliveryEvidence } from "./analysis";

export type CoachReviewSuggestion = {
  deliveryId: string;
  ball: string;
  label: string;
  reason: string;
  priority: number;
  hasClip: boolean;
};

/**
 * A deterministic coach worklist based entirely on recorded match facts.
 * This is NOT model inference and never claims that video has been analysed.
 * Signed playback URLs, consents and human permissions remain server controlled.
 */
export function buildCoachReviewQueue(
  deliveries: DeliveryEvidence[],
  linkedClipDeliveryIds: ReadonlySet<string>,
  notes: ReadonlyArray<{ delivery_id: string | null }>,
  limit = 8,
): CoachReviewSuggestion[] {
  const reviewed = new Set(notes.map((n) => n.delivery_id).filter((id): id is string => !!id));
  const seen = new Set<string>();
  const candidates: Array<CoachReviewSuggestion & { sequence: number }> = [];

  for (const delivery of deliveries) {
    if (!isCurrentDelivery(delivery) || !delivery.id || seen.has(delivery.id)) continue;
    seen.add(delivery.id);
    const hasClip = linkedClipDeliveryIds.has(delivery.id);
    const hasNote = reviewed.has(delivery.id);
    let priority: number;
    let label: string;
    let reason: string;
    if (delivery.wicket && !hasNote) {
      priority = 0;
      label = "Wicket";
      reason = "No coaching observation yet";
    } else if ([4, 6].includes(delivery.batter_runs) && !hasNote) {
      priority = 1;
      label = `${delivery.batter_runs} runs`;
      reason = "Boundary awaiting coach review";
    } else if (delivery.wicket && !hasClip) {
      priority = 2;
      label = "Wicket";
      reason = "No delivery-linked clip";
    } else if (!delivery.shot_zone && !hasNote) {
      priority = 3;
      label = "Unclassified delivery";
      reason = "Recorded shot zone is unknown";
    } else {
      continue;
    }
    candidates.push({
      deliveryId: delivery.id,
      ball: `${delivery.over_number}.${delivery.ball_in_over}`,
      label,
      reason,
      priority,
      hasClip,
      sequence: delivery.sequence,
    });
  }

  const bounded = Number.isFinite(limit) ? Math.max(0, Math.min(30, Math.floor(limit))) : 8;
  return candidates
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.sequence - b.sequence ||
        a.deliveryId.localeCompare(b.deliveryId),
    )
    .slice(0, bounded)
    .map(({ sequence: _sequence, ...suggestion }) => {
      void _sequence;
      return suggestion;
    });
}
