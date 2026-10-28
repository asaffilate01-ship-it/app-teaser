import { test } from "node:test";
import assert from "node:assert/strict";
import { observationErrors } from "../src/lib/observation-form.ts";
const valid = { note: "Good balance", time: "", staleSource: false, staleDelivery: false };
test("observations enforce meaningful text boundaries", () => {
  for (const note of ["", "   ", " a ", "ab", "x".repeat(3001)])
    assert.ok(observationErrors({ ...valid, note }).note);
  for (const note of [" abc ", "x".repeat(3000)])
    assert.deepEqual(observationErrors({ ...valid, note }), {});
});
test("video offsets accept inclusive bounds and reject invalid or unlinked values", () => {
  for (const time of ["0", "86400", "12"])
    assert.deepEqual(observationErrors({ ...valid, time, sourceKind: "video" }), {});
  for (const time of ["-1", "1.5", "86401", "1e2", " "])
    assert.ok(observationErrors({ ...valid, time, sourceKind: "video" }).time);
  assert.ok(observationErrors({ ...valid, time: "12", sourceKind: "image" }).time);
  assert.ok(observationErrors({ ...valid, time: "12" }).time);
});
test("stale source and delivery errors are independently actionable", () => {
  const errors = observationErrors({ ...valid, staleSource: true, staleDelivery: true });
  assert.ok(errors.source);
  assert.ok(errors.delivery);
  assert.equal(errors.note, undefined);
});
