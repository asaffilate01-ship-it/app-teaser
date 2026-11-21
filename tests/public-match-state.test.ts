import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, currentInnings, recordDelivery } from "../src/lib/cricket.ts";
import { publicLiveState } from "../src/lib/public-match-state.ts";

function privateMatch() {
  return createMatch({
    homeTeamName: "Club North",
    awayTeamName: "Club South",
    homePlayers: ["Junior Name Withheld", "Other Junior Withheld"],
    awayPlayers: ["Private Bowler Name", "Private Fielder Name"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: 20,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "Training Ground",
      weather: "Clear",
      startTime: "2026-11-21T12:00:00Z",
    },
  });
}

test("public live scoring never exposes individual player names or player identifiers", () => {
  const match = privateMatch();
  const live = publicLiveState(match);
  const json = JSON.stringify(live);
  for (const player of match.teams.flatMap((team) => team.players)) {
    assert.equal(json.includes(player.name), false);
    assert.equal(json.includes(player.id), false);
  }
  assert.match(json, /"Striker"/);
  assert.match(json, /"Non-striker"/);
  assert.match(json, /"Bowler"/);
});

test("public projection retains team totals, individual figures and recent events", () => {
  const original = privateMatch();
  const innings = currentInnings(original);
  const match = recordDelivery(original, {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Fast",
    outcome: "hit",
    batterRuns: 4,
  });
  const live = publicLiveState(match);
  assert.equal(live["runs"], 4);
  assert.equal(live["wickets"], 0);
  assert.equal(live["overs"], "0.1");
  assert.deepEqual(live["recent"], [{ label: "4", kind: "boundary" }]);
  const player = live["striker"] as { name: string; runs: number };
  assert.equal(player.name, "Striker");
  assert.equal(player.runs, 4);
});

test("names withheld for completed matches as well", () => {
  const match = privateMatch();
  match.status = "completed";
  const text = JSON.stringify(publicLiveState(match));
  assert.equal(text.includes("Junior Name Withheld"), false);
  assert.match(text, /Match completed/);
});
