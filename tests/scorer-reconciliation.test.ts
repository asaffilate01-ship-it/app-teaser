import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, currentInnings, recordDelivery } from "../src/lib/cricket.ts";
import { reviewRemoteScorerSnapshot } from "../src/lib/scorer-reconciliation.ts";

function fixture() {
  return createMatch({
    homeTeamName: "North",
    awayTeamName: "South",
    homePlayers: ["A", "B", "C"],
    awayPlayers: ["X", "Y", "Z"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: 20,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "Club",
      weather: "Clear",
      startTime: new Date("2026-11-20T12:00:00Z").toISOString(),
    },
  });
}

function addBall(match: ReturnType<typeof fixture>, runs: number) {
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

test("an identical score and a longer matching cloud score are safe", () => {
  const base = fixture();
  assert.deepEqual(reviewRemoteScorerSnapshot(base, structuredClone(base)), {
    safe: true,
    reason: null,
  });
  const remote = addBall(base, 1);
  assert.equal(reviewRemoteScorerSnapshot(base, remote).safe, true);
});

test("an older cloud snapshot never replaces locally recorded deliveries", () => {
  const base = fixture();
  const scored = addBall(base, 4);
  const checked = reviewRemoteScorerSnapshot(scored, base);
  assert.equal(checked.safe, false);
  assert.match(checked.reason ?? "", /missing recorded deliveries/i);
});

test("two devices that recorded different deliveries require review", () => {
  const base = fixture();
  const first = addBall(base, 1);
  const second = addBall(base, 4);
  const checked = reviewRemoteScorerSnapshot(first, second);
  assert.equal(checked.safe, false);
  assert.match(checked.reason ?? "", /differs between scorers/i);
});

test("same delivery identity but a different result is not silently accepted", () => {
  const first = addBall(fixture(), 2);
  const second = structuredClone(first);
  second.innings[0]!.deliveries[0]!.batterRuns = 6;
  const checked = reviewRemoteScorerSnapshot(first, second);
  assert.equal(checked.safe, false);
  assert.match(checked.reason ?? "", /edited on another scorer/i);
});

test("different teams, match identity or innings structure require review", () => {
  const base = fixture();
  const wrongMatch = structuredClone(base);
  wrongMatch.id = "unrelated";
  assert.equal(reviewRemoteScorerSnapshot(base, wrongMatch).safe, false);
  const wrongTeam = structuredClone(base);
  wrongTeam.teams[0].id = "different";
  assert.equal(reviewRemoteScorerSnapshot(base, wrongTeam).safe, false);
  const noInnings = structuredClone(base);
  noInnings.innings = [];
  assert.equal(reviewRemoteScorerSnapshot(base, noInnings).safe, false);
});
