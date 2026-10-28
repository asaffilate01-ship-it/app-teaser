import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatch, recordDelivery, currentInnings } from "../src/lib/cricket.ts";
import { parseScorerMatches } from "../src/lib/scorer-storage.ts";
function fixture() {
  return createMatch({
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
      startTime: "2026-10-28",
    },
  });
}
test("saved matches round-trip deliveries and preserve future fields", () => {
  const match = fixture(),
    innings = currentInnings(match);
  const scored = recordDelivery(match, {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: "Pavilion",
    deliveryStyle: "Fast",
    outcome: "hit",
    batterRuns: 4,
  });
  const rows = [{ ...scored, futureField: { keep: true } }];
  assert.deepEqual(parseScorerMatches(JSON.stringify(rows)), JSON.parse(JSON.stringify(rows)));
  assert.deepEqual(parseScorerMatches("[]"), []);
});
test("malformed data and invalid scorer structure are rejected as a whole", () => {
  const match = fixture();
  for (const raw of [
    "{bad",
    "null",
    "{}",
    "[null]",
    JSON.stringify([match, { id: "incomplete" }]),
    JSON.stringify([match, match]),
    JSON.stringify([{ ...match, innings: [] }]),
    JSON.stringify([{ ...match, settings: { ...match.settings, ballsPerOver: 0 } }]),
    JSON.stringify([{ ...match, innings: [{ ...match.innings[0], battingTeamId: "missing" }] }]),
  ])
    assert.throws(() => parseScorerMatches(raw));
});
