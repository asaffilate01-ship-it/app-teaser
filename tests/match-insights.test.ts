import assert from "node:assert/strict";
import test from "node:test";
import {
  manhattan,
  overProgression,
  partnerships,
  worm,
  requiredRateByOver,
  topAllRounders,
  topBatters,
  topBowlers,
  wagonWheel,
  type InsightBall,
} from "../src/lib/match-insights.ts";

const ball = (over: number, patch: Partial<InsightBall> = {}): InsightBall => ({
  over,
  legal: true,
  batterRuns: 0,
  wide: 0,
  noBall: 0,
  bye: 0,
  legBye: 0,
  strikerId: "a",
  bowlerId: "x",
  fieldZone: "Not recorded",
  dismissalType: null,
  ...patch,
});

test("run rate is cumulative runs per completed six-ball over", () => {
  const balls = [
    ...Array.from({ length: 6 }, () => ball(0, { batterRuns: 1 })),
    ball(1, { batterRuns: 4 }),
    ball(1, { legal: false, wide: 1 }),
    ...Array.from({ length: 5 }, () => ball(1)),
  ];
  const points = overProgression(balls);
  assert.deepEqual(
    points.map((point) => [point.over, point.runs, point.totalRuns, point.runRate]),
    [
      [1, 6, 6, 6],
      [2, 5, 11, 5.5],
    ],
  );
});

test("wagon wheel counts bat runs only and keeps unplaced runs separate", () => {
  const wheel = wagonWheel([
    ball(0, { batterRuns: 4, fieldZone: "Cover" }),
    ball(0, { batterRuns: 2, fieldZone: "Cover" }),
    ball(0, { batterRuns: 2, fieldZone: "Square leg" }),
    ball(0, { batterRuns: 3, fieldZone: "Not recorded" }),
    ball(0, { legBye: 1, fieldZone: "Fine leg" }),
  ]);
  assert.equal(wheel.placedRuns, 8);
  assert.equal(wheel.unplacedRuns, 3);
  assert.equal(wheel.zones.find((zone) => zone.zone === "Cover")?.share, 75);
  assert.equal(wheel.zones.find((zone) => zone.zone === "Fine leg")?.runs, 0);
});

test("top batters rank by runs, wides are not balls faced", () => {
  const [first, second] = topBatters([
    ball(0, { strikerId: "a", batterRuns: 6 }),
    ball(0, { strikerId: "a", legal: false, wide: 1 }),
    ball(0, { strikerId: "b", batterRuns: 4 }),
    ball(0, { strikerId: "b", dismissalType: "bowled" }),
  ]);
  assert.deepEqual([first?.playerId, first?.runs, first?.balls, first?.sixes], ["a", 6, 1, 1]);
  assert.deepEqual([second?.playerId, second?.out], ["b", true]);
});

test("bowlers are not credited with run outs and are not charged byes", () => {
  const [first, second] = topBowlers([
    ball(0, { bowlerId: "x", dismissalType: "caught" }),
    ball(0, { bowlerId: "x", bye: 4 }),
    ball(0, { bowlerId: "y", dismissalType: "run-out" }),
    ball(0, { bowlerId: "y", legal: false, noBall: 1, batterRuns: 2 }),
  ]);
  assert.deepEqual([first?.playerId, first?.wickets, first?.runs, first?.overs], ["x", 1, 0, "0.2"]);
  assert.deepEqual([second?.playerId, second?.wickets, second?.runs], ["y", 0, 3]);
});

test("required rate falls as the chase scores faster than needed", () => {
  // Chasing 61 in 10 overs: 6.1 an over at the start.
  const balls = Array.from({ length: 12 }, (_, index) => ball(Math.floor(index / 6), { batterRuns: 2 }));
  const rates = requiredRateByOver(overProgression(balls), 61, 10);
  // After 2 overs: 37 needed from 48 balls = 4.63 an over.
  assert.deepEqual(rates, [
    { over: 0, rate: 6.1 },
    { over: 1, rate: 5.44 },
    { over: 2, rate: 4.63 },
  ]);
});

test("required rate stops once the target is reached", () => {
  const balls = Array.from({ length: 6 }, () => ball(0, { batterRuns: 6 }));
  assert.equal(requiredRateByOver(overProgression(balls), 30, 5).at(-1)?.rate, null);
});

test("all-rounders must bat and bowl and rank by runs plus 20 per wicket", () => {
  const balls = [
    // a: 30 runs batting, no bowling. b: 10 runs and 2 wickets. c: 25 runs and 0 wickets.
    ...Array.from({ length: 5 }, () => ball(0, { strikerId: "a", batterRuns: 6, bowlerId: "z" })),
    ball(1, { strikerId: "b", batterRuns: 10 as number, bowlerId: "z" }),
    ball(2, { strikerId: "c", batterRuns: 25 as number, bowlerId: "z" }),
    ball(3, { strikerId: "q", bowlerId: "b", dismissalType: "bowled" }),
    ball(3, { strikerId: "r", bowlerId: "b", dismissalType: "bowled" }),
    ball(4, { strikerId: "q", bowlerId: "c", batterRuns: 1 }),
  ];
  const lines = topAllRounders(balls);
  assert.deepEqual(
    lines.map((line) => [line.playerId, line.runs, line.wickets]),
    [
      ["b", 10, 2],
      ["c", 25, 0],
    ],
  );
});

test("Manhattan lines up each innings' runs per over side by side", () => {
  const first = [ball(0, { batterRuns: 4 }), ball(1, { batterRuns: 1, dismissalType: "bowled" })];
  const second = [ball(0, { batterRuns: 2 })];
  const overs = manhattan([first, second]);
  assert.equal(overs.length, 2);
  assert.deepEqual(overs[0]?.innings, [{ runs: 4, wickets: 0 }, { runs: 2, wickets: 0 }]);
  assert.deepEqual(overs[1]?.innings, [{ runs: 1, wickets: 1 }, null]);
});

test("worm starts at zero and accumulates runs at the end of each over", () => {
  const points = worm([ball(0, { batterRuns: 4 }), ball(0, { wide: 1, legal: false }), ball(1, { batterRuns: 6 })]);
  assert.deepEqual(points.map((point) => point.total), [0, 5, 11]);
});

test("partnerships split at each wicket, include extras and credit each batter's bat runs", () => {
  const stands = partnerships([
    ball(0, { strikerId: "a", nonStrikerId: "b", batterRuns: 4 }),
    ball(0, { strikerId: "b", nonStrikerId: "a", batterRuns: 1 }),
    ball(0, { strikerId: "a", nonStrikerId: "b", wide: 1, legal: false }),
    ball(0, { strikerId: "a", nonStrikerId: "b", dismissalType: "bowled", dismissedId: "a" }),
    ball(0, { strikerId: "c", nonStrikerId: "b", batterRuns: 2 }),
  ]);
  assert.equal(stands.length, 2);
  assert.deepEqual(stands[0], { wicket: 1, batters: ["a", "b"], contributions: [4, 1], runs: 6, balls: 3, unbroken: false });
  assert.deepEqual(stands[1], { wicket: 2, batters: ["c", "b"], contributions: [2, 0], runs: 2, balls: 1, unbroken: true });
});
