import assert from "node:assert/strict";
import test from "node:test";
import {
  correctDelivery,
  createMatch,
  currentInnings,
  recordDelivery,
  setDeliverySpeed,
} from "../src/lib/cricket.ts";
import { readScorerSnapshot, parseScorerBackup } from "../src/lib/scorer-storage.ts";
import {
  createVideoSpeedEvidence,
  validateVideoSpeedEvidence,
  type VideoSpeedInput,
} from "../src/lib/speed-evidence.ts";

const input: VideoSpeedInput = {
  method: "manual",
  firstSeconds: 1,
  secondSeconds: 1.45,
  distanceMetres: 18,
  distanceErrorMetres: 0.1,
  mediaFps: 120,
  timeScale: 1,
};

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

test("reviewed video evidence can reproduce its speed and uncertainty", () => {
  const evidence = createVideoSpeedEvidence(input);
  assert.ok(evidence);
  assert.equal(evidence.kph, 144);
  assert.equal(evidence.metric, "video_segment_average");
  assert.deepEqual(validateVideoSpeedEvidence(JSON.parse(JSON.stringify(evidence))), evidence);
  assert.equal(createVideoSpeedEvidence({ ...input, mediaFps: 30 }), null);
  assert.equal(createVideoSpeedEvidence({ ...input, distanceErrorMetres: 20 }), null);
  assert.equal(createVideoSpeedEvidence({ ...input, timeScale: NaN }), null);
  assert.equal(validateVideoSpeedEvidence({ ...evidence, kph: 150 }), null);
  assert.equal(validateVideoSpeedEvidence({ ...evidence, highKph: 300 }), null);
  assert.equal(validateVideoSpeedEvidence({ ...evidence, metric: "radar_release" }), null);
});

test("reviewed delivery evidence survives backup and cloud snapshot parsing", () => {
  const match = fixture();
  const deliveryId = currentInnings(match).deliveries[0]!.id;
  const evidence = createVideoSpeedEvidence(input);
  assert.ok(evidence);
  const next = setDeliverySpeed(match, deliveryId, evidence.kph, evidence);
  assert.deepEqual(currentInnings(next).deliveries[0]!.speedEvidence, evidence);
  assert.deepEqual(parseScorerBackup(JSON.stringify(next)), [next]);
  assert.deepEqual(readScorerSnapshot(next, match.id), next);
  assert.equal(setDeliverySpeed(match, deliveryId, 120, evidence), match);
  assert.equal(setDeliverySpeed(next, deliveryId, NaN), next);
});

test("score corrections retain the measurement, and replacement or clearing removes stale evidence", () => {
  const match = fixture();
  const deliveryId = currentInnings(match).deliveries[0]!.id;
  const evidence = createVideoSpeedEvidence(input);
  assert.ok(evidence);
  const next = setDeliverySpeed(match, deliveryId, evidence.kph, evidence);
  const corrected = correctDelivery(next, deliveryId, { batterRuns: 2 });
  assert.ok("match" in corrected);
  const ball = currentInnings(corrected.match).deliveries[0]!;
  assert.equal(ball.batterRuns, 2);
  assert.deepEqual(ball.speedEvidence, evidence);
  const legacy = setDeliverySpeed(corrected.match, deliveryId, 121);
  assert.equal(currentInnings(legacy).deliveries[0]!.speedEvidence, undefined);
  assert.ok(readScorerSnapshot(legacy, match.id));
  const cleared = setDeliverySpeed(next, deliveryId, null);
  assert.equal(currentInnings(cleared).deliveries[0]!.speedKph, undefined);
  assert.equal(currentInnings(cleared).deliveries[0]!.speedEvidence, undefined);
});

test("inconsistent speed metadata is not accepted as a valid scorer snapshot", () => {
  const match = fixture();
  const deliveryId = currentInnings(match).deliveries[0]!.id;
  const evidence = createVideoSpeedEvidence(input);
  assert.ok(evidence);
  const next = setDeliverySpeed(match, deliveryId, evidence.kph, evidence);
  const altered = structuredClone(next);
  currentInnings(altered).deliveries[0]!.speedKph = 160;
  assert.equal(readScorerSnapshot(altered, match.id), null);
  assert.throws(() => parseScorerBackup(JSON.stringify(altered)), /incomplete or unsupported/);
});
