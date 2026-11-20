import assert from "node:assert/strict";
import test from "node:test";
import { academyOverview, academyCohortsCsv } from "../src/lib/academy-dashboard.ts";
import type { PlatformDashboardData } from "../src/lib/platform-cloud.ts";

const asOf = new Date("2026-11-20T00:00:00Z");
function fixture(): Pick<
  PlatformDashboardData,
  "teams" | "players" | "members" | "fixtures" | "matches"
> {
  return {
    teams: [{
      id: "team",
      name: '=HYPERLINK("malicious")',
      shortName: "T",
      ageGroup: "U15",
      playerIds: ["child", "child", "adult"],
    }],
    players: [
      {
        id: "child",
        name: "Child",
        isJunior: true,
        publicProfile: false,
        teamIds: ["team"],
        career: { runs: 0, ballsFaced: 0, wickets: 0, ballsBowled: 0, catches: 0, stumpings: 0, runOuts: 0 },
        consent: null,
      },
      {
        id: "adult",
        name: "Adult",
        isJunior: false,
        publicProfile: true,
        teamIds: ["team"],
        career: { runs: 0, ballsFaced: 0, wickets: 0, ballsBowled: 0, catches: 0, stumpings: 0, runOuts: 0 },
        consent: null,
      },
      {
        id: "unassigned",
        name: "Unassigned",
        isJunior: false,
        publicProfile: false,
        teamIds: [],
        career: { runs: 0, ballsFaced: 0, wickets: 0, ballsBowled: 0, catches: 0, stumpings: 0, runOuts: 0 },
        consent: null,
      },
    ],
    members: [{
      userId: "coach",
      role: "coach",
      status: "active",
      joinedAt: asOf.toISOString(),
      displayName: "Coach",
    }],
    fixtures: [
      {
        id: "future",
        competitionId: "cup",
        homeTeamId: "team",
        awayTeamId: "other",
        groundId: null,
        startsAt: "2026-12-10T00:00:00Z",
        status: "scheduled",
        roundName: null,
        result: {},
      },
      {
        id: "cancelled",
        competitionId: "cup",
        homeTeamId: "team",
        awayTeamId: "other",
        groundId: null,
        startsAt: "2026-12-11T00:00:00Z",
        status: "cancelled",
        roundName: null,
        result: {},
      },
      {
        id: "past",
        competitionId: "cup",
        homeTeamId: "team",
        awayTeamId: "other",
        groundId: null,
        startsAt: "2026-11-01T00:00:00Z",
        status: "scheduled",
        roundName: null,
        result: {},
      },
    ],
    matches: [],
  };
}
test("academy summary uses registered players, current fixtures and verified consent states", () => {
  const snapshot = academyOverview(fixture(), asOf);
  assert.equal(snapshot.teams, 1);
  assert.equal(snapshot.registeredPlayers, 3);
  assert.equal(snapshot.activeCoaches, 1);
  assert.equal(snapshot.unassignedPlayers, 1);
  assert.equal(snapshot.juniorPlayers, 1);
  assert.equal(snapshot.coachingConsentsToReview, 1);
  assert.deepEqual(snapshot.cohorts.map((cohort) => ({
    registered: cohort.registered,
    juniors: cohort.juniors,
    upcoming: cohort.upcomingFixtures,
  })), [{ registered: 2, juniors: 1, upcoming: 1 }]);
});

test("academy CSV exports aggregate counts but never player names or formula payloads", () => {
  const csv = academyCohortsCsv(academyOverview(fixture(), asOf).cohorts);
  assert.match(csv, /"'=HYPERLINK/);
  assert.doesNotMatch(csv, /Child|Adult|Unassigned/);
  assert.match(csv, /"Coaching consents to review"/);
});

test("empty academy has no fabricated sessions, students or fixtures", () => {
  const value = academyOverview({
    teams: [],
    players: [],
    members: [],
    fixtures: [],
    matches: [],
  }, asOf);
  assert.equal(value.teams, 0);
  assert.equal(value.registeredPlayers, 0);
  assert.deepEqual(value.cohorts, []);
});
