import assert from "node:assert/strict";
import test from "node:test";
import { ballCandidates, detectFps } from "../src/lib/ball-speed.ts";

test("nominal media rate requires a consistent ordered timestamp sample", () => {
  for (const fps of [24, 25, 29.97, 50, 59.94, 100, 120, 240]) {
    const times = Array.from({ length: 14 }, (_, i) => 1 + i / fps);
    assert.equal(detectFps(times), Math.round(fps));
  }
  const regular = Array.from({ length: 14 }, (_, i) => i / 60);
  assert.equal(detectFps(regular.slice(0, 5)), null);
  assert.equal(detectFps(regular.filter((_, i) => i !== 5)), null);
  assert.equal(detectFps([...regular.slice(0, 5), regular[4]!, ...regular.slice(5)]), null);
  assert.equal(detectFps([...regular.slice(0, 5), NaN, ...regular.slice(5)]), null);
  assert.equal(
    detectFps(Array.from({ length: 14 }, (_, i) => i / 80)),
    null,
  );
});

test("bounded motion bins keep separated candidates in progress order", () => {
  const width = 100;
  const height = 30;
  const before = new Uint8Array(width * height);
  const current = new Uint8Array(width * height);
  const after = new Uint8Array(width * height);
  current[15 * width + 30] = 200;
  current[15 * width + 70] = 200;
  current[0] = 200; // outside the tracking corridor
  const candidates = ballCandidates(
    before,
    current,
    after,
    width,
    height,
    { x: 10, y: 15 },
    { x: 90, y: 15 },
  );
  assert.deepEqual(candidates, [
    { t: 0.25, size: 1 },
    { t: 0.75, size: 1 },
  ]);
});

test("adjacent bins combine small blobs but large movement is rejected", () => {
  const width = 100;
  const height = 30;
  const before = new Uint8Array(width * height);
  const current = new Uint8Array(width * height);
  const after = new Uint8Array(width * height);
  current[15 * width + 30] = 200;
  current[15 * width + 31] = 200;
  for (let y = 12; y <= 18; y += 1) current[y * width + 70] = 200;
  const candidates = ballCandidates(
    before,
    current,
    after,
    width,
    height,
    { x: 10, y: 15 },
    { x: 90, y: 15 },
    { maxSize: 4 },
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.size, 2);
  assert.ok(Math.abs(candidates[0]!.t - 0.25625) < 1e-9);
});

test("invalid frame data and calibration geometry fail closed", () => {
  const frame = new Uint8Array(100);
  const a = { x: 0, y: 5 };
  const b = { x: 9, y: 5 };
  assert.deepEqual(ballCandidates(frame, frame.subarray(1), frame, 10, 10, a, b), []);
  assert.deepEqual(ballCandidates(frame, frame, frame, 10, 10, a, { x: NaN, y: 5 }), []);
  assert.deepEqual(ballCandidates(frame, frame, frame, 10, 10, a, b, { threshold: 0 }), []);
  assert.deepEqual(ballCandidates(frame, frame, frame, 10, 10, a, b, { band: Infinity }), []);
});
