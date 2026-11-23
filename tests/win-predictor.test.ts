import assert from "node:assert/strict";
import test from "node:test";
import { defaultConditions, predictWin } from "../src/lib/win-predictor.ts";

const t20 = { oversPerInnings: 20, inningsPerSide: 1, ballsPerOver: 6 };

test("an even match with no balls bowled is 50-50", () => {
  assert.equal(predictWin({ ...t20, inningsNumber: 1, runs: 0, wickets: 0, legalBalls: 0 })?.battingWin, 50);
});

test("chances add up to 100", () => {
  const p = predictWin({ ...t20, inningsNumber: 2, runs: 80, wickets: 3, legalBalls: 70, target: 150 })!;
  assert.equal(p.battingWin + p.bowlingWin, 100);
});

test("losing wickets lowers the batting side's chance", () => {
  const few = predictWin({ ...t20, inningsNumber: 1, runs: 60, wickets: 1, legalBalls: 60 })!;
  const many = predictWin({ ...t20, inningsNumber: 1, runs: 60, wickets: 6, legalBalls: 60 })!;
  assert.ok(many.battingWin < few.battingWin);
});

test("a chase that is won or lost reads 100 or 0", () => {
  assert.equal(predictWin({ ...t20, inningsNumber: 2, runs: 150, wickets: 4, legalBalls: 100, target: 150 })?.battingWin, 100);
  assert.equal(predictWin({ ...t20, inningsNumber: 2, runs: 120, wickets: 10, legalBalls: 100, target: 150 })?.battingWin, 0);
  assert.equal(predictWin({ ...t20, inningsNumber: 2, runs: 140, wickets: 4, legalBalls: 120, target: 150 })?.battingWin, 0);
});

test("an open match never shows 0% or 100%", () => {
  const p = predictWin({ ...t20, inningsNumber: 2, runs: 10, wickets: 8, legalBalls: 110, target: 200 })!;
  assert.equal(p.battingWin, 1);
});

test("a bowler-friendly pitch with dew favours the side batting second", () => {
  const p = predictWin({ ...t20, inningsNumber: 1, runs: 0, wickets: 0, legalBalls: 0, conditions: { ...defaultConditions, pitch: "bowling", dew: true } })!;
  assert.ok(p.battingWin < 50);
});

test("the stronger side on paper starts ahead", () => {
  const p = predictWin({ ...t20, inningsNumber: 1, runs: 0, wickets: 0, legalBalls: 0, battingIsHome: true, conditions: { ...defaultConditions, edge: 1 } })!;
  assert.ok(p.battingWin > 50);
});

test("not offered for unlimited-overs or two-innings matches", () => {
  assert.equal(predictWin({ ...t20, oversPerInnings: null, inningsNumber: 1, runs: 0, wickets: 0, legalBalls: 0 }), null);
  assert.equal(predictWin({ ...t20, inningsPerSide: 2, inningsNumber: 1, runs: 0, wickets: 0, legalBalls: 0 }), null);
});
