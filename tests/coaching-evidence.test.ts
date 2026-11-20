import assert from "node:assert/strict";
import test from "node:test";
import type { DeliveryEvidence } from "../src/lib/analysis.ts";
import { summarizeCoachingEvidence } from "../src/lib/coaching-evidence.ts";

const ball = (id: string, superseded_by: string | null = null): DeliveryEvidence => ({
  id,
  innings_id: "innings-1",
  sequence: Number(id.slice(-1)) || 1,
  over_number: 0,
  ball_in_over: 1,
  striker_id: "a",
  bowler_id: "b",
  fielder_id: null,
  delivery_style: null,
  outcome: "hit",
  batter_runs: 1,
  total_runs: 1,
  legal_ball: true,
  wicket: false,
  shot_zone: null,
  fielding_zone: null,
  superseded_by,
});

test("coaching review counts only current delivered evidence and unique annotated deliveries", () => {
  const a = ball("a1");
  const b = ball("b2");
  const old = ball("c3", "a1");
  const summary = summarizeCoachingEvidence([a, b, old], new Set(["a1", "c3", "ghost"]), [
    { delivery_id: "a1", evidence_file_id: "file", evidence_time_seconds: 0 },
    { delivery_id: "a1", evidence_file_id: null, evidence_time_seconds: null },
    { delivery_id: "c3", evidence_file_id: "old-file", evidence_time_seconds: 3 },
    { delivery_id: null, evidence_file_id: null, evidence_time_seconds: null },
  ]);
  assert.deepEqual(summary, {
    currentDeliveries: 2,
    clipLinkedDeliveries: 1,
    manuallyReviewedDeliveries: 1,
    totalObservations: 4,
    historicalObservations: 1,
    sourceReferencedObservations: 2,
    timedVideoReferences: 2,
  });
});

test("empty matches and missing media are reported as empty, not invented coverage", () => {
  const zero = summarizeCoachingEvidence([], new Set(["unrelated"]), []);
  assert.equal(zero.currentDeliveries, 0);
  assert.equal(zero.clipLinkedDeliveries, 0);
  assert.equal(zero.manuallyReviewedDeliveries, 0);
  assert.equal(zero.totalObservations, 0);
});

test("voided rows and invalid time offsets are not treated as current/timed evidence", () => {
  const removed = { ...ball("c3"), voided_by_event_id: "void-1" };
  const review = summarizeCoachingEvidence([removed], new Set(["c3"]), [
    { delivery_id: "c3", evidence_file_id: "file", evidence_time_seconds: -10 },
  ]);
  assert.equal(review.currentDeliveries, 0);
  assert.equal(review.historicalObservations, 1);
  assert.equal(review.timedVideoReferences, 0);
});
