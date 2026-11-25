import assert from "node:assert/strict";
import test from "node:test";
import {
  correctDelivery,
  createMatch,
  currentInnings,
  deliveryRuns,
  nextBallIsFreeHit,
  recordDelivery,
  summarizeInnings,
  type CricketMatch,
  type RecordDeliveryInput,
} from "../src/lib/cricket.ts";

function newMatch() {
  return createMatch({
    homeTeamName: "Home",
    awayTeamName: "Away",
    homePlayers: ["A", "B", "C"],
    awayPlayers: ["D", "E", "F"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: 20,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "Test",
      weather: "Dry",
      startTime: new Date().toISOString(),
      rules: { freeHit: true },
    },
  });
}

function input(match: CricketMatch, overrides: Partial<RecordDeliveryInput> = {}) {
  const innings = currentInnings(match);
  return {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Medium" as const,
    outcome: "hit-no-run" as const,
    batterRuns: 0,
    ...overrides,
  };
}

test("stopped play blocks new deliveries but permits historical corrections", () => {
  const match = newMatch();
  const scored = recordDelivery(match, input(match, { batterRuns: 2 }));
  const paused: CricketMatch = {
    ...scored,
    stoppage: { reason: "rain", since: new Date().toISOString() },
  };
  assert.equal(recordDelivery(paused, input(paused)), paused);
  const result = correctDelivery(paused, currentInnings(paused).deliveries[0]!.id, {
    batterRuns: 4,
  });
  assert.ok("match" in result);
  assert.deepEqual(result.match.stoppage, paused.stoppage);
  assert.equal(summarizeInnings(currentInnings(result.match)).runs, 4);
});

test("invalid run or extra counts cannot change the score", () => {
  const match = newMatch();
  for (const batterRuns of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(recordDelivery(match, input(match, { batterRuns })), match);
  }
  for (const extras of [{ wide: -1 }, { noBall: NaN }, { bye: 1.5 }, { penalty: Infinity }]) {
    assert.equal(recordDelivery(match, input(match, { extras })), match);
  }
});

test("totals exclude unrelated metadata and retain wicket penalties", () => {
  const match = newMatch();
  const scored = recordDelivery(
    match,
    input(match, { batterRuns: 2, extras: { noBall: 1, penalty: 5 } }),
  );
  const innings = currentInnings(scored);
  const delivery = innings.deliveries[0]!;
  const extras = { ...delivery.extras, newerField: 99 };
  const reviewed = { ...delivery, extras, wicketPenalty: 3 };
  assert.equal(deliveryRuns(reviewed), 8);
  const summary = summarizeInnings({ ...innings, deliveries: [reviewed] });
  assert.equal(summary.runs, 5);
  assert.equal(summary.extras.total, 6);
  assert.equal(summary.legalBalls, 0);
});

test("free hits survive intervening wides and end on a legal ball", () => {
  let match = newMatch();
  match = recordDelivery(match, input(match, { extras: { noBall: 1 } }));
  assert.equal(nextBallIsFreeHit(match), true);
  match = recordDelivery(match, input(match, { extras: { wide: 1 } }));
  assert.equal(nextBallIsFreeHit(match), true);
  match = recordDelivery(match, input(match));
  assert.equal(nextBallIsFreeHit(match), false);
});
