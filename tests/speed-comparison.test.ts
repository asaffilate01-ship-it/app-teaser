import assert from "node:assert/strict";
import test from "node:test";
import {
  compareSpeedPairs,
  parseComparisonSpeed,
  speedComparisonCsv,
} from "../src/lib/speed-comparison.ts";

const pairs = [
  { trial: 1, videoKph: 125, referenceKph: 120 },
  { trial: 2, videoKph: 118, referenceKph: 120 },
  { trial: 3, videoKph: 120, referenceKph: 120 },
];

test("comparison computes signed, absolute and RMS differences without rounding inputs", () => {
  const result = compareSpeedPairs(pairs, 3);
  assert.ok(result);
  assert.equal(result.count, 3);
  assert.equal(result.meanDifference, 1);
  assert.equal(result.meanAbsoluteDifference, 7 / 3);
  assert.equal(result.rootMeanSquareDifference, Math.sqrt(29 / 3));
  assert.equal(result.maximumAbsoluteDifference, 5);
  assert.equal(result.withinTolerance, 2);
  assert.equal(result.preliminarySampleSizeReached, false);
});

test("duplicate trials and invalid numeric inputs cannot become validation evidence", () => {
  for (const value of ["", "0", "-5", "Infinity", "1e2", "200.01", "99.999", "120km/h"]) {
    assert.equal(parseComparisonSpeed(value), null);
  }
  assert.equal(parseComparisonSpeed(" 124.25 "), 124.25);
  assert.equal(compareSpeedPairs([], 5), null);
  assert.equal(compareSpeedPairs(pairs, 0), null);
  assert.equal(compareSpeedPairs([pairs[0]!, pairs[0]!], 5), null);
  assert.equal(compareSpeedPairs([{ ...pairs[0]!, videoKph: NaN }], 5), null);
});

test("preliminary sample threshold is descriptive and does not confer certification", () => {
  const trials = Array.from({ length: 20 }, (_, i) => ({
    trial: i + 1,
    videoKph: 100,
    referenceKph: 100,
  }));
  assert.equal(compareSpeedPairs(trials.slice(0, 19), 5)?.preliminarySampleSizeReached, false);
  assert.equal(compareSpeedPairs(trials, 5)?.preliminarySampleSizeReached, true);
  assert.equal(compareSpeedPairs(trials, 5)?.withinTolerancePercent, 100);
});

test("numeric export preserves the reference metric without inventing certification", () => {
  const csv = speedComparisonCsv(pairs, "radar_release", 5);
  assert.ok(csv);
  assert.match(csv, /1,125.00,120.00,5.00,radar_release,5/);
  assert.match(csv, /2,118.00,120.00,-2.00,radar_release,5/);
  assert.equal(csv.trim().split("\r\n").length, 4);
  assert.doesNotMatch(csv, /certified/i);
  assert.equal(speedComparisonCsv([], "same_segment", 5), null);
});
