import assert from "node:assert/strict";
import test from "node:test";
import {
  canMarkPrivateHighlight,
  clipDurationSeconds,
  redactHighlightNote,
  syncedDeliverySeconds,
  syncedSecondarySeconds,
  validCalibrationOffset,
} from "../src/lib/camera-replay-workbench.ts";
import type { CameraClip, CameraDelivery } from "../src/lib/camera-review.ts";

const base: CameraClip = {
  id: "a",
  device_id: "device-a",
  started_at: "2026-11-22T10:00:00Z",
  ended_at: "2026-11-22T10:01:00Z",
  storage_path: "private/a",
  recording_consent: "granted",
  retention_expires_at: "2026-12-22T00:00:00Z",
  status: "uploaded",
  blur_mode: "people",
};
const other: CameraClip = {
  ...base,
  id: "b",
  device_id: "device-b",
  started_at: "2026-11-22T10:00:02Z",
};
const delivery: CameraDelivery = {
  id: "ball-2",
  sequence: 4,
  over_number: 0,
  ball_in_over: 4,
  occurred_at: "2026-11-22T10:00:12Z",
  total_runs: 4,
  wicket: false,
};

test("corresponding two-camera playheads account for actual clip-start metadata", () => {
  assert.equal(syncedSecondarySeconds(base, other, 10, 0, 0), 8);
  assert.equal(syncedSecondarySeconds(base, other, 10, 0, -2000), 10);
  assert.equal(syncedSecondarySeconds(base, other, 1, 0, 0), null);
  assert.equal(syncedSecondarySeconds(base, other, 65, 0, 0), null);
  assert.equal(syncedSecondarySeconds(base, other, Number.NaN, 0, 0), null);
  assert.equal(syncedSecondarySeconds(base, other, 10, 30_001, 0), null);
  assert.equal(clipDurationSeconds(base), 60);
  assert.equal(clipDurationSeconds({ ...base, ended_at: null }), null);
});
test("delivery cues use calibrated time with explicit prerecording roll", () => {
  assert.equal(syncedDeliverySeconds(base, delivery, 0), 9);
  assert.equal(syncedDeliverySeconds(base, delivery, 2000), 7);
  assert.equal(syncedDeliverySeconds(base, delivery, 20_000), null);
  assert.equal(syncedDeliverySeconds({ ...base, ended_at: null }, delivery, 0), null);
});
test("calibration is bounded and no non-finite offsets can be saved", () => {
  assert.equal(validCalibrationOffset(-30_000), true);
  assert.equal(validCalibrationOffset(30_000), true);
  for (const offset of [30_001, -30_001, 0.3, Infinity, Number.NaN]) {
    assert.equal(validCalibrationOffset(offset), false);
  }
});
test("private highlight candidates require a current consented recording", () => {
  const now = Date.parse("2026-11-22T12:00:00Z");
  assert.equal(canMarkPrivateHighlight(base, 15, 6000, now), true);
  for (const change of [
    { recording_consent: "withdrawn" },
    { storage_path: null },
    { status: "uploading" },
    { retention_expires_at: "2026-11-22T11:00:00Z" },
  ])
    assert.equal(canMarkPrivateHighlight({ ...base, ...change }, 15, 6000, now), false);
  for (const seconds of [-1, 60, Number.NaN]) {
    assert.equal(canMarkPrivateHighlight(base, seconds, 6000, now), false);
  }
  assert.equal(canMarkPrivateHighlight(base, 1, 30_001, now), false);
  assert.equal(canMarkPrivateHighlight(base, 1, 0, now), false);
  assert.equal(redactHighlightNote("  hello  ".repeat(100)).length, 240);
});
