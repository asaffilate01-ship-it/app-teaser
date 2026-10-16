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
  targetForCurrentInnings,
  type CricketMatch,
  type RecordDeliveryInput,
} from "../src/lib/cricket.ts";

function matchWithOvers(overs = 5, inningsPerSide: 1 | 2 = 1): CricketMatch {
  return createMatch({
    homeTeamName: "Test Home",
    awayTeamName: "Test Away",
    homePlayers: ["Batter 1", "Batter 2", "Batter 3"],
    awayPlayers: ["Bowler 1", "Bowler 2", "Bowler 3"],
    battingFirst: "home",
    settings: {
      format: "Club",
      oversPerInnings: overs,
      inningsPerSide,
      ballsPerOver: 6,
      ground: "Test Ground",
      weather: "Clear",
      startTime: new Date().toISOString(),
    },
  });
}

function ball(
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
    ...overrides,
  };
}

test("no-balls count as batter balls faced, wides do not, and byes count", () => {
  let match = matchWithOvers();
  const firstBatter = currentInnings(match).strikerId;
  match = recordDelivery(match, ball(match, { extras: { noBall: 1 } }));
  match = recordDelivery(match, ball(match, { extras: { wide: 1 } }));
  match = recordDelivery(match, ball(match, { extras: { bye: 1 } }));

  const innings = currentInnings(match);
  const batter = battingCard(match, innings).find((row) => row.playerId === firstBatter);
  assert.equal(batter?.balls, 2);
  assert.equal(batter?.runs, 0);
  assert.equal(summarizeInnings(innings).legalBalls, 1);
  assert.equal(summarizeInnings(innings).runs, 3);
});

test("bowler maiden overs include byes, but not wides", () => {
  let match = matchWithOvers();
  for (let i = 0; i < 6; i += 1) match = recordDelivery(match, ball(match));
  for (let i = 0; i < 6; i += 1)
    match = recordDelivery(match, ball(match, i === 0 ? { extras: { legBye: 1 } } : {}));

  let bowler = bowlingCard(match, currentInnings(match))[0];
  assert.equal(bowler?.maidens, 2);
  assert.equal(bowler?.runs, 0);

  match = recordDelivery(match, ball(match, { extras: { wide: 1 } }));
  for (let i = 0; i < 6; i += 1) match = recordDelivery(match, ball(match));
  bowler = bowlingCard(match, currentInnings(match))[0];
  assert.equal(bowler?.maidens, 2);
  assert.equal(bowler?.runs, 1);
  assert.equal(bowler?.overs, "3.0");
});

test("limited-over chase ends as soon as target is reached", () => {
  let match = matchWithOvers(1);
  assert.equal(startNextInnings(match), match);
  for (let i = 0; i < 6; i += 1) match = recordDelivery(match, ball(match));
  assert.equal(match.status, "innings-break");

  match = startNextInnings(match);
  assert.equal(match.status, "live");
  assert.equal(targetForCurrentInnings(match), 1);

  match = recordDelivery(match, ball(match, { batterRuns: 1, outcome: "hit" }));
  assert.equal(match.status, "innings-break");
  assert.equal(currentInnings(match).status, "completed");
  assert.equal(currentInnings(match).deliveries.length, 1);

  match = startNextInnings(match);
  assert.equal(match.status, "completed");
});

test("second innings of a two-innings-per-side match does not become a chase", () => {
  let match = matchWithOvers(1, 2);
  for (let i = 0; i < 6; i += 1) match = recordDelivery(match, ball(match));
  match = startNextInnings(match);
  assert.equal(targetForCurrentInnings(match), null);
  match = recordDelivery(match, ball(match, { batterRuns: 1, outcome: "hit" }));
  assert.equal(match.status, "live");
});
