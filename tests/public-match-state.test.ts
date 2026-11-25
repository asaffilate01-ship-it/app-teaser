import assert from "node:assert/strict";
import test from "node:test";
import {
  createMatch,
  currentInnings,
  endCurrentInnings,
  recordDelivery,
  retireBatter,
} from "../src/lib/cricket.ts";
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
  // Only the first innings was played, so the public message carries the result, not names.
  assert.match(text, /No result/);
});

test("shared live score keeps the match length so other devices can show overs left", () => {
  const match = privateMatch();
  const live = publicLiveState(match);
  assert.deepEqual(live["settings"], {
    oversPerInnings: match.settings.oversPerInnings,
    inningsPerSide: match.settings.inningsPerSide,
    ballsPerOver: match.settings.ballsPerOver,
    freeHit: false,
    superOver: false,
    lastManStands: false,
    followOnLead: null,
    rainMethod: null,
    days: null,
  });
});

test("shared live score carries the rain state and par so other devices can show it", () => {
  const match = { ...privateMatch(), rain: { method: "arr" as const, revisedOvers: 12 } };
  const live = publicLiveState(match);
  assert.deepEqual(live["rain"], { method: "arr", revisedOvers: 12 });
  assert.ok("par" in live);
});

test("ground screen card refs are per-match pseudonyms, never player ids or names", async () => {
  const { playerScreenRef } = await import("../src/lib/sha256.ts");
  const match = privateMatch();
  const json = JSON.stringify(publicLiveState(match, { screenRefSalt: "cloud-match-1" }));
  for (const player of match.teams.flatMap((team) => team.players)) {
    assert.equal(json.includes(player.id), false);
    assert.equal(json.includes(player.name), false);
  }
  const striker = currentInnings(match).strikerId;
  assert.ok(json.includes(playerScreenRef("cloud-match-1", striker)));
  assert.notEqual(
    playerScreenRef("cloud-match-1", striker),
    playerScreenRef("cloud-match-2", striker),
  );
});

test("pairs cricket chart totals include the wicket penalty", () => {
  const original = privateMatch();
  original.settings.rules = { pairs: { oversPerPair: 4, runsPerWicket: 5 } };
  const innings = currentInnings(original);
  const match = recordDelivery(original, {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Fast",
    outcome: "wicket",
    batterRuns: 0,
    dismissal: { type: "bowled", batterId: innings.strikerId },
  });
  const live = publicLiveState(match);
  assert.equal(live["runs"], -5);
  assert.equal(live["wickets"], 1);
  const progress = live["progress"] as { overs: [number, number][] }[];
  assert.deepEqual(progress[0]?.overs, [[-5, 1]]);
});

test("retired out is counted in the chart and resets the current partnership", () => {
  const original = privateMatch();
  const innings = currentInnings(original);
  const scored = recordDelivery(original, {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Fast",
    outcome: "hit",
    batterRuns: 4,
  });
  const match = retireBatter(scored, currentInnings(scored).strikerId, "out");
  const live = publicLiveState(match);
  const progress = live["progress"] as { overs: [number, number][] }[];
  assert.equal(live["wickets"], 1);
  assert.deepEqual(progress[0]?.overs, [[4, 1]]);
  assert.deepEqual(live["partnership"], { runs: 0, balls: 0 });
});

test("innings breaks retain scorecard figures without presenting active batters or bowlers", () => {
  const original = privateMatch();
  const innings = currentInnings(original);
  const scored = recordDelivery(original, {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Fast",
    outcome: "hit",
    batterRuns: 4,
  });
  const live = publicLiveState(endCurrentInnings(scored));
  assert.equal(live["runs"], 4);
  assert.equal(live["striker"], null);
  assert.equal(live["nonStriker"], null);
  assert.equal(live["bowler"], null);
  assert.equal(live["message"], "Innings break");
  const card = live["card"] as {
    batting: { runs: number; atCrease: boolean; onStrike: boolean }[];
    bowling: { runs: number; current: boolean }[];
  };
  assert.equal(card.batting[0]?.runs, 4);
  assert.equal(card.bowling[0]?.runs, 4);
  assert.ok(card.batting.every((row) => !row.atCrease && !row.onStrike));
  assert.ok(card.bowling.every((row) => !row.current));
});

test("public recent deliveries include extras and do not misclassify five runs as a boundary", () => {
  let match = privateMatch();
  const add = (batterRuns: number, extras: Record<string, number> = {}) => {
    const innings = currentInnings(match);
    match = recordDelivery(match, {
      strikerId: innings.strikerId,
      nonStrikerId: innings.nonStrikerId,
      bowlerId: innings.bowlerId,
      end: innings.end,
      deliveryStyle: "Fast",
      outcome: "hit",
      batterRuns,
      extras,
    });
  };
  add(0, { wide: 2 });
  add(4, { noBall: 1 });
  add(0, { bye: 2 });
  add(0, { legBye: 1 });
  add(0, { penalty: 5 });
  add(5);
  const live = publicLiveState(match);
  assert.deepEqual(live["recent"], [
    { label: "2Wd", kind: "extra" },
    { label: "4+Nb", kind: "extra" },
    { label: "2B", kind: "extra" },
    { label: "1Lb", kind: "extra" },
    { label: "5P", kind: "extra" },
    { label: "5", kind: "normal" },
  ]);
  assert.equal(live["runs"], 20);
});
