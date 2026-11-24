import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, currentInnings, recordDelivery, retireBatter } from "../src/lib/cricket.ts";
import { fallOfWickets } from "../src/lib/scorecard.ts";
import { winTimeline } from "../src/lib/win-timeline.ts";

function fixture() {
  return createMatch({
    homeTeamName: "Home",
    awayTeamName: "Away",
    homePlayers: ["A", "B", "C", "D"],
    awayPlayers: ["W", "X", "Y", "Z"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: 20,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "Ground",
      weather: "Dry",
      startTime: "2026-11-24T12:00:00Z",
    },
  });
}

function score(match: ReturnType<typeof fixture>, runs: number) {
  const innings = currentInnings(match);
  return recordDelivery(match, {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Medium",
    outcome: runs ? "hit" : "hit-no-run",
    batterRuns: runs,
  });
}

test("scorecard records a retirement wicket before the first delivery", () => {
  const original = fixture();
  const match = retireBatter(original, currentInnings(original).strikerId, "out");
  const wickets = fallOfWickets(match, currentInnings(match));
  assert.equal(wickets.length, 1);
  assert.equal(wickets[0]?.score, 0);
  assert.equal(wickets[0]?.over, "0.0");
});

test("retired hurt is not a wicket; retired out uses the score at retirement", () => {
  const original = score(fixture(), 4);
  const hurt = retireBatter(original, currentInnings(original).strikerId, "hurt");
  assert.deepEqual(fallOfWickets(hurt, currentInnings(hurt)), []);
  const out = retireBatter(original, currentInnings(original).strikerId, "out");
  assert.equal(fallOfWickets(out, currentInnings(out))[0]?.score, 4);
  assert.equal(fallOfWickets(out, currentInnings(out))[0]?.over, "0.1");
});

test("pairs cricket fall of wickets deducts the wicket penalty", () => {
  const original = fixture();
  original.settings.rules = { pairs: { oversPerPair: 4, runsPerWicket: 5 } };
  const innings = currentInnings(original);
  const match = recordDelivery(original, {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Medium",
    outcome: "wicket",
    batterRuns: 0,
    dismissal: { type: "bowled", batterId: innings.strikerId },
  });
  assert.equal(fallOfWickets(match, currentInnings(match))[0]?.score, -5);
});

test("a later retirement does not change earlier win timeline points", () => {
  let match = fixture();
  for (let i = 0; i < 7; i += 1) match = score(match, 0);
  const before = winTimeline(match);
  const after = winTimeline(retireBatter(match, currentInnings(match).strikerId, "out"));
  assert.ok(before.length >= 3);
  assert.deepEqual(after.slice(0, -1), before.slice(0, -1));
});
