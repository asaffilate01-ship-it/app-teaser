import assert from "node:assert/strict";
import test from "node:test";
import {
  abandonForRain,
  createMatch,
  currentInnings,
  liveParScore,
  matchResult,
  recordDelivery,
  startNextInnings,
  targetForCurrentInnings,
  inningsBallLimit,
  type CricketMatch,
  type RecordDeliveryInput,
} from "../src/lib/cricket.ts";
import {
  arrPar,
  arrTarget,
  defaultMinOversForResult,
  mpoPar,
  mpoTarget,
} from "../src/lib/rain-rules.ts";

test("average run rate target: 180 in 20 overs, chase cut to 12 overs → 109", () => {
  assert.equal(arrTarget(180, 20, 12), 109);
});

test("average run rate par after 10 overs of a 180 in 20 chase is 90", () => {
  assert.equal(arrPar(180, 20, 60, 6), 90);
});

test("most productive overs target uses the first side's best overs", () => {
  assert.equal(mpoTarget([4, 0, 6, 2, 1, 0, 3, 5, 6, 4], 5), 26);
  assert.equal(mpoPar([4, 0, 6, 2, 1, 0, 3, 5, 6, 4], 15, 6), 14); // 6 + 6 + half of 5, rounded down
});

test("minimum overs for a result: 2 (≤10 overs), 5 (≤20), 20 (longer)", () => {
  assert.equal(defaultMinOversForResult(10), 2);
  assert.equal(defaultMinOversForResult(20), 5);
  assert.equal(defaultMinOversForResult(50), 20);
});

function makeMatch(): CricketMatch {
  const names = (side: string) => Array.from({ length: 11 }, (_, i) => `${side} ${i + 1}`);
  return createMatch({
    homeTeamName: "Home XI",
    awayTeamName: "Away XI",
    homePlayers: names("Home"),
    awayPlayers: names("Away"),
    battingFirst: "home",
    settings: {
      format: "T10",
      oversPerInnings: 10,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "Test Ground",
      weather: "Rain",
      startTime: "2026-11-23T10:00:00Z",
      rules: {},
    },
  });
}
function ball(match: CricketMatch, runs = 0): RecordDeliveryInput {
  const innings = currentInnings(match);
  return {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Medium",
    outcome: runs ? "hit" : "hit-no-run",
    batterRuns: runs,
  };
}
/** One over: the given runs off the first ball (boundaries kept as 4/6 so strike stays), then dots. */
function over(match: CricketMatch, runs: number): CricketMatch {
  let next = match;
  for (let i = 0; i < 6; i++) next = recordDelivery(next, ball(next, i === 0 ? runs : 0));
  return next;
}
/** First innings of 31 in 10 overs: [4,0,6,2,1,0,3,5,6,4]. */
function firstInnings(): CricketMatch {
  let match = makeMatch();
  for (const runs of [4, 0, 6, 2, 1, 0, 3, 5, 6, 4]) match = over(match, runs);
  assert.equal(match.status, "innings-break");
  return startNextInnings(match);
}

test("ARR: chase cut to 5 overs → target 16 and 30 balls", () => {
  const match = { ...firstInnings(), rain: { method: "arr" as const, revisedOvers: 5 } };
  assert.equal(targetForCurrentInnings(match), 16);
  assert.equal(inningsBallLimit(match, currentInnings(match)), 30);
});

test("MPO: chase cut to 5 overs → target 26", () => {
  const match = { ...firstInnings(), rain: { method: "mpo" as const, revisedOvers: 5 } };
  assert.equal(targetForCurrentInnings(match), 26);
});

test("DLS: the official target entered by the scorer is used as-is", () => {
  const match = {
    ...firstInnings(),
    rain: { method: "dls" as const, revisedOvers: 5, officialTarget: 19 },
  };
  assert.equal(targetForCurrentInnings(match), 19);
});

test("abandoned ahead of the ARR par: chasing side wins (ARR)", () => {
  let match: CricketMatch = { ...firstInnings(), rain: { method: "arr", revisedOvers: 5 } };
  match = over(match, 6);
  match = over(match, 4);
  match = over(match, 2); // 12 from 3 overs; par = floor(31 × 3 / 10) = 9
  assert.equal(liveParScore(match), 9);
  const result = matchResult(abandonForRain(match));
  assert.equal(result?.text, "Away XI won by 10 wickets (ARR)");
});

test("abandoned behind the ARR par: defending side wins by the shortfall", () => {
  let match: CricketMatch = { ...firstInnings(), rain: { method: "arr", revisedOvers: 5 } };
  match = over(match, 2);
  match = over(match, 2);
  match = over(match, 1); // 5 from 3 overs; par 9
  assert.equal(matchResult(abandonForRain(match))?.text, "Home XI won by 4 runs (ARR)");
});

test("abandoned before the minimum overs: no result", () => {
  let match: CricketMatch = { ...firstInnings(), rain: { method: "arr", revisedOvers: 5 } };
  match = over(match, 6); // 1 over; minimum is 2
  assert.equal(matchResult(abandonForRain(match))?.text, "No result (rain)");
});

test("DLS abandonment waits for the official par, then decides on it", () => {
  let match: CricketMatch = {
    ...firstInnings(),
    rain: { method: "dls", revisedOvers: 5, officialTarget: 19 },
  };
  match = over(match, 6);
  match = over(match, 4); // 10 from 2 overs
  assert.equal(matchResult(abandonForRain(match))?.text, "Awaiting official par score");
  const withPar = abandonForRain({ ...match, rain: { ...match.rain!, officialPar: 11 } });
  assert.equal(matchResult(withPar)?.text, "Home XI won by 1 run (DLS)");
});

test("no win chances are shown once a rain result is decided", async () => {
  const { currentPrediction } = await import("../src/lib/win-timeline.ts");
  let match: CricketMatch = { ...firstInnings(), rain: { method: "arr", revisedOvers: 5 } };
  match = over(match, 6);
  assert.notEqual(currentPrediction(match), null);
  assert.equal(currentPrediction(abandonForRain(match)), null);
});
