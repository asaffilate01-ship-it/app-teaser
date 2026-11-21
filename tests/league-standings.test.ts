import assert from "node:assert/strict";
import test from "node:test";
import { buildLeagueStandings, leagueStandingsCsv } from "../src/lib/league-standings.ts";
import type { CompetitionRules } from "../src/lib/platform.ts";
import type { FixtureRecord } from "../src/lib/platform-cloud.ts";

const rules: CompetitionRules = {
  version: 1,
  ballsPerOver: 6,
  oversPerInnings: 20,
  inningsPerSide: 1,
  points: { win: 4, tie: 2, noResult: 2, loss: 0 },
  tieBreakers: ["points", "wins", "net-run-rate"],
};
const competition = { id: "cup", rules, ruleVersionId: "rule-v1" };
const teams = [
  { id: "north", name: '=HYPERLINK("https://example.com")' },
  { id: "south", name: "South" },
  { id: "west", name: "West" },
];

function resultFixture(
  patch: Partial<FixtureRecord> = {},
): FixtureRecord {
  return {
    id: "f1",
    competitionId: "cup",
    homeTeamId: "north",
    awayTeamId: "south",
    groundId: null,
    startsAt: "2026-11-20T12:00:00Z",
    status: "completed",
    roundName: "Round 1",
    ruleVersionId: "rule-v1",
    signedOffAt: "2026-11-20T16:00:00Z",
    signedOffBy: "approved-admin",
    result: {
      winnerTeamId: "north",
      homeRuns: 120,
      homeLegalBalls: 120,
      awayRuns: 90,
      awayLegalBalls: 120,
    },
    ...patch,
  };
}

test("standings use signed-off results and compute points plus NRR", () => {
  const preview = buildLeagueStandings({
    competition,
    fixtures: [resultFixture(), resultFixture({ id: "future", status: "scheduled", result: {} })],
    teams,
  });
  assert.equal(preview.counted, 1);
  assert.equal(preview.awaitingReview, 0);
  assert.equal(preview.scheduled, 1);
  assert.equal(preview.blockedReason, null);
  assert.equal(preview.rows[0]?.teamId, "north");
  assert.equal(preview.rows[0]?.won, 1);
  assert.equal(preview.rows[0]?.points, 4);
  assert.equal(preview.rows[0]?.netRunRate, 1.5);
  assert.equal(preview.rows[1]?.lost, 1);
});

test("unsigned, mismatched rules and incomplete scores never affect the table", () => {
  const fixtures = [
    resultFixture({ id: "unsigned", signedOffAt: null }),
    resultFixture({ id: "wrong-version", ruleVersionId: "old" }),
    resultFixture({ id: "wrong-player", homeTeamId: "unknown" }),
    resultFixture({ id: "same-team", awayTeamId: "north" }),
    resultFixture({
      id: "unknown-score",
      result: { winnerTeamId: "north", homeRuns: "120", awayRuns: 90 },
    }),
    resultFixture({
      id: "ambiguous",
      result: {
        winnerTeamId: "north",
        tied: true,
        homeRuns: 120,
        awayRuns: 120,
        homeLegalBalls: 120,
        awayLegalBalls: 120,
      },
    }),
    resultFixture(),
  ];
  const preview = buildLeagueStandings({ competition, fixtures, teams });
  assert.equal(preview.counted, 1);
  assert.equal(preview.awaitingReview, 6);
  assert.equal(preview.rows[0]?.points, 4);
});

test("signed-off abandoned no-results get points but no fabricated NRR", () => {
  const preview = buildLeagueStandings({
    competition,
    fixtures: [
      resultFixture({
        id: "abandoned",
        status: "abandoned",
        result: { noResult: true },
      }),
    ],
    teams,
  });
  assert.equal(preview.counted, 1);
  assert.equal(preview.rows[0]?.noResult, 1);
  assert.equal(preview.rows[1]?.noResult, 1);
  assert.equal(preview.rows[0]?.points, 2);
  assert.equal(preview.rows[0]?.netRunRate, 0);
});

test("missing adjudication or unsupported head-to-head rules fail closed", () => {
  const incomplete = buildLeagueStandings({
    competition,
    fixtures: [resultFixture({ result: {} })],
    teams,
  });
  assert.equal(incomplete.counted, 0);
  assert.equal(incomplete.awaitingReview, 1);
  assert.deepEqual(incomplete.rows, []);

  const headToHead = buildLeagueStandings({
    competition: { ...competition, rules: { ...rules, tieBreakers: ["head-to-head"] } },
    fixtures: [resultFixture()],
    teams,
  });
  assert.match(headToHead.blockedReason ?? "", /Head-to-head/);
  assert.equal(headToHead.rows.length, 0);

  const missingRules = buildLeagueStandings({
    competition: { ...competition, ruleVersionId: null },
    fixtures: [resultFixture()],
    teams,
  });
  assert.match(missingRules.blockedReason ?? "", /rule version/);
});

test("different competitions and duplicate fixtures do not create extra points", () => {
  const preview = buildLeagueStandings({
    competition,
    fixtures: [
      resultFixture(),
      resultFixture(),
      resultFixture({ id: "other", competitionId: "other-cup" }),
    ],
    teams,
  });
  assert.equal(preview.counted, 1);
  assert.equal(preview.awaitingReview, 0);
  assert.equal(preview.rows[0]?.points, 4);
});

test("CSV contains team statistics but neutralises spreadsheet formulas", () => {
  const rows = buildLeagueStandings({
    competition,
    fixtures: [resultFixture()],
    teams,
  }).rows;
  const csv = leagueStandingsCsv(rows, new Map(teams.map((team) => [team.id, team.name])));
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /"Net/);
  assert.doesNotMatch(csv, /approved-admin|signedOffBy|playerId/);
});
