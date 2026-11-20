import assert from "node:assert/strict";
import test from "node:test";
import { academyOverview, academyCohortsCsv } from "../src/lib/academy-dashboard.ts";
import type { PlatformDashboardData, PlayerRecord } from "../src/lib/platform-cloud.ts";

const asOf = new Date("2026-11-20T00:00:00Z");
function makePlayer(id: string, isJunior: boolean): PlayerRecord {
  return {
    id,
    name: id,
    isJunior,
    publicProfile: false,
    teamIds: id === "unassigned" ? [] : ["team"],
    career: {
      runs: 0,
      ballsFaced: 0,
      wickets: 0,
      ballsBowled: 0,
      catches: 0,
      stumpings: 0,
      runOuts: 0,
    },
    consent: null,
  };
}
type Inputs = Pick<PlatformDashboardData, "teams" | "players" | "members" | "fixtures" | "matches">;
function fixture(): Inputs {
  const matchFixture = (id: string, startsAt: string, status: string) => ({
    id,
    competitionId: "cup",
    homeTeamId: "team",
    awayTeamId: "other",
    groundId: null,
    startsAt,
    status,
    roundName: null,
    result: {},
  });
  return {
    teams: [
      {
        id: "team",
        name: '=HYPERLINK("malicious")',
        shortName: "T",
        ageGroup: "U15",
        playerIds: ["child", "child", "adult"],
      },
    ],
    players: [
      makePlayer("child", true),
      makePlayer("adult", false),
      makePlayer("unassigned", false),
    ],
    members: [
      {
        userId: "coach",
        role: "coach",
        status: "active",
        joinedAt: asOf.toISOString(),
        displayName: "Coach",
      },
    ],
    fixtures: [
      matchFixture("future", "2026-12-10T00:00:00Z", "scheduled"),
      matchFixture("cancelled", "2026-12-11T00:00:00Z", "cancelled"),
      matchFixture("past", "2026-11-01T00:00:00Z", "scheduled"),
    ],
    matches: [],
  };
}

test("academy counts actual registered players, future fixtures and consent records", () => {
  const snapshot = academyOverview(fixture(), asOf);
  assert.equal(snapshot.teams, 1);
  assert.equal(snapshot.registeredPlayers, 3);
  assert.equal(snapshot.activeCoaches, 1);
  assert.equal(snapshot.unassignedPlayers, 1);
  assert.equal(snapshot.juniorPlayers, 1);
  assert.equal(snapshot.coachingConsentsToReview, 1);
  assert.deepEqual(
    snapshot.cohorts.map((cohort) => ({
      registered: cohort.registered,
      juniors: cohort.juniors,
      upcoming: cohort.upcomingFixtures,
    })),
    [{ registered: 2, juniors: 1, upcoming: 1 }],
  );
});

test("academy CSV exports aggregate counts but no player names or executable formulas", () => {
  const csv = academyCohortsCsv(academyOverview(fixture(), asOf).cohorts);
  assert.match(csv, /"'=HYPERLINK/);
  assert.doesNotMatch(csv, /child|adult|unassigned/);
  assert.match(csv, /"Coaching consents to review"/);
});

test("empty academy has no invented members or fixtures", () => {
  const value = academyOverview(
    {
      teams: [],
      players: [],
      members: [],
      fixtures: [],
      matches: [],
    },
    asOf,
  );
  assert.equal(value.teams, 0);
  assert.equal(value.registeredPlayers, 0);
  assert.deepEqual(value.cohorts, []);
});
