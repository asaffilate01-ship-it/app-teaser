import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCareer,
  calculateCompetitionTable,
  can,
  decideMediaSafeguarding,
  estimateCameraClockOffset,
  generateRoundRobinFixtures,
  requireLicensedRainRule,
  seedKnockoutBracket,
  type CompetitionRules,
} from "../src/lib/platform.ts";

const rules: CompetitionRules = {
  version: 1,
  ballsPerOver: 6,
  oversPerInnings: 20,
  inningsPerSide: 1,
  points: { win: 4, tie: 2, noResult: 2, loss: 0 },
  tieBreakers: ["points", "wins", "net-run-rate"],
};

test("role matrix keeps safeguarding and billing permissions restricted", () => {
  assert.equal(can("owner", "billing.manage"), true);
  assert.equal(can("scorer", "match.score"), true);
  assert.equal(can("scorer", "player.private_data"), false);
  assert.equal(can("safeguarding_officer", "player.private_data"), true);
});

test("competition table applies results, points and net run rate", () => {
  const table = calculateCompetitionTable(
    ["a", "b"],
    [
      {
        id: "fixture-1",
        homeTeamId: "a",
        awayTeamId: "b",
        status: "completed",
        winnerTeamId: "a",
        homeRuns: 120,
        homeLegalBalls: 120,
        awayRuns: 90,
        awayLegalBalls: 120,
      },
    ],
    rules,
  );

  assert.equal(table[0]?.teamId, "a");
  assert.equal(table[0]?.points, 4);
  assert.equal(table[0]?.netRunRate, 1.5);
  assert.equal(table[1]?.lost, 1);
});

test("fixture generator creates a double round robin without duplicate home pairings", () => {
  const fixtures = generateRoundRobinFixtures(
    [
      { id: "a", homeGroundId: "ga" },
      { id: "b", homeGroundId: "gb" },
      { id: "c", homeGroundId: "gc" },
      { id: "d", homeGroundId: "gd" },
    ],
    Array.from({ length: 12 }, (_, index) => ({
      id: `slot-${index}`,
      startsAt: new Date(2026, 7, index + 1).toISOString(),
      availableGroundIds: ["ga", "gb", "gc", "gd"],
    })),
    true,
  );

  assert.equal(fixtures.length, 12);
  assert.equal(fixtures.filter((fixture) => fixture.conflicts.length > 0).length, 0);
  const pairs = new Set(
    fixtures.map((fixture) => [fixture.homeTeamId, fixture.awayTeamId].sort().join(":")),
  );
  assert.equal(pairs.size, 6);
});

test("knockout seeding pads to a power of two and records byes", () => {
  const ties = seedKnockoutBracket(["seed-1", "seed-2", "seed-3"]);
  assert.equal(ties.length, 2);
  assert.equal(ties[0]?.advancesTeamId, "seed-1");
  assert.equal(ties[1]?.homeTeamId, "seed-2");
  assert.equal(ties[1]?.awayTeamId, "seed-3");
});

test("career history aggregates batting, bowling and fielding", () => {
  const career = buildCareer("player-1", [
    {
      batterId: "player-1",
      bowlerId: "player-2",
      batterRuns: 4,
      extras: 0,
      legalBall: true,
      wicket: false,
      creditedBowlerWicket: false,
    },
    {
      batterId: "player-2",
      bowlerId: "player-1",
      batterRuns: 0,
      extras: 0,
      legalBall: true,
      wicket: true,
      creditedBowlerWicket: true,
      fielderId: "player-1",
      fieldingDismissal: "catch",
    },
  ]);

  assert.equal(career.batting.runs, 4);
  assert.equal(career.batting.strikeRate, 400);
  assert.equal(career.bowling.wickets, 1);
  assert.equal(career.fielding.catches, 1);
});

test("camera clock alignment favours low-latency samples", () => {
  const result = estimateCameraClockOffset([
    {
      clientSentAtMs: 1000,
      serverReceivedAtMs: 1100,
      serverSentAtMs: 1105,
      clientReceivedAtMs: 1205,
    },
    {
      clientSentAtMs: 2000,
      serverReceivedAtMs: 2100,
      serverSentAtMs: 2105,
      clientReceivedAtMs: 2205,
    },
    {
      clientSentAtMs: 3000,
      serverReceivedAtMs: 3300,
      serverSentAtMs: 3305,
      clientReceivedAtMs: 3705,
    },
  ]);

  assert.equal(result.offsetMs, 0);
  assert.equal(result.roundTripMs, 200);
  assert.equal(result.confidence, "medium");
});

test("junior media is blocked until consent and review are complete", () => {
  const decision = decideMediaSafeguarding({
    includesJunior: true,
    recordingConsent: "granted",
    publicationConsent: "pending",
    clubRetentionDays: 365,
    publicAudience: true,
    blurRequested: false,
  });

  assert.equal(decision.canRecord, true);
  assert.equal(decision.canPublish, false);
  assert.equal(decision.blurRequired, true);
  assert.equal(decision.retentionDays, 90);
});

test("rain rules fail closed when no licensed provider is configured", () => {
  assert.throws(() => requireLicensedRainRule(rules), /authorised/);
  assert.equal(
    requireLicensedRainRule({
      ...rules,
      rainRule: {
        provider: "licensed-provider",
        method: "competition-method",
        edition: "2026.1",
        parameters: { g50: 245 },
      },
    }).edition,
    "2026.1",
  );
});
