import assert from "node:assert/strict";
import test from "node:test";
import { matchDeskCounts, selectDeskMatches } from "../src/lib/match-desk.ts";

const teams = [
  { id: "a", name: "Café Cricket", shortName: "CAF" },
  { id: "b", name: "North XI", shortName: "NXI" },
];
const grounds = [{ id: "g", name: "Central Park" }];
const base = {
  homeTeamId: "a",
  awayTeamId: "b",
  groundId: "g",
  scheduledAt: "2027-01-01T12:00:00Z",
  updatedAt: "2026-11-24T12:00:00Z",
};
const matches = [
  { ...base, id: "archive", status: "completed" },
  { ...base, id: "later", status: "scheduled" },
  { ...base, id: "break", status: "innings_break" },
  { ...base, id: "draft", status: "draft", scheduledAt: null },
  { ...base, id: "earlier", status: "scheduled", scheduledAt: "2026-12-01T12:00:00Z" },
  { ...base, id: "live", status: "live" },
];

test("match desk counts include innings breaks and keep drafts separate from scheduled matches", () => {
  assert.deepEqual(matchDeskCounts(matches), {
    all: 6,
    live: 2,
    scheduled: 2,
    draft: 1,
    archive: 1,
  });
});

test("live matches precede scheduled fixtures, drafts and archives", () => {
  const result = selectDeskMatches(matches, teams, grounds, "all", "");
  assert.deepEqual(
    result.map((match) => match.id),
    ["break", "live", "earlier", "later", "draft", "archive"],
  );
  assert.equal(matches[0]?.id, "archive");
});

test("search supports team short names, accents, ground names and multiple words", () => {
  assert.equal(selectDeskMatches(matches, teams, grounds, "live", "cafe central").length, 2);
  assert.equal(selectDeskMatches(matches, teams, grounds, "scheduled", "NXI").length, 2);
  assert.equal(selectDeskMatches(matches, teams, grounds, "all", "unknown").length, 0);
});

test("invalid or missing scheduled dates sort after valid scheduled dates", () => {
  const result = selectDeskMatches(
    [
      { ...base, id: "invalid", status: "scheduled", scheduledAt: "invalid" },
      { ...base, id: "valid", status: "scheduled" },
      { ...base, id: "missing", status: "scheduled", scheduledAt: null },
    ],
    teams,
    grounds,
    "scheduled",
    "",
  );
  assert.equal(result[0]?.id, "valid");
});
