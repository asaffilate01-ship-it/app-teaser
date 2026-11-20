import assert from "node:assert/strict";
import test from "node:test";
import { fixtureCalendarIcs } from "../src/lib/fixture-calendar.ts";

test("scheduled fixtures export in UTC without inventing match end times", () => {
  const result = fixtureCalendarIcs({
    competitionId: "c1",
    competitionName: "Autumn Cup",
    seasonName: "2026",
    fixtures: [
      {
        id: "f1",
        startsAt: "2026-11-20T15:30:00+05:00",
        homeTeam: "North",
        awayTeam: "South",
        ground: "Main Ground",
        round: "Semi-final",
        status: "scheduled",
      },
    ],
    generatedAt: new Date("2026-11-19T12:00:00Z"),
  });
  assert.equal(result.included, 1);
  assert.equal(result.skipped, 0);
  assert.match(result.contents, /DTSTART:20261120T103000Z/);
  assert.match(result.contents, /UID:criclume-c1-f1@criclume.com/);
  assert.match(result.contents, /SUMMARY:North v South/);
  assert.equal(result.contents.includes("DTEND"), false);
});

test("unscheduled or timezone-ambiguous fixtures are excluded instead of guessed", () => {
  const result = fixtureCalendarIcs({
    competitionId: "c1",
    competitionName: "Cup",
    seasonName: "2026",
    fixtures: [
      {
        id: "a",
        startsAt: null,
        homeTeam: "A",
        awayTeam: "B",
        ground: null,
        round: null,
        status: "planned",
      },
      {
        id: "b",
        startsAt: "2026-11-20T17:00",
        homeTeam: "A",
        awayTeam: "B",
        ground: null,
        round: null,
        status: "planned",
      },
    ],
  });
  assert.equal(result.included, 0);
  assert.equal(result.skipped, 2);
  assert.equal(result.contents.includes("BEGIN:VEVENT"), false);
});

test("fixture names cannot inject extra calendar records, and long lines are folded", () => {
  const result = fixtureCalendarIcs({
    competitionId: "c1",
    competitionName: "Community Cup",
    seasonName: "2026",
    fixtures: [
      {
        id: "f1",
        startsAt: "2026-11-20T15:00:00Z",
        homeTeam: "North; Juniors, Boys",
        awayTeam: "South\r\nBEGIN:VEVENT",
        ground: "Example Cricket Ground",
        round:
          "Regional qualifying tournament with a very long descriptive title and extra details",
        status: "scheduled",
      },
    ],
  });
  assert.equal(result.contents.split("\r\n").filter((line) => line === "BEGIN:VEVENT").length, 1);
  assert.match(result.contents, /North\\; Juniors\\, Boys/);
  assert.equal(result.contents.includes("\r\nBEGIN:VEVENT\r\n"), true);
  for (const line of result.contents.split("\r\n")) {
    assert.ok(new TextEncoder().encode(line).length <= 75, line);
  }
});

test("cancelled fixtures retain a stable UID and export cancellation without guessing a duration", () => {
  const fixtures = [{
    id: "f-cancel",
    startsAt: "2026-12-10T12:00:00+05:00",
    homeTeam: "North",
    awayTeam: "South",
    ground: null,
    round: null,
    status: "cancelled",
  }];
  const result = fixtureCalendarIcs({
    competitionId: "league",
    competitionName: "Winter Cup",
    seasonName: "2026",
    fixtures,
    generatedAt: new Date("2026-11-20T00:00:00Z"),
  });
  assert.match(result.contents, /METHOD:PUBLISH/);
  assert.match(result.contents, /STATUS:CANCELLED/);
  assert.match(result.contents, /UID:criclume-league-f-cancel@criclume.com/);
  assert.equal(result.contents.includes("DTEND"), false);
  assert.equal(result.included, 1);
});

test("duplicate fixture IDs never create duplicate events", () => {
  const base = {
    id: "one",
    startsAt: "2026-12-10T12:00:00Z",
    homeTeam: "North",
    awayTeam: "South",
    ground: null,
    round: null,
    status: "scheduled",
  };
  const result = fixtureCalendarIcs({
    competitionId: "league",
    competitionName: "Cup",
    seasonName: "2026",
    fixtures: [base, { ...base }, { ...base, id: "two", status: "planned" }],
  });
  assert.equal(result.included, 2);
  assert.equal(result.skipped, 1);
  assert.match(result.contents, /STATUS:CONFIRMED/);
  assert.match(result.contents, /STATUS:TENTATIVE/);
});
