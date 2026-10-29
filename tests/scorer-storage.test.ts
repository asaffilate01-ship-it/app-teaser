import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatch, recordDelivery, currentInnings } from "../src/lib/cricket.ts";
import {
  parseScorerMatches,
  parseScorerBackup,
  copyBackupMatches,
  maxBackupBytes,
} from "../src/lib/scorer-storage.ts";
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

test("backup import accepts single exports and lists, but rejects empty or partial batches", () => {
  const original = fixture();
  assert.deepEqual(parseScorerBackup(JSON.stringify(original)), [original]);
  assert.deepEqual(parseScorerBackup(JSON.stringify([original])), [original]);
  for (const raw of ["[]", "null", "broken", JSON.stringify([original, {}])])
    assert.throws(() => parseScorerBackup(raw));
});
test("backup resource limits reject oversized files and more than 100 matches", () => {
  assert.throws(() => parseScorerBackup(" ".repeat(maxBackupBytes + 1)), /10 MB/);
  const original = fixture();
  const rows = Array.from({ length: 100 }, (_, index) => ({ ...original, id: String(index) }));
  assert.equal(parseScorerBackup(JSON.stringify(rows)).length, 100);
  assert.throws(
    () => parseScorerBackup(JSON.stringify([...rows, { ...original, id: "extra" }])),
    /1 to 100/,
  );
});
test("restoring always creates independent local identities and preserves source scores", () => {
  const original = fixture();
  original.id = "a1000000-0000-4000-8000-000000000001";
  const before = JSON.stringify(original);
  let sequence = 0;
  const copied = copyBackupMatches([original, original], () => String(++sequence));
  assert.deepEqual(
    copied.map((match) => match.id),
    ["restored-1", "restored-2"],
  );
  assert.equal(JSON.stringify(original), before);
  copied[0]!.teams[0].name = "Edited local copy";
  assert.equal(original.teams[0].name, "Home");
  assert.equal(copied[1]!.teams[0].name, "Home");
});
