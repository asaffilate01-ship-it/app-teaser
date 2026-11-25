import assert from "node:assert/strict";
import test from "node:test";
import {
  ballSpeed,
  fitBallTrack,
  reportedCaptureRate,
  reviewableBallSpeed,
  speedCaptureProfile,
  speedsByBowler,
} from "../src/lib/ball-speed.ts";

test("measured segment speed uses physical distance and elapsed time", () => {
  const reading = ballSpeed(0, 0.45, 18, 120, 1, 0.1);
  assert.ok(reading);
  assert.equal(reading.kph, 144);
  assert.equal(reading.mph, 89.5);
  assert.ok(reading.lowKph < reading.kph && reading.highKph > reading.kph);
  assert.equal(reviewableBallSpeed(reading), true);
});

test("a constant 8x slowed export uses physical rather than presentation time", () => {
  const reading = ballSpeed(0, 3.6, 18, 30, 0.125, 0.1);
  assert.ok(reading);
  assert.equal(reading.kph, 144);
  assert.equal(reading.seconds, 0.45);
  assert.equal(ballSpeed(0, 3.6, 18, 30)?.kph, 18);
});

test("low-frame-rate uncertainty blocks an inadequately supported speed estimate", () => {
  const lowRate = ballSpeed(0, 0.45, 18, 30, 1, 0.1);
  assert.ok(lowRate);
  assert.ok(lowRate.warning);
  assert.equal(reviewableBallSpeed(lowRate), false);
  const highRate = ballSpeed(0, 0.45, 18, 240, 1, 0.1);
  assert.ok(highRate);
  assert.ok(highRate.highKph - highRate.lowKph < lowRate.highKph - lowRate.lowKph);
  assert.equal(reviewableBallSpeed(highRate), true);
});

test("invalid timing, non-finite values and impossible distance bounds are rejected", () => {
  assert.equal(ballSpeed(0.5, 0.4, 18, 120), null);
  assert.equal(ballSpeed(-0.1, 0.45, 18, 120), null);
  assert.equal(ballSpeed(0, 0.45, Infinity, 120), null);
  assert.equal(ballSpeed(0, 0.45, 18, NaN), null);
  assert.equal(ballSpeed(0, 0.45, 18, 120, 0), null);
  assert.equal(ballSpeed(0, 0.45, 18, 120, 1, 18), null);
  assert.equal(ballSpeed(0, 0.45, 18, 120, 1, -1), null);
  assert.equal(reviewableBallSpeed(null), false);
});

test("automatic candidate fitting ignores invalid points and preserves a known trajectory", () => {
  const points = Array.from({ length: 11 }, (_, index) => ({
    time: index * 0.025,
    t: index / 10,
  }));
  const track = fitBallTrack([...points, { time: NaN, t: 0.5 }], 10);
  assert.ok(track);
  assert.ok(Math.abs(track.rate * 10 * 3.6 - 144) < 0.01);
  assert.ok(track.fit > 0.99);
  assert.equal(fitBallTrack(points, Infinity), null);
});

test("camera profiles retain standard capture and disclose the reported rate separately", () => {
  assert.equal(speedCaptureProfile(30).width.ideal, 1920);
  assert.equal(speedCaptureProfile(60).height.ideal, 720);
  assert.equal(speedCaptureProfile(120).frameRate.ideal, 120);
  assert.equal(reportedCaptureRate(29.97), 30);
  assert.equal(reportedCaptureRate(undefined), null);
  assert.equal(reportedCaptureRate(Infinity), null);
});

test("bowler summaries ignore invalid speeds", () => {
  const summary = speedsByBowler([
    { bowlerId: "a", speedKph: 120 },
    { bowlerId: "a", speedKph: 140 },
    { bowlerId: "a", speedKph: NaN },
    { bowlerId: "a", speedKph: -1 },
    { bowlerId: "b", speedKph: Infinity },
  ]);
  assert.deepEqual(summary, [{ bowlerId: "a", balls: 2, fastest: 140, average: 130 }]);
});
