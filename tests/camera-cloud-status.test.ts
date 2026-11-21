import assert from "node:assert/strict";
import test from "node:test";
import {
  cameraCloudActive,
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
