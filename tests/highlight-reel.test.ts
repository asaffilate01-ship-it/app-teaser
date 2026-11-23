import assert from "node:assert/strict";
import test from "node:test";
import type { CameraClip } from "../src/lib/camera-review.ts";
import { buildHighlightReel, reelLength, type ReelDelivery } from "../src/lib/highlight-reel.ts";

const now = Date.parse("2027-05-01T12:00:00Z");
const clip = (id: string, device: string, start: string, end: string): CameraClip => ({
  id,
  device_id: device,
  started_at: start,
  ended_at: end,
  storage_path: `room/${id}.webm`,
  status: "ready",
  recording_consent: "granted",
  retention_expires_at: "2027-06-01T00:00:00Z",
  blur_mode: "none",
});
const ball = (sequence: number, at: string, extra: Partial<ReelDelivery> = {}): ReelDelivery => ({
  id: `d${sequence}`,
  sequence,
  over_number: 3,
  ball_in_over: sequence,
  occurred_at: at,
  total_runs: 0,
  wicket: false,
  batter_runs: 0,
  striker_id: "bat1",
  bowler_id: "bowl1",
  ...extra,
});

const clips = [
  clip("c1", "cam-a", "2027-05-01T10:00:00Z", "2027-05-01T10:10:00Z"),
  clip("c2", "cam-b", "2027-05-01T10:00:00Z", "2027-05-01T10:10:00Z"),
];
const deliveries = [
  ball(1, "2027-05-01T10:01:00Z", { batter_runs: 4 }),
  ball(2, "2027-05-01T10:02:00Z", { batter_runs: 1 }),
  ball(3, "2027-05-01T10:03:00Z", { batter_runs: 6, striker_id: "bat2" }),
  ball(4, "2027-05-01T10:04:00Z", { wicket: true }),
  ball(5, "2027-05-01T11:00:00Z", { batter_runs: 6 }), // after every recording ended
];

test("boundary reel takes fours and sixes in ball order, 5s either side of the ball", () => {
  const reel = buildHighlightReel({ clips, deliveries, kind: "boundaries", nowMs: now });
  assert.deepEqual(reel.map((item) => item.deliveryId), ["d1", "d3"]);
  assert.equal(reel[0]?.startSeconds, 55);
  assert.equal(reel[0]?.endSeconds, 65);
  assert.equal(reelLength(reel), 20);
});

test("balls no camera was recording are left out", () => {
  const reel = buildHighlightReel({ clips, deliveries, kind: "sixes", nowMs: now });
  assert.deepEqual(reel.map((item) => item.deliveryId), ["d3"]);
});

test("the chosen camera angle is used when it covers the ball", () => {
  const reel = buildHighlightReel({ clips, deliveries, kind: "wickets", preferDeviceId: "cam-b", nowMs: now });
  assert.equal(reel[0]?.deviceId, "cam-b");
});

test("a player's reel has their boundaries, their dismissal and wickets they took", () => {
  const batter = buildHighlightReel({ clips, deliveries, kind: "player", playerId: "bat1", nowMs: now });
  assert.deepEqual(batter.map((item) => item.deliveryId), ["d1", "d4"]);
  const bowler = buildHighlightReel({ clips, deliveries, kind: "player", playerId: "bowl1", nowMs: now });
  assert.deepEqual(bowler.map((item) => item.deliveryId), ["d4"]);
});

test("manual calibration shifts the cut", () => {
  const reel = buildHighlightReel({ clips, deliveries, kind: "boundaries", offsets: { c1: 2000 }, nowMs: now });
  assert.equal(reel[0]?.startSeconds, 53);
});

test("recordings without consent are never used", () => {
  const blocked = clips.map((item) => ({ ...item, recording_consent: "withdrawn" }));
  assert.equal(buildHighlightReel({ clips: blocked, deliveries, kind: "boundaries", nowMs: now }).length, 0);
});
