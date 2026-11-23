import test from "node:test";
import assert from "node:assert/strict";
import { ballLabel, ballText, canConfirmScorecard, oversOf, oversText, type CheckBall, type CheckFlag } from "../src/lib/check-scoring.ts";
import { creditedClub } from "../src/lib/promo-credit.ts";

const none = { bye: 0, legBye: 0, noBall: 0, penalty: 0, wide: 0 };
const ball = (over: number, n: number, patch: Partial<CheckBall> = {}): CheckBall => ({
  id: `${over}.${n}`, innings_id: "i1", sequence: over * 10 + n, over, ball: n, outcome: "hit",
  batter_runs: 0, extras: none, total_runs: 0, legal: true, wicket: false, dismissal: null, striker: null, bowler: null, ...patch,
});
const flag = (status: CheckFlag["status"]): CheckFlag => ({
  id: status, delivery_id: null, innings_number: 1, ball_label: "0.1", note: "Was this a four?", status,
  raised_at: "2026-11-23T10:00:00Z", reply: null, resolved_at: null,
});

test("balls read in plain words for the check scorer", () => {
  assert.equal(ballText(ball(0, 1, { batter_runs: 4, total_runs: 4 })), "4 runs");
  assert.equal(ballText(ball(0, 2, { extras: { ...none, wide: 1 }, total_runs: 1, legal: false })), "Wide +1");
  assert.equal(ballText(ball(0, 3, { extras: { ...none, noBall: 1 }, batter_runs: 2, total_runs: 3 })), "No-ball +3 · 2 runs");
  assert.equal(ballText(ball(0, 4, { extras: { ...none, legBye: 2 }, total_runs: 2 })), "2 leg-byes");
  assert.equal(ballText(ball(0, 5, { wicket: true, dismissal: { type: "caught" } })), "WICKET (caught)");
  assert.equal(ballText(ball(0, 6)), "Dot ball");
  assert.equal(ballLabel(ball(3, 4)), "3.4");
});

test("overs are grouped newest first with their runs", () => {
  const overs = oversOf([ball(0, 1, { total_runs: 4 }), ball(0, 2, { total_runs: 1 }), ball(1, 1, { total_runs: 6, wicket: false })], "i1");
  assert.deepEqual(overs.map((o) => [o.over, o.runs]), [[1, 6], [0, 5]]);
  assert.equal(oversText(23), "3.5");
});

test("the scorecard can only be confirmed when no query is still open", () => {
  assert.equal(canConfirmScorecard([flag("fixed"), flag("kept")]), true);
  assert.equal(canConfirmScorecard([flag("fixed"), flag("open")]), false);
  assert.equal(canConfirmScorecard([]), true);
});

test("public scoreboard plays credit the viewer's own playing club, otherwise the host", () => {
  const playing = ["away-club", "home-club"];
  assert.equal(creditedClub({ host: "home-club", playing, viewerClubs: ["away-club"] }), "away-club");
  assert.equal(creditedClub({ host: "home-club", playing, viewerClubs: ["home-club"] }), "home-club");
  assert.equal(creditedClub({ host: "home-club", playing, viewerClubs: ["some-other-club"] }), "home-club");
  assert.equal(creditedClub({ host: "home-club", playing, viewerClubs: [] }), "home-club");
});
