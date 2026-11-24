import assert from "node:assert/strict";
import test from "node:test";
import { availabilitySummary, eventSquad, selectionWarnings } from "../src/lib/club-office.ts";

const teams = [
  { id: "own", playerIds: ["p1", "p1", "outside"] },
  { id: "empty", playerIds: [] },
  { id: "external", playerIds: ["p2"], external: true },
];
const players = ["p1", "p2", "p2"];

test("team events never expand missing, empty or external squads to the whole club", () => {
  assert.deepEqual(eventSquad("own", teams, players), ["p1"]);
  assert.deepEqual(eventSquad("missing", teams, players), []);
  assert.deepEqual(eventSquad("empty", teams, players), []);
  assert.deepEqual(eventSquad("external", teams, players), []);
  assert.deepEqual(eventSquad(null, teams, players), ["p1", "p2"]);
});

test("availability totals count each eligible player once", () => {
  assert.deepEqual(availabilitySummary(players, new Map([["p1", "available"]])), {
    available: 1,
    maybe: 0,
    unavailable: 0,
    waitlist: 0,
    noReply: ["p2"],
  });
});

test("a reserve captain or wicketkeeper cannot satisfy the playing-side checks", () => {
  const warnings = selectionWarnings(
    [
      { playerId: "p1", slot: "playing", captain: false, wicketkeeper: false },
      { playerId: "p2", slot: "reserve", captain: true, wicketkeeper: true },
    ],
    new Map(),
    1,
  );
  assert.ok(warnings.includes("No captain chosen."));
  assert.ok(warnings.includes("No wicketkeeper chosen."));
  assert.ok(warnings.includes("Captain and wicketkeeper must be selected to play."));
});

test("duplicate players and multiple playing captains are detected", () => {
  const warnings = selectionWarnings(
    [
      { playerId: "p1", slot: "playing", captain: true, wicketkeeper: true },
      { playerId: "p1", slot: "playing", captain: true, wicketkeeper: true },
    ],
    new Map(),
    2,
  );
  assert.ok(warnings.includes("More than one playing captain chosen."));
  assert.ok(warnings.includes("More than one playing wicketkeeper chosen."));
  assert.ok(warnings.includes("The team sheet contains duplicate players."));
});
