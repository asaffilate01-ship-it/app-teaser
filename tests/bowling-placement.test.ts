import test from "node:test";
import assert from "node:assert/strict";
import { summarizeBowlingPlacement } from "../src/lib/bowling-placement.ts";
import type { DeliveryEvidence } from "../src/lib/analysis.ts";
import type { CoachingAnnotation } from "../src/lib/coaching.ts";
const row: DeliveryEvidence = {
  id: "d1",
  innings_id: "i",
  sequence: 1,
  over_number: 1,
  ball_in_over: 1,
  striker_id: "a",
  bowler_id: "b",
  fielder_id: null,
  delivery_style: "Fast",
  outcome: "hit",
  batter_runs: 4,
  total_runs: 5,
  legal_ball: false,
  wicket: true,
  shot_zone: "Cover",
  fielding_zone: null,
  superseded_by: null,
};
const note: CoachingAnnotation = {
  discipline: "bowling",
  delivery_id: "d1",
  bowling_line: "off_stump",
  bowling_length: "good",
};
test("repeated agreeing annotations and delivery rows count once with team extras and wicket events", () => {
  const result = summarizeBowlingPlacement([row, row], [note, note]);
  const cell = result.cells.find((c) => c.key === "good:off_stump")!;
  assert.equal(result.total, 1);
  assert.equal(result.mapped, 1);
  assert.equal(cell.deliveries.length, 1);
  assert.equal(cell.runs, 5);
  assert.equal(cell.wickets, 1);
});
test("disagreements including contradictory partial notes remain excluded regardless of note order", () => {
  for (const notes of [
    [note, { ...note, bowling_line: "leg_stump" }],
    [{ ...note, bowling_line: "leg_stump" }, note],
    [note, { ...note, bowling_length: null, bowling_line: "outside_off" }],
  ]) {
    const result = summarizeBowlingPlacement([row], notes);
    assert.equal(result.conflicting.length, 1);
    assert.equal(result.mapped, 0);
    assert.equal(result.unclassified.length, 0);
  }
});
test("separate partial notes, unsupported values and whole-match notes cannot create a complete classification", () => {
  for (const notes of [
    [
      { ...note, bowling_line: null },
      { ...note, bowling_length: null },
    ],
    [{ ...note, bowling_line: "invented" }],
    [{ ...note, delivery_id: null }],
    [{ ...note, discipline: "batting" as const }],
    [],
  ]) {
    const result = summarizeBowlingPlacement([row], notes);
    assert.equal(result.unclassified.length, 1);
    assert.equal(result.mapped, 0);
  }
});
test("filtered-out, voided and superseded rows and their notes do not contribute", () => {
  const result = summarizeBowlingPlacement(
    [
      row,
      { ...row, id: "void", voided_by_event_id: "e" },
      { ...row, id: "old", superseded_by: "new" },
    ],
    [
      note,
      { ...note, delivery_id: "not-in-filter" },
      { ...note, delivery_id: "void" },
      { ...note, delivery_id: "old" },
    ],
  );
  assert.equal(result.total, 1);
  assert.equal(result.mapped, 1);
  assert.equal(
    result.cells.reduce((sum, c) => sum + c.runs, 0),
    5,
  );
});
test("full tosses have a distinct category and coverage counts partition current deliveries", () => {
  const result = summarizeBowlingPlacement(
    [row, { ...row, id: "d2" }, { ...row, id: "d3" }],
    [
      { ...note, bowling_length: "full_toss" },
      { ...note, delivery_id: "d2" },
      { ...note, delivery_id: "d2", bowling_length: "short" },
    ],
  );
  assert.equal(result.cells.find((c) => c.key === "full_toss:off_stump")?.deliveries.length, 1);
  assert.equal(
    result.mapped + result.conflicting.length + result.unclassified.length,
    result.total,
  );
  assert.equal(result.total, 3);
  assert.equal(summarizeBowlingPlacement([], []).cells.length, 25);
});
