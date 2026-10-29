import test from "node:test";
import assert from "node:assert/strict";
import { summarizeGround } from "../src/lib/analysis-ground.ts";
import {
  filterDeliveries,
  defaultAnalysisFilters,
  type DeliveryEvidence,
} from "../src/lib/analysis.ts";
const row: DeliveryEvidence = {
  id: "one",
  innings_id: "i",
  sequence: 1,
  over_number: 1,
  ball_in_over: 1,
  striker_id: "a",
  bowler_id: "b",
  fielder_id: "f",
  delivery_style: "Fast",
  outcome: "hit",
  batter_runs: 4,
  total_runs: 5,
  legal_ball: false,
  wicket: true,
  shot_zone: " Cover ",
  fielding_zone: "Point",
  superseded_by: null,
};
test("ground totals distinguish batter runs, team runs and fielding zones", () => {
  const batting = summarizeGround([row], "batting");
  assert.deepEqual(
    batting.zones.find((z) => z.name === "Cover"),
    { name: "Cover", x: 29, z: -16, deliveries: 1, runs: 4, wickets: 1 },
  );
  assert.equal(summarizeGround([row], "bowling").zones.find((z) => z.name === "Cover")?.runs, 5);
  assert.equal(summarizeGround([row], "fielding").zones.find((z) => z.name === "Point")?.runs, 5);
  assert.equal(batting.mapped, 1);
  assert.equal(batting.unmapped, 0);
});
test("unknown zones stay unplotted and voided or replaced deliveries do not count", () => {
  const result = summarizeGround(
    [
      row,
      { ...row, id: "2", shot_zone: null },
      { ...row, id: "3", shot_zone: "Not recorded" },
      { ...row, id: "4", shot_zone: "Unrecognised" },
      { ...row, id: "5", voided_by_event_id: "void" },
      { ...row, id: "6", superseded_by: "replacement" },
    ],
    "batting",
  );
  assert.equal(result.mapped, 1);
  assert.equal(result.unmapped, 3);
  assert.equal(
    result.zones.reduce((n, z) => n + z.runs, 0),
    4,
  );
});
test("ground uses the filtered subset and preserves exact counts for repeated zones", () => {
  const rows = [
    row,
    { ...row, id: "2", striker_id: "other" },
    { ...row, id: "3", batter_runs: 6, total_runs: 6 },
  ];
  const filtered = filterDeliveries(rows, { ...defaultAnalysisFilters, player: "a" });
  const result = summarizeGround(filtered, "batting");
  assert.equal(result.mapped, 2);
  assert.equal(result.zones.find((z) => z.name === "Cover")?.runs, 10);
  assert.equal(
    summarizeGround([], "fielding").zones.every((z) => z.deliveries === 0),
    true,
  );
});
