import assert from "node:assert/strict";
import test from "node:test";
import { buildCoachReviewQueue } from "../src/lib/coaching-review-queue.ts";
import type { DeliveryEvidence } from "../src/lib/analysis.ts";

const base: DeliveryEvidence = {
  id: "one",
  innings_id: "innings",
  sequence: 1,
  over_number: 1,
  ball_in_over: 3,
  striker_id: "striker",
  bowler_id: "bowler",
  fielder_id: null,
  delivery_style: "Medium",
  outcome: "hit-no-run",
  batter_runs: 0,
  total_runs: 0,
  legal_ball: true,
  wicket: false,
  shot_zone: "cover",
  fielding_zone: null,
  superseded_by: null,
  voided_by_event_id: null,
};

test("review queue prioritises unreviewed wickets then boundaries without inventing video evidence", () => {
  const items = buildCoachReviewQueue(
    [
      { ...base, id: "ordinary" },
      { ...base, id: "boundary", sequence: 3, batter_runs: 4 },
      { ...base, id: "wicket", sequence: 2, wicket: true },
      { ...base, id: "six", sequence: 4, batter_runs: 6 },
    ],
    new Set(["boundary"]),
    [],
  );
  assert.deepEqual(items.map((i) => i.deliveryId), ["wicket", "boundary", "six"]);
  assert.equal(items[0]?.hasClip, false);
  assert.equal(items[1]?.hasClip, true);
  assert.equal(items[0]?.ball, "1.3");
});

test("reviewed deliveries are skipped unless a wicket still has no linked clip", () => {
  const wicket = { ...base, id: "wicket", wicket: true };
  const boundary = { ...base, id: "boundary", batter_runs: 4 };
  const notes = [{ delivery_id: "wicket" }, { delivery_id: "boundary" }];
  assert.deepEqual(
    buildCoachReviewQueue([wicket, boundary], new Set(["wicket", "boundary"]), notes),
    [],
  );
  const one = buildCoachReviewQueue([wicket, boundary], new Set(), notes);
  assert.equal(one.length, 1);
  assert.match(one[0]!.reason, /No delivery-linked clip/);
});

test("voided, superseded and repeated deliveries do not receive review proposals", () => {
  const rows = [
    { ...base, wicket: true, voided_by_event_id: "void" },
    { ...base, id: "old", wicket: true, superseded_by: "new" },
    { ...base, id: "current", wicket: true, sequence: 9 },
    { ...base, id: "current", wicket: true, sequence: 9 },
  ];
  assert.deepEqual(
    buildCoachReviewQueue(rows, new Set(), []).map((item) => item.deliveryId),
    ["current"],
  );
});

test("uncategorised deliveries and worklist limits use only recorded fields", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    ...base,
    id: String(index),
    sequence: index + 1,
    shot_zone: null,
  }));
  assert.equal(buildCoachReviewQueue(rows, new Set(), [], 3).length, 3);
  assert.equal(buildCoachReviewQueue(rows, new Set(), [], 0).length, 0);
  assert.equal(buildCoachReviewQueue(rows, new Set(), [], 100).length, 12);
  assert.match(buildCoachReviewQueue(rows, new Set(), [])[0]!.reason, /unknown/);
});
