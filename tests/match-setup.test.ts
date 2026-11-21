import assert from "node:assert/strict";
import test from "node:test";
import { validateCloudMatchSetup, validateDeviceMatchSetup } from "../src/lib/match-setup.ts";

const device = {
  homeName: "Northside CC",
  awayName: "Southside CC",
  homePlayers: "A Khan\nB Patel\nC Ali",
  awayPlayers: "F Smith\nG Jones\nH Williams",
  overs: "20",
  format: "T20" as const,
};

const clubs = [
  { id: "north", playerIds: ["a", "b", "c"] },
  { id: "south", playerIds: ["x", "y", "z"] },
];

test("real device match setup accepts independent lineups and integer overs", () => {
  assert.deepEqual(validateDeviceMatchSetup(device), {
    ok: true,
    homeLineup: ["A Khan", "B Patel", "C Ali"],
    awayLineup: ["F Smith", "G Jones", "H Williams"],
    oversPerInnings: 20,
  });
  assert.deepEqual(
    validateDeviceMatchSetup({ ...device, format: "Multi-day", overs: "" }),
    { ok: true, homeLineup: ["A Khan", "B Patel", "C Ali"], awayLineup: ["F Smith", "G Jones", "H Williams"], oversPerInnings: null },
  );
});

test("device setup refuses fake or ambiguous match identities", () => {
  for (const draft of [
    { ...device, homeName: "" },
    { ...device, homeName: "Northside CC", awayName: " northside cc " },
    { ...device, awayPlayers: "F Smith" },
    { ...device, homePlayers: "A Khan\na khan\nC Ali" },
    { ...device, awayPlayers: Array.from({ length: 12 }, (_, index) => `Player ${index}`).join("\n") },
  ]) {
    assert.equal(validateDeviceMatchSetup(draft).ok, false);
  }
});

test("over limits must be safe whole numbers, not silently coerced", () => {
  for (const overs of ["", "0", "-1", "1.5", "20.5", "NaN", "Infinity", "1e3", "101", "999999999999999999999"]) {
    const local = validateDeviceMatchSetup({ ...device, overs });
    const cloud = validateCloudMatchSetup({
      homeTeamId: "north",
      awayTeamId: "south",
      battingFirstTeamId: "north",
      teams: clubs,
      overs,
    });
    assert.equal(local.ok, false, `Local scorer must reject ${overs}`);
    assert.equal(cloud.ok, false, `Club creator must reject ${overs}`);
  }
});

test("cloud match setup requires two registered, populated, distinct teams", () => {
  const valid = {
    homeTeamId: "north",
    awayTeamId: "south",
    battingFirstTeamId: "south",
    teams: clubs,
    overs: "50",
  };
  assert.deepEqual(validateCloudMatchSetup(valid), { ok: true, oversPerInnings: 50 });
  for (const invalid of [
    { ...valid, awayTeamId: "north" },
    { ...valid, homeTeamId: "unregistered" },
    { ...valid, battingFirstTeamId: "other" },
    { ...valid, teams: [{ id: "north", playerIds: ["a"] }, clubs[1]!] },
    { ...valid, teams: [{ id: "north", playerIds: ["a", "a"] }, clubs[1]!] },
  ]) {
    assert.equal(validateCloudMatchSetup(invalid).ok, false);
  }
});
