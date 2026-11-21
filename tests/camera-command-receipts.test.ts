import assert from "node:assert/strict";
import test from "node:test";
import {
  commandReceiptLabel,
  nextCameraCommand,
  reportCameraCommandResult,
} from "../src/lib/camera-command-receipts.ts";

const deviceId = "bb000000-0000-4000-8000-000000000001";
const idA = "cc000000-0000-4000-8000-000000000001";
const idB = "cc000000-0000-4000-8000-000000000002";
const now = Date.parse("2026-11-21T13:00:00Z");
const valid = {
  id: idA,
  device_id: deviceId,
  action: "start",
  created_at: "2026-11-21T12:59:59Z",
};

test("recent, addressed commands have a monotonic cursor", () => {
  const initial = nextCameraCommand(valid, deviceId, null, now);
  assert.ok(initial);
  assert.equal(initial.command.action, "start");
  assert.equal(nextCameraCommand(valid, deviceId, initial.cursor, now), null);
  assert.equal(
    nextCameraCommand({ ...valid, id: idB, action: "stop" }, deviceId, initial.cursor, now)?.command
      .action,
    "stop",
  );
  assert.equal(
    nextCameraCommand(
      { ...valid, id: idB, created_at: "2026-11-21T12:59:58Z" },
      deviceId,
      initial.cursor,
      now,
    ),
    null,
  );
});

test("stale, unknown, cross-camera and malformed commands are denied", () => {
  const cases = [
    null,
    {},
    [],
    { ...valid, device_id: "aa000000-0000-4000-8000-000000000002" },
    { ...valid, id: "not-uuid" },
    { ...valid, action: "delete" },
    { ...valid, created_at: "bad" },
    { ...valid, created_at: "2026-11-21T12:57:59Z" },
    { ...valid, created_at: "2026-11-21T13:00:08Z" },
  ];
  for (const value of cases) assert.equal(nextCameraCommand(value, deviceId, null, now), null);
});

test("phone receipts distinguish success from blocked capture and failed recording", () => {
  const baseline = {
    action: "start" as const,
    before: false,
    after: false,
    consent: true,
    armed: true,
    previewing: true,
  };
  assert.deepEqual(reportCameraCommandResult({ ...baseline, after: true }), {
    outcome: "started",
    reason_code: "none",
  });
  assert.deepEqual(reportCameraCommandResult({ ...baseline, before: true }), {
    outcome: "already_recording",
    reason_code: "none",
  });
  assert.deepEqual(reportCameraCommandResult({ ...baseline, consent: false }), {
    outcome: "blocked",
    reason_code: "missing_consent",
  });
  assert.deepEqual(reportCameraCommandResult({ ...baseline, armed: false }), {
    outcome: "blocked",
    reason_code: "not_armed",
  });
  assert.deepEqual(reportCameraCommandResult({ ...baseline, previewing: false }), {
    outcome: "blocked",
    reason_code: "preview_off",
  });
  assert.deepEqual(reportCameraCommandResult(baseline), {
    outcome: "failed",
    reason_code: "capture_failed",
  });
});

test("stop receipts do not imply media was uploaded", () => {
  const baseline = {
    action: "stop" as const,
    before: true,
    after: false,
    consent: true,
    armed: false,
    previewing: false,
  };
  assert.deepEqual(reportCameraCommandResult(baseline), {
    outcome: "stopped",
    reason_code: "none",
  });
  assert.deepEqual(reportCameraCommandResult({ ...baseline, before: false }), {
    outcome: "already_stopped",
    reason_code: "none",
  });
  assert.deepEqual(reportCameraCommandResult({ ...baseline, after: true }), {
    outcome: "failed",
    reason_code: "capture_failed",
  });
  assert.match(commandReceiptLabel("start"), /No phone acknowledgment/);
  assert.match(commandReceiptLabel("start", "blocked", "missing_consent"), /permission/);
  assert.match(commandReceiptLabel("stop", "stopped"), /reported/);
  assert.doesNotMatch(commandReceiptLabel("stop", "stopped"), /upload|saved/i);
});
