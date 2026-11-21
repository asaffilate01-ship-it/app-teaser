import assert from "node:assert/strict";
import test from "node:test";
import {
  cameraArchiveStatusLabel,
  expectedCameraArchiveKey,
  inspectCameraMp4,
  isCameraArchiveStatus,
  mayCheckCameraArchive,
} from "../src/lib/camera-archive-policy.ts";

const org = "aa000000-0000-4000-8000-000000000001";
const room = "bb000000-0000-4000-8000-000000000001";
const device = "cc000000-0000-4000-8000-000000000001";
const session = "dd000000-0000-4000-8000-000000000001";
const head = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);

test("private cloud archive key cannot include untrusted paths or another tenant", () => {
  assert.equal(
    expectedCameraArchiveKey(org, room, device, session),
    [org, room, device, session + ".mp4"].join("/"),
  );
  for (const bad of ["", "123", "../malicious", org + "/other", "a".repeat(200)]) {
    assert.throws(() => expectedCameraArchiveKey(org, room, bad, session));
  }
});

test("object inspection checks MP4 ftyp bytes, length and a safe MIME type", () => {
  assert.equal(inspectCameraMp4(9999, "video/mp4", head), "object_confirmed");
  assert.equal(inspectCameraMp4(9999, "application/octet-stream", head), "object_confirmed");
  assert.equal(inspectCameraMp4(9999, "video/mp4; charset=binary", head), "object_confirmed");
  assert.equal(inspectCameraMp4(0, "video/mp4", head), "invalid_object");
  assert.equal(inspectCameraMp4(9999, "text/html", head), "invalid_object");
  assert.equal(inspectCameraMp4(9999, "video/mp4", new Uint8Array(12)), "invalid_object");
  assert.equal(inspectCameraMp4(undefined, "video/mp4", head), "invalid_object");
  assert.equal(inspectCameraMp4(9999, "video/mp4", head.slice(0, 7)), "invalid_object");
});

test("only provider-completed recordings can be inspected and retries are bounded", () => {
  assert.equal(mayCheckCameraArchive("provider_completed", "uninspected", 0), true);
  assert.equal(mayCheckCameraArchive("provider_completed", "object_missing", 3), true);
  assert.equal(mayCheckCameraArchive("provider_completed", "storage_error", 4), true);
  assert.equal(mayCheckCameraArchive("recording", "uninspected", 0), false);
  assert.equal(mayCheckCameraArchive("provider_completed", "object_confirmed", 1), false);
  assert.equal(mayCheckCameraArchive("provider_completed", "invalid_object", 2), false);
  assert.equal(mayCheckCameraArchive("provider_completed", "storage_error", 5), false);
  assert.equal(mayCheckCameraArchive("provider_completed", "storage_error", -1), false);
});

test("archive statuses are not confused with public library readiness", () => {
  assert.equal(isCameraArchiveStatus("object_confirmed"), true);
  assert.equal(isCameraArchiveStatus("ready"), false);
  assert.match(cameraArchiveStatusLabel("object_confirmed"), /safeguarding/i);
  assert.match(cameraArchiveStatusLabel("review_required"), /investigation/i);
  assert.doesNotMatch(cameraArchiveStatusLabel("object_confirmed"), /published|ready to share/i);
});
