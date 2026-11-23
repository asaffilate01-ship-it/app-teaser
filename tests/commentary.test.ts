import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, currentInnings, recordDelivery, type CricketMatch } from "../src/lib/cricket.ts";
import { commentaryFeed } from "../src/lib/commentary.ts";
import { publicLiveState } from "../src/lib/public-match-state.ts";
import { fallOfWickets } from "../src/lib/scorecard.ts";

function match(): CricketMatch {
  return createMatch({
    homeTeamName: "Lions CC",
    awayTeamName: "Tigers CC",
    homePlayers: ["Amira Junior", "Ben Junior", "Cal Junior"],
    awayPlayers: ["Dev Bowler", "Eli Fielder", "Fin Keeper"],
    battingFirst: "home",
    settings: { format: "T20", oversPerInnings: 20, inningsPerSide: 1, ballsPerOver: 6, ground: "", weather: "", startTime: "2026-11-23T10:00:00Z" },
  });
}

function bowl(m: CricketMatch, extra: Partial<Parameters<typeof recordDelivery>[1]> = {}) {
  const innings = currentInnings(m);
  return recordDelivery(m, {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId || m.teams[1].players[0]!.id,
    end: "Pavilion",
    deliveryStyle: "Medium",
    outcome: "hit",
    batterRuns: 0,
    fieldZone: "Not recorded",
    note: "",
    ...extra,
  });
}

test("boundaries, wickets and an end-of-over line are described", () => {
  let m = match();
  m = bowl(m, { batterRuns: 4, fieldZone: "Deep extra cover" });
  m = bowl(m, { batterRuns: 6 });
  m = bowl(m, { dismissal: { type: "bowled", batterId: currentInnings(m).strikerId }, outcome: "wicket" });
  for (let i = 0; i < 3; i += 1) m = bowl(m);
  const lines = commentaryFeed(currentInnings(m), 6);
  assert.equal(lines[0]?.tone, "over");
  assert.match(lines[0]!.text, /10 runs, 1 wicket/);
  assert.ok(lines.some((line) => line.tone === "four" && /deep extra cover/.test(line.text)));
  assert.ok(lines.some((line) => line.tone === "six"));
  assert.ok(lines.some((line) => line.tone === "wicket" && /BOWLED/.test(line.text)));
});

test("public commentary is off unless the scorer shares it, and never names players", () => {
  let m = match();
  m = bowl(m, { batterRuns: 1, fieldZone: "Cover", fielderId: m.teams[1].players[1]!.id });
  assert.equal(publicLiveState(m)["commentary"], null);
  const shared = { ...m, audience: { commentary: true } };
  const json = JSON.stringify(publicLiveState(shared)["commentary"]);
  assert.ok(json.includes("single"));
  for (const player of m.teams.flatMap((team) => team.players)) assert.equal(json.includes(player.name), false);
});

test("fall of wickets records score and over at each dismissal", () => {
  let m = match();
  m = bowl(m, { batterRuns: 2 });
  m = bowl(m, { dismissal: { type: "lbw", batterId: currentInnings(m).strikerId }, outcome: "wicket" });
  const fow = fallOfWickets(m, currentInnings(m));
  assert.equal(fow.length, 1);
  assert.equal(fow[0]?.score, 2);
  assert.equal(fow[0]?.over, "0.2");
  assert.equal(fow[0]?.batter, "Amira Junior");
});
