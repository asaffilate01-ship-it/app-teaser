import test from "node:test";
import assert from "node:assert/strict";
import { emptyCoachingFields, validateCoaching, coachingCsv } from "../src/lib/coaching.ts";
import {
  filterDeliveries,
  defaultAnalysisFilters,
  type DeliveryEvidence,
} from "../src/lib/analysis.ts";
const row = { id: "d", striker_id: "b", superseded_by: null } as DeliveryEvidence;
test("classification predicates must match one observation, the same delivery and discipline", () => {
  const filters = {
    ...defaultAnalysisFilters,
    coaching: { ...emptyCoachingFields, shot_type: "drive", bowling_length: "full" },
  };
  const base = { discipline: "batting" as const, delivery_id: "d" };
  assert.equal(
    filterDeliveries([row], filters, new Set(), [
      { ...base, shot_type: "drive", bowling_length: "short" },
      { ...base, shot_type: "cut", bowling_length: "full" },
    ]).length,
    0,
  );
  const correct = { ...base, shot_type: "drive", bowling_length: "full" };
  assert.equal(filterDeliveries([row], filters, new Set(), [correct]).length, 1);
  for (const patch of [
    { discipline: "bowling" as const },
    { delivery_id: null },
    { delivery_id: "other" },
  ])
    assert.equal(filterDeliveries([row], filters, new Set(), [{ ...correct, ...patch }]).length, 0);
  assert.equal(filterDeliveries([row], defaultAnalysisFilters).length, 1);
  assert.equal(
    filterDeliveries([{ ...row, superseded_by: "replacement" }], filters, new Set(), [correct])
      .length,
    0,
  );
});
test("classification validation rejects invented categories and unsafe timestamps", () => {
  for (const seconds of ["-1", "1.5", "NaN", "86401", "1e3"])
    assert.throws(() => validateCoaching(emptyCoachingFields, "file", seconds));
  assert.throws(() => validateCoaching(emptyCoachingFields, "", "0"));
  assert.throws(() =>
    validateCoaching({ ...emptyCoachingFields, shot_type: "fabricated" }, "", ""),
  );
  assert.equal(validateCoaching(emptyCoachingFields, "file", "0").evidence_time_seconds, 0);
  assert.equal(validateCoaching(emptyCoachingFields, "", "").shot_type, null);
});
test("observation CSV retains provenance and escapes formulas, quotes and newlines", () => {
  const csv = coachingCsv([
    {
      id: "note",
      discipline: "batting",
      delivery_id: "d",
      note: '=SUM(1,2)\n"quoted"',
      tags: "@unsafe",
      created_at: "2026-10-28",
      evidence_file_id: "source",
      evidence_time_seconds: 0,
      shot_type: "drive",
    },
  ]);
  assert.match(csv, /"'=SUM\(1,2\)/);
  assert.match(csv, /"'@unsafe"/);
  assert.match(csv, /"source","0","2026-10-28"/);
  assert.match(csv, /""quoted""/);
});

test("historical review distinguishes filtered-out current deliveries from undone history", async () => {
  const { filterObservations, observationState } = await import("../src/lib/coaching.ts");
  const base = { discipline: "batting" as const, note: "Review", tags: "", shot_type: "drive" };
  const whole = { ...base, delivery_id: null };
  const current = { ...base, delivery_id: "current" };
  const filtered = { ...base, delivery_id: "filtered-out" };
  const old = { ...base, delivery_id: "undone" };
  const currentIds = new Set(["current", "filtered-out"]),
    filteredIds = new Set(["current"]);
  const notes = [whole, current, filtered, old];
  const run = (history: "current" | "historical" | "all") =>
    filterObservations(notes, "batting", emptyCoachingFields, "", history, currentIds, filteredIds);
  assert.deepEqual(run("current"), [whole, current]);
  assert.deepEqual(run("historical"), [old]);
  assert.deepEqual(run("all"), [whole, current, old]);
  assert.deepEqual(
    filterObservations(notes, "bowling", emptyCoachingFields, "", "all", currentIds, filteredIds),
    [],
  );
  assert.deepEqual(
    filterObservations(
      notes,
      "batting",
      { ...emptyCoachingFields, shot_type: "cut" },
      "",
      "historical",
      currentIds,
      filteredIds,
    ),
    [],
  );
  assert.deepEqual(
    filterObservations(
      notes,
      "batting",
      emptyCoachingFields,
      "missing",
      "historical",
      currentIds,
      filteredIds,
    ),
    [],
  );
  assert.equal(observationState(null, currentIds), "whole_match");
  assert.equal(observationState("undone", currentIds), "no_longer_current");
  assert.equal(observationState("filtered-out", currentIds), "current");
});
