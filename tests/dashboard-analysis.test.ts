import test from "node:test";
import assert from "node:assert/strict";
import { dashboardAnalysis } from "../src/lib/dashboard-analysis.ts";
import type { DeliveryEvidence } from "../src/lib/analysis.ts";
const row: DeliveryEvidence = {
  id: "a",
  innings_id: "i",
  sequence: 1,
  over_number: 0,
  ball_in_over: 1,
  striker_id: "bat",
  bowler_id: "bowl",
  fielder_id: "field",
  delivery_style: null,
  outcome: "runs",
  batter_runs: 4,
  total_runs: 5,
  legal_ball: false,
  wicket: false,
  shot_zone: "Cover",
  fielding_zone: "Cover",
  superseded_by: null,
};
test("run rate includes extras but uses legal balls and avoids division by zero", () => {
  const d = dashboardAnalysis([
    row,
    { ...row, id: "b", over_number: 1, legal_ball: true, total_runs: 1, batter_runs: 1 },
  ]);
  assert.equal(d.series[0]!.points[0]!.rate, null);
  assert.equal(d.series[0]!.points[1]!.rate, 36);
  assert.equal(d.series[0]!.points[1]!.runs, 6);
});
test("innings, duplicate and superseded records stay separate and contributions use correct fields", () => {
  const d = dashboardAnalysis(
    [
      row,
      row,
      { ...row, id: "old", superseded_by: "a" },
      { ...row, id: "void", voided_by_event_id: "x" },
      { ...row, id: "c", innings_id: "j", legal_ball: true, total_runs: 2 },
    ],
    ["i", "j"],
  );
  assert.equal(d.series.length, 2);
  assert.equal(d.series[1]!.points[0]!.rate, 12);
  assert.equal(d.batters[0]!.runs, 8);
  assert.equal(d.bowlers[0]!.deliveries, 2);
  assert.equal(d.fielders[0]!.deliveries, 2);
});
test("filtered innings retain labels and absent fielders produce no invented contributors", () => {
  const d = dashboardAnalysis([{ ...row, innings_id: "j", fielder_id: null }], ["i", "j"]);
  assert.equal(d.series[0]!.label, "Innings 2");
  assert.deepEqual(d.fielders, []);
  assert.deepEqual(dashboardAnalysis([]).series, []);
});
