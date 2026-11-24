import assert from "node:assert/strict";
import test from "node:test";
import {
  cameraCloudActive,
  cameraCloudControls,
  cameraCloudLabel,
  isCameraCloudState,
} from "../src/lib/camera-cloud-status.ts";

test("only expected provider states can be rendered as cloud recording status", () => {
  for (const status of ["starting", "recording", "stopping", "provider_completed", "failed"]) {
    assert.equal(isCameraCloudState(status), true);
  }
  for (const status of [null, false, "", "uploaded", "ready", "completed", "saved"]) {
    assert.equal(isCameraCloudState(status), false);
  }
});

test("cloud status never implies the remote archive was verified", () => {
  assert.equal(cameraCloudActive("starting"), true);
  assert.equal(cameraCloudActive("recording"), true);
  assert.equal(cameraCloudActive("stopping"), true);
  assert.equal(cameraCloudActive("provider_completed"), false);
  assert.equal(cameraCloudActive("failed"), false);
  assert.match(cameraCloudLabel("starting"), /not yet confirmed/);
  assert.match(cameraCloudLabel("provider_completed"), /not yet verified/);
  assert.match(cameraCloudLabel("failed"), /failed/);
  for (const status of ["starting", "recording", "stopping", "provider_completed"] as const) {
    assert.doesNotMatch(cameraCloudLabel(status), /saved to library|verified footage|public/i);
  }
});

test("chargeable recording starts require an armed camera with verified inactive status", () => {
  const input = { armed: true, verified: true, state: null, busy: false };
  assert.equal(cameraCloudControls(input).canStart, true);
  assert.equal(cameraCloudControls({ ...input, armed: false }).canStart, false);
  assert.equal(cameraCloudControls({ ...input, verified: false }).canStart, false);
  assert.equal(cameraCloudControls({ ...input, state: "recording" }).canStart, false);
  assert.equal(cameraCloudControls({ ...input, state: "unknown" }).canStart, false);
  assert.equal(cameraCloudControls({ ...input, busy: true }).canStart, false);
});

test("an uncertain recording state permits a server-authorised stop, not another start", () => {
  const input = { armed: false, verified: false, state: null, busy: false };
  assert.deepEqual(cameraCloudControls(input), { canStart: false, canStop: true });
  assert.equal(cameraCloudControls({ ...input, busy: true }).canStop, false);
  assert.equal(cameraCloudControls({ ...input, verified: true }).canStop, false);
  assert.equal(cameraCloudControls({ ...input, verified: true, state: "recording" }).canStop, true);
  assert.equal(cameraCloudControls({ ...input, verified: true, state: "stopping" }).canStop, false);
});
