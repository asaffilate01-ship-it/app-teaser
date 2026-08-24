import assert from "node:assert/strict";
import test from "node:test";
import {
  battingCard,
  bowlingCard,
  createMatch,
  currentInnings,
  recordDelivery,
  startNextInnings,
  summarizeInnings,
  undoLastDelivery,
  type CricketMatch,
  type RecordDeliveryInput,
} from "../src/lib/cricket.ts";

function newMatch(overs = 2): CricketMatch {
  return createMatch({
    homeTeamName: "Home",
    awayTeamName: "Away",
    homePlayers: ["Home One", "Home Two", "Home Three"],
    awayPlayers: ["Away One", "Away Two", "Away Three"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: overs,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "Test Ground",
      weather: "Dry",
      startTime: new Date().toISOString(),
    },
  });
}

function input(
  match: CricketMatch,
  overrides: Partial<RecordDeliveryInput> = {},
): RecordDeliveryInput {
  const innings = currentInnings(match);
  return {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Medium",
    outcome: "hit-no-run",
    batterRuns: 0,
    fieldZone: "Bowler",
    ...overrides,
  };
}

test("scores legal runs and does not count wides as legal balls", () => {
  let match = newMatch();
  match = recordDelivery(
    match,
    input(match, { batterRuns: 4, outcome: "hit", fieldZone: "Cover" }),
  );
  match = recordDelivery(match, input(match, { extras: { wide: 1 }, outcome: "missed" }));
  const innings = currentInnings(match);
  const summary = summarizeInnings(innings);

  assert.equal(summary.runs, 5);
  assert.equal(summary.legalBalls, 1);
  assert.equal(summary.overs, "0.1");
  assert.equal(innings.deliveries[1]?.over, 0);
  assert.equal(innings.deliveries[1]?.ball, 2);
  assert.ok(innings.deliveries[0]?.recordedAt);
});

test("records no-ball boundaries without charging a legal delivery", () => {
  let match = newMatch();
  match = recordDelivery(
    match,
    input(match, { batterRuns: 4, extras: { noBall: 1 }, outcome: "hit", fieldZone: "Cover" }),
  );
  const innings = currentInnings(match);
  const summary = summarizeInnings(innings);
  assert.equal(summary.runs, 5);
  assert.equal(summary.legalBalls, 0);
  assert.equal(battingCard(match, innings)[0]?.runs, 4);
  assert.equal(bowlingCard(match, innings)[0]?.runs, 5);
});

test("changes strike after an odd run and again at the end of an over", () => {
  let match = newMatch();
  const originalStriker = currentInnings(match).strikerId;
  const originalNonStriker = currentInnings(match).nonStrikerId;
  match = recordDelivery(match, input(match, { batterRuns: 1, outcome: "hit" }));
  assert.equal(currentInnings(match).strikerId, originalNonStriker);

  for (let ball = 0; ball < 5; ball += 1) {
    match = recordDelivery(match, input(match));
  }
  assert.equal(currentInnings(match).strikerId, originalStriker);
});

test("attributes a caught wicket to the bowler and catcher", () => {
  let match = newMatch();
  const innings = currentInnings(match);
  const battingTeam = match.teams.find((team) => team.id === innings.battingTeamId)!;
  const bowlingTeam = match.teams.find((team) => team.id === innings.bowlingTeamId)!;
  const catcher = bowlingTeam.players[1]!;
  match = recordDelivery(
    match,
    input(match, {
      outcome: "wicket",
      dismissal: {
        type: "caught",
        batterId: innings.strikerId,
        fielderId: catcher.id,
        catchZone: "Point",
      },
    }),
  );

  const batter = battingCard(match, currentInnings(match)).find(
    (row) => row.playerId === battingTeam.players[0]!.id,
  )!;
  const bowler = bowlingCard(match, currentInnings(match))[0]!;
  assert.match(batter.dismissal, new RegExp(catcher.name));
  assert.equal(bowler.wickets, 1);
});

test("ends an innings at the over limit and starts the chase", () => {
  let match = newMatch(1);
  for (let ball = 0; ball < 6; ball += 1)
    match = recordDelivery(match, input(match, { batterRuns: 1 }));
  assert.equal(match.status, "innings-break");
  assert.equal(currentInnings(match).status, "completed");

  const firstBattingTeam = currentInnings(match).battingTeamId;
  match = startNextInnings(match);
  assert.equal(match.status, "live");
  assert.notEqual(currentInnings(match).battingTeamId, firstBattingTeam);
});

test("undo restores the players who were active before the removed ball", () => {
  let match = newMatch();
  const originalStriker = currentInnings(match).strikerId;
  const originalNonStriker = currentInnings(match).nonStrikerId;
  match = recordDelivery(match, input(match, { batterRuns: 1, outcome: "hit" }));
  assert.equal(currentInnings(match).strikerId, originalNonStriker);

  match = undoLastDelivery(match);
  assert.equal(currentInnings(match).strikerId, originalStriker);
  assert.equal(currentInnings(match).nonStrikerId, originalNonStriker);
  assert.equal(currentInnings(match).deliveries.length, 0);
});
