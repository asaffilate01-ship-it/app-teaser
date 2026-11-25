import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateDeliveryCues,
  type CameraClip,
  type CameraDelivery,
} from "../src/lib/camera-review.ts";
import { syncedDeliverySeconds } from "../src/lib/camera-replay-workbench.ts";
import { buildHighlightReel } from "../src/lib/highlight-reel.ts";

const start = Date.parse("2026-11-25T10:00:00Z");
const now = start + 3_600_000;
const iso = (seconds: number) => new Date(start + seconds * 1000).toISOString();
const clip = (id: string, device: string, from: number, until: number): CameraClip => ({
  id,
  device_id: device,
  started_at: iso(from),
  ended_at: iso(until),
  storage_path: "private/" + id,
  status: "ready",
  recording_consent: "granted",
  retention_expires_at: iso(7200),
  blur_mode: "none",
});
const ball = (id: number, seconds: number): CameraDelivery => ({
  id: "ball-" + id,
  sequence: id,
  over_number: Math.floor(id / 6),
  ball_in_over: (id % 6) + 1,
  occurred_at: iso(seconds),
  total_runs: 4,
  wicket: false,
});

test("indexed cues retain every overlapping camera and canonical delivery ordering", () => {
  const clips = Array.from({ length: 120 }, (_, i) =>
    clip("clip-" + i, "cam-" + (i % 4), i, i + 12),
  );
  const deliveries = Array.from({ length: 250 }, (_, i) => ball(i, 249 - i));
  const expected = clips.flatMap((source) =>
    deliveries
      .filter((delivery) => {
        const at = Date.parse(delivery.occurred_at);
        return at >= Date.parse(source.started_at) && at < Date.parse(source.ended_at!);
      })
      .map((delivery) => source.id + ":" + delivery.id),
  );
  const actual = estimateDeliveryCues(clips, deliveries, now);
  assert.deepEqual(actual.map((cue) => cue.clipId + ":" + cue.deliveryId).sort(), expected.sort());
  assert.ok(
    actual.every((cue, i) => i === 0 || cue.deliverySequence >= actual[i - 1]!.deliverySequence),
  );
});

test("calibrated delivery cues include the start and exclude the recording end", () => {
  const source = clip("a", "cam-a", 0, 60);
  assert.equal(syncedDeliverySeconds(source, ball(1, 0), 0), 0);
  assert.equal(syncedDeliverySeconds(source, ball(2, 2), 0), 0);
  assert.equal(syncedDeliverySeconds(source, ball(3, 59), 0), 56);
  assert.equal(syncedDeliverySeconds(source, ball(4, 60), 0), null);
  assert.equal(syncedDeliverySeconds(source, ball(5, 62), 0), null);
  assert.equal(syncedDeliverySeconds(source, ball(6, 1), 2000), null);
  assert.equal(syncedDeliverySeconds(source, ball(7, 10), 0, NaN), null);
});

test("highlight reels preserve preferred camera selection and reject invalid timing", () => {
  const clips = [clip("a", "cam-a", 0, 60), clip("b", "cam-b", 0, 60)];
  const deliveries = [{ ...ball(1, 12), batter_runs: 4 }];
  const input = { clips, deliveries, kind: "boundaries" as const, nowMs: now };
  const preferred = buildHighlightReel({
    ...input,
    preferDeviceId: "cam-b",
    offsets: { b: 2000 },
  });
  assert.equal(preferred[0]?.deviceId, "cam-b");
  assert.equal(preferred[0]?.startSeconds, 5);
  assert.equal(buildHighlightReel({ ...input, preRollMs: -1 }).length, 0);
  assert.equal(buildHighlightReel({ ...input, postRollMs: Infinity }).length, 0);
});
