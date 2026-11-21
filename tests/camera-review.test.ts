import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateDeliveryCues,
  isReviewableClip,
  storageVideoMimeType,
  type CameraClip,
  type CameraDelivery,
} from "../src/lib/camera-review.ts";

const clip: CameraClip = {
  id: "clip-a",
  device_id: "device-1",
  started_at: "2026-11-21T10:00:00.000Z",
  ended_at: "2026-11-21T10:01:00.000Z",
  storage_path: "club/room/asset/source.webm",
  status: "uploaded",
  recording_consent: "granted",
  retention_expires_at: "2026-12-31T00:00:00.000Z",
  blur_mode: "none",
};
const delivery: CameraDelivery = {
  id: "ball-1",
  sequence: 8,
  over_number: 1,
  ball_in_over: 2,
  occurred_at: "2026-11-21T10:00:10.000Z",
  total_runs: 4,
  wicket: false,
};

test("codec-qualified browser MediaRecorder MIME is stored in an allowed bucket format", () => {
  assert.equal(storageVideoMimeType("video/webm;codecs=vp9,opus"), "video/webm");
  assert.equal(storageVideoMimeType(" video/mp4; codecs=avc1.42E01E,mp4a.40.2"), "video/mp4");
  assert.throws(() => storageVideoMimeType("video/quicktime"));
  assert.throws(() => storageVideoMimeType("image/png"));
});

test("only unexpired consented uploaded clips with private storage can be reviewed", () => {
  const now = Date.parse("2026-11-21T12:00:00Z");
  assert.equal(isReviewableClip(clip, now), true);
  for (const blocked of [
    { status: "uploading" },
    { status: "quarantined" },
    { status: "deleted" },
    { recording_consent: "withdrawn" },
    { retention_expires_at: "2026-11-20T00:00:00Z" },
    { storage_path: null },
    { started_at: "invalid" },
  ]) {
    assert.equal(isReviewableClip({ ...clip, ...blocked }, now), false);
  }
});

test("delivery review cues seek just before the event and remain unverified estimates", () => {
  const now = Date.parse("2026-11-21T12:00:00Z");
  const cues = estimateDeliveryCues([clip], [delivery], now);
  assert.equal(cues.length, 1);
  assert.deepEqual(cues[0], {
    clipId: "clip-a",
    deviceId: "device-1",
    deliveryId: "ball-1",
    deliverySequence: 8,
    label: "Over 2 · Ball 2 · 4 runs",
    seekSeconds: 7,
    alignment: "device-clock-estimate",
  });
});

test("delivery cues are excluded for invalid, out-of-range or expired timestamps", () => {
  const now = Date.parse("2026-11-21T12:00:00Z");
  const later = { ...delivery, occurred_at: clip.ended_at! };
  const earlier = { ...delivery, occurred_at: "2026-11-21T09:59:59Z" };
  assert.equal(estimateDeliveryCues([clip], [later, earlier], now).length, 0);
  assert.equal(estimateDeliveryCues([{ ...clip, ended_at: null }], [delivery], now).length, 0);
  assert.equal(estimateDeliveryCues([{ ...clip, status: "failed" }], [delivery], now).length, 0);
  assert.equal(estimateDeliveryCues([clip], [{ ...delivery, occurred_at: "bad" }], now).length, 0);
});

test("overlapping camera angles retain separate cues in canonical ball order", () => {
  const now = Date.parse("2026-11-21T12:00:00Z");
  const second = { ...delivery, id: "ball-2", sequence: 9, wicket: true, total_runs: 0 };
  const result = estimateDeliveryCues(
    [clip, { ...clip, id: "clip-b", device_id: "device-2" }],
    [second, delivery],
    now,
  );
  assert.equal(result.length, 4);
  assert.deepEqual(result.map((cue) => cue.deliverySequence), [8, 8, 9, 9]);
  assert.match(result[3]!.label, /WICKET/);
});
