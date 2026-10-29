import test from "node:test";
import assert from "node:assert/strict";
import { buildSpatialData, initialField } from "../src/lib/spatial-analysis.ts";
import type { DeliveryEvidence } from "../src/lib/analysis.ts";
const row: DeliveryEvidence = {
  id: "a",
  innings_id: "i",
  sequence: 1,
  over_number: 1,
  ball_in_over: 1,
  striker_id: "a",
  bowler_id: "b",
  fielder_id: "f",
  delivery_style: null,
  outcome: "hit",
  batter_runs: 4,
  total_runs: 5,
  legal_ball: false,
  wicket: false,
  shot_zone: " Cover ",
  fielding_zone: "Point",
  superseded_by: null,
};
test("wagon uses current unique deliveries, recorded zones and no invented coordinates", () => {
  const d = buildSpatialData(
    [
      row,
      row,
      { ...row, id: "old", superseded_by: "a" },
      { ...row, id: "void", voided_by_event_id: "x" },
      { ...row, id: "unknown", shot_zone: null },
    ],
    [],
    "wagon",
  );
  assert.equal(d.total, 2);
  assert.equal(d.excluded, 1);
  assert.equal(d.marks[0]!.x, 29);
  assert.equal(d.marks[0]!.z, -16);
  assert.equal(d.marks[0]!.color, 0xfbbf24);
});
test("fielding uses fielding zone rather than batting direction", () => {
  const d = buildSpatialData([row], [], "fielders");
  assert.equal(d.marks[0]!.x, 34);
  assert.equal(d.marks[0]!.shape, "fielder");
});
test("pitch excludes conflicting and unclassified notes; full toss is raised", () => {
  const note = {
    discipline: "bowling" as const,
    delivery_id: "a",
    bowling_line: "off_stump",
    bowling_length: "full_toss",
  };
  assert.equal(buildSpatialData([row], [note], "pitch").marks[0]!.height, 2.5);
  const d = buildSpatialData([row], [note, { ...note, bowling_length: "good" }], "pitch");
  assert.equal(d.marks.length, 0);
  assert.equal(d.conflicting, 1);
  assert.equal(d.excluded, 1);
  assert.equal(buildSpatialData([row], [], "pitch").excluded, 1);
});
test("over chart separates innings, sorts overs, includes extras and counts legal balls", () => {
  const d = buildSpatialData(
    [
      { ...row, id: "c", innings_id: "j", total_runs: 6 },
      { ...row, id: "b", over_number: 2, legal_ball: true, total_runs: 2 },
      row,
    ],
    [],
    "overs",
  );
  assert.equal(d.marks.length, 3);
  assert.match(d.marks[0]!.label, /6 runs · 0 legal balls/);
  assert.match(d.marks[1]!.label, /over 1 · 5 runs/);
  assert.match(d.marks[2]!.label, /over 2 · 2 runs · 1 legal balls/);
  assert.equal(d.marks[0]!.height, 20);
});
test("field plan has eleven positions within the boundary", () => {
  assert.equal(initialField.length, 11);
  assert(initialField.every((f) => Math.hypot(f.x, f.z) <= 40));
});
test("progression accumulates extras per innings and preserves innings identity under filtering", () => {
  const d = buildSpatialData(
    [
      { ...row, id: "second", innings_id: "second", over_number: 2, total_runs: 7 },
      row,
      { ...row, id: "later", over_number: 3, total_runs: 2 },
    ],
    [],
    "worm",
    ["i", "second"],
  );
  assert.equal(d.excluded, 0);
  assert.equal(d.marks.length, 3);
  assert.match(d.marks[1]!.label, /7 cumulative filtered runs/);
  assert.match(d.marks[2]!.label, /Innings 2.*7 cumulative filtered runs/);
  const filtered = buildSpatialData([{ ...row, innings_id: "second" }], [], "wagon", [
    "i",
    "second",
  ]);
  assert.match(filtered.marks[0]!.label, /Innings 2/);
});

test("a selected delivery beyond the rendering cap stays visible without exceeding the cap", async () => {
  const { visibleSpatialMarks } = await import("../src/lib/spatial-analysis.ts");
  const marks = buildSpatialData(
    Array.from({ length: 510 }, (_, i) => ({ ...row, id: `d${i}` })),
    [],
    "wagon",
  ).marks;
  const visible = visibleSpatialMarks(marks, "d509");
  assert.equal(visible.length, 500);
  assert.equal(visible.at(-1)!.id, "d509");
  assert.equal(new Set(visible.map((m) => m.id)).size, 500);
  assert.equal(marks.length, 510);
  assert.deepEqual(visibleSpatialMarks(marks, "missing"), marks.slice(0, 500));
  assert.equal(visibleSpatialMarks(marks, "d2").filter((m) => m.id === "d2").length, 1);
});
