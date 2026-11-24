import assert from "node:assert/strict";
import test from "node:test";
import { findFixtureStartConflict, reviewFixtureSchedule } from "../src/lib/fixture-scheduling.ts";
import type { FixtureRecord } from "../src/lib/platform-cloud.ts";

type FixtureInput = Pick<
  FixtureRecord,
  "id" | "startsAt" | "homeTeamId" | "awayTeamId" | "groundId" | "status"
>;

const now = new Date("2026-11-21T00:00:00Z");
const first: FixtureInput = {
  id: "f1",
  startsAt: "2026-12-10T13:00:00Z",
  homeTeamId: "team-a",
  awayTeamId: "team-b",
  groundId: "ground-1",
  status: "scheduled",
};

test("advises on close future fixture starts sharing a team or ground", () => {
  const second = {
    ...first,
    id: "f2",
    startsAt: "2026-12-10T14:30:00Z",
    homeTeamId: "team-a",
    awayTeamId: "team-c",
  };
  const result = reviewFixtureSchedule([first, second], now);
  assert.equal(result.checkedFixtures, 2);
  assert.equal(result.alerts.length, 1);
  assert.deepEqual(result.alerts[0], {
    firstFixtureId: "f1",
    secondFixtureId: "f2",
    minutesApart: 90,
    sharedTeamIds: ["team-a"],
    sharedGroundId: "ground-1",
  });
});

test("can warn about shared venue without falsely requiring identical teams", () => {
  const result = reviewFixtureSchedule(
    [first, { ...first, id: "f2", homeTeamId: "team-x", awayTeamId: "team-y" }],
    now,
  );
  assert.equal(result.alerts[0]?.sharedTeamIds.length, 0);
  assert.equal(result.alerts[0]?.sharedGroundId, "ground-1");
});

test("completed, cancelled, old and timezone-ambiguous fixtures are excluded", () => {
  const ignored: FixtureInput[] = [
    { ...first, id: "c", status: "cancelled" },
    { ...first, id: "done", status: "completed" },
    { ...first, id: "past", startsAt: "2026-11-01T13:00:00Z" },
    { ...first, id: "missing", startsAt: null },
    { ...first, id: "ambiguous", startsAt: "2026-12-10T13:00" },
  ];
  assert.deepEqual(reviewFixtureSchedule([first, ...ignored], now).alerts, []);
});

test("the advisory window is bounded; missing durations do not imply a clash", () => {
  const far = {
    ...first,
    id: "f2",
    startsAt: "2026-12-10T17:00:00Z",
  };
  assert.equal(reviewFixtureSchedule([first, far], now).alerts.length, 0);
  assert.equal(reviewFixtureSchedule([first, far], now, 300).alerts.length, 1);
});

test("duplicated records are not counted twice", () => {
  const result = reviewFixtureSchedule(
    [first, { ...first }, { ...first, id: "f2", startsAt: "2026-12-10T15:00:00Z" }],
    now,
  );
  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0]?.secondFixtureId, "f2");
});

test("manual fixture preflight detects the same instant across timezone offsets", () => {
  const proposed = {
    ...first,
    startsAt: "2026-12-10T18:00:00+05:00",
    awayTeamId: "team-c",
    groundId: "ground-2",
  };
  assert.equal(findFixtureStartConflict(proposed, [first])?.id, first.id);
});

test("manual fixture preflight checks grounds even for unrelated teams", () => {
  const proposed = { ...first, homeTeamId: "team-x", awayTeamId: "team-y" };
  assert.equal(findFixtureStartConflict(proposed, [first])?.id, first.id);
});

test("manual fixture preflight permits different starts, drafts and cancelled bookings", () => {
  assert.equal(
    findFixtureStartConflict({ ...first, startsAt: "2026-12-10T14:00:00Z" }, [first]),
    undefined,
  );
  assert.equal(findFixtureStartConflict({ ...first, startsAt: null }, [first]), undefined);
  assert.equal(findFixtureStartConflict(first, [{ ...first, status: "cancelled" }]), undefined);
});
