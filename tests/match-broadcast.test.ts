import assert from "node:assert/strict";
import test from "node:test";
import { ballCaption, ballTone, chaseState, projectedScore, teamInitials } from "../src/lib/match-broadcast.ts";

const none = { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0 };

test("team crest initials", () => {
  assert.equal(teamInitials("Kings XI"), "KX");
  assert.equal(teamInitials("Warriors"), "WA");
});

test("projected score uses the current run rate over the full innings", () => {
  assert.equal(projectedScore(78, 52, 20), 180);
  assert.equal(projectedScore(10, 0, 20), null);
  assert.equal(projectedScore(120, 30, null), null);
});

test("chase needs runs, balls left and required rate", () => {
  assert.deepEqual(chaseState(150, 113, 110, 20), { runsNeeded: 37, ballsLeft: 10, requiredRate: 22.2 });
  assert.equal(chaseState(null, 10, 6, 20), null);
});

test("ball tones and captions", () => {
  assert.equal(ballTone({ batterRuns: 4, extras: none }), "boundary");
  assert.equal(ballTone({ batterRuns: 0, extras: { ...none, noBall: 1 } }), "extra");
  assert.equal(ballTone({ batterRuns: 0, extras: none }), "dot");
  assert.equal(ballCaption({ batterRuns: 1, extras: none }), "Single");
  assert.equal(ballCaption({ batterRuns: 0, extras: { ...none, wide: 1 } }), "Wide");
});
