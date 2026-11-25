import assert from "node:assert/strict";
import test from "node:test";
import {
  createMatch,
  currentInnings,
  recordDelivery,
  setDeliverySpeed,
  type Delivery,
} from "../src/lib/cricket.ts";
import {
  bowlingSpeedInsights,
  deliverySpeedReview,
  latestDeliverySpeed,
} from "../src/lib/match-speed-insights.ts";
import { publicLiveState } from "../src/lib/public-match-state.ts";
import { createVideoSpeedEvidence } from "../src/lib/speed-evidence.ts";

function fixture() {
  const match = createMatch({
    homeTeamName: "Home",
    awayTeamName: "Away",
    homePlayers: ["One", "Two"],
    awayPlayers: ["Three", "Four"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: 20,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "Ground",
      weather: "Dry",
      startTime: "2026-11-25",
    },
  });
  const innings = currentInnings(match);
  return recordDelivery(match, {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: "Pavilion",
    deliveryStyle: "Fast",
    outcome: "hit",
    batterRuns: 4,
  });
}

function evidence(metres: number) {
  const result = createVideoSpeedEvidence({
    method: "manual",
    firstSeconds: 0,
    secondSeconds: 0.45,
    distanceMetres: metres,
    distanceErrorMetres: 0.1,
    mediaFps: 120,
    timeScale: 1,
  });
  assert.ok(result);
  return result;
}

const first = currentInnings(fixture()).deliveries[0]!;
const reviewed = (id: string, bowlerId: string, metres: number): Delivery => {
  const measurement = evidence(metres);
  return { ...first, id, bowlerId, speedKph: measurement.kph, speedEvidence: measurement };
};

test("only consistent reviewed speed evidence contributes to bowling statistics", () => {
  const a = reviewed("a", "bowler-a", 18);
  const b = reviewed("b", "bowler-a", 15);
  const legacy = { ...first, id: "c", bowlerId: "bowler-a", speedKph: 160 };
  const invalid = { ...a, id: "d", speedKph: 150 };
  const missing = { ...first, id: "e", bowlerId: "bowler-b", legal: false };
  const insights = bowlingSpeedInsights([a, b, legacy, invalid, missing]);
  assert.equal(insights.deliveries, 5);
  assert.equal(insights.reviewed, 2);
  assert.equal(insights.legacy, 1);
  assert.equal(insights.invalid, 1);
  assert.equal(insights.missing, 1);
  assert.equal(insights.coveragePercent, 40);
  assert.equal(insights.bowlers[0]?.average, 132);
  assert.equal(insights.bowlers[0]?.fastest, 144);
  assert.equal(insights.bowlers[0]?.slowest, 120);
  assert.equal(insights.bowlers[1]?.average, null);
  assert.deepEqual(
    insights.recent.map((item) => item.delivery.id),
    ["b", "a"],
  );
});

test("the latest-ball indicator never reuses a prior delivery estimate", () => {
  const measured = reviewed("a", "bowler", 18);
  assert.equal(latestDeliverySpeed([measured])?.evidence.kph, 144);
  assert.equal(latestDeliverySpeed([measured, first]), null);
  assert.equal(latestDeliverySpeed([measured, { ...first, speedKph: 130 }]), null);
  assert.equal(latestDeliverySpeed([{ ...measured, speedKph: 150 }]), null);
  assert.equal(latestDeliverySpeed([]), null);
  assert.equal(deliverySpeedReview({ speedKph: NaN }).status, "invalid");
});

test("recent measurements remain bounded and retain scorer delivery order", () => {
  const balls = Array.from({ length: 20 }, (_, i) => reviewed(String(i), "bowler", 18));
  const insights = bowlingSpeedInsights(balls);
  assert.equal(insights.reviewed, 20);
  assert.equal(insights.recent.length, 12);
  assert.equal(insights.recent[0]?.delivery.id, "19");
  assert.equal(insights.recent.at(-1)?.delivery.id, "8");
  assert.equal(bowlingSpeedInsights([]).coveragePercent, 0);
});

test("private speed evidence does not change the public scoreboard projection", () => {
  const match = fixture();
  const measurement = evidence(18);
  const id = currentInnings(match).deliveries[0]!.id;
  const updated = setDeliverySpeed(match, id, measurement.kph, measurement);
  assert.deepEqual(publicLiveState(updated), publicLiveState(match));
});
