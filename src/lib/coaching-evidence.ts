import { isCurrentDelivery, type DeliveryEvidence } from "./analysis.ts";

export type CoachingEvidenceReference = {
  delivery_id: string | null;
  evidence_file_id: string | null;
  evidence_time_seconds: number | null;
};

/**
 * Coverage of reviewable records, not a video-inference quality score.
 * Never count superseded/voided deliveries as current, and never infer
 * consent or the availability of a private signed media URL from a link.
 */
export function summarizeCoachingEvidence(
  deliveries: DeliveryEvidence[],
  linkedClipDeliveryIds: ReadonlySet<string>,
  notes: CoachingEvidenceReference[],
) {
  const currentIds = new Set(deliveries.filter(isCurrentDelivery).map((d) => d.id));
  const linkedDeliveryCount = [...currentIds].filter((id) => linkedClipDeliveryIds.has(id)).length;
  const reviewedDeliveryIds = new Set(
    notes.map((n) => n.delivery_id).filter((id): id is string => !!id && currentIds.has(id)),
  );
  const historicalObservations = notes.filter(
    (note) => note.delivery_id !== null && !currentIds.has(note.delivery_id),
  ).length;
  const sourceReferencedObservations = notes.filter((note) => !!note.evidence_file_id).length;
  const timedVideoReferences = notes.filter(
    (note) =>
      !!note.evidence_file_id &&
      note.evidence_time_seconds !== null &&
      Number.isFinite(note.evidence_time_seconds) &&
      note.evidence_time_seconds >= 0,
  ).length;

  return {
    currentDeliveries: currentIds.size,
    clipLinkedDeliveries: linkedDeliveryCount,
    manuallyReviewedDeliveries: reviewedDeliveryIds.size,
    totalObservations: notes.length,
    historicalObservations,
    sourceReferencedObservations,
    timedVideoReferences,
  };
}
