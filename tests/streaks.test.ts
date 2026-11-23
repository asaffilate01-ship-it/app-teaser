import assert from "node:assert/strict";
import test from "node:test";
import {
  createMatch,
  currentInnings,
  endCurrentInnings,
  recordDelivery,
  startNextInnings,
  type CricketMatch,
  type RecordDeliveryInput,
} from "../src/lib/cricket.ts";
import { battingStreaks, rivalries, teamStreaks, wicketStreaks } from "../src/lib/streaks.ts";

const base = createMatch({
  homeTeamName: "Lions",
  awayTeamName: "Tigers",
  homePlayers: ["Ali", "Ben", "Cal", "Dev", "Eli"],
  awayPlayers: ["Fin", "Gus", "Hal", "Ian", "Jay"],
  battingFirst: "home",
  settings: { format: "T20", oversPerInnings: 20, inningsPerSide: 1, ballsPerOver: 6, ground: "", weather: "", startTime: "" },
});
const [lions, tigers] = base.teams;
const ali = lions.players[0]!.id;
const bowler = tigers.players[0]!.id;

function ball(match: CricketMatch, extra: Partial<RecordDeliveryInput> = {}): RecordDeliveryInput {
  const innings = currentInnings(match);
  return { strikerId: innings.strikerId, nonStrikerId: innings.nonStrikerId, bowlerId: innings.bowlerId, end: "Pavilion", deliveryStyle: "Medium", outcome: "hit", batterRuns: 0, ...extra };
}

/** Lions bat first; Ali scores `aliRuns` in fours; Tigers' first bowler takes `wickets`; Tigers make `tigersRuns`. */
function play(day: number, aliRuns: number, tigersRuns: number, wickets = 0): CricketMatch {
  let match: CricketMatch = { ...structuredClone(base), id: `m${day}`, settings: { ...base.settings, startTime: `2027-05-${String(day).padStart(2, "0")}T10:00:00Z` } };
  for (let i = 0; i < wickets; i++) {
    match = recordDelivery(match, ball(match, { bowlerId: bowler, outcome: "wicket", dismissal: { type: "bowled", batterId: currentInnings(match).nonStrikerId } }));
  }
  for (let left = aliRuns; left > 0; left -= 4) match = recordDelivery(match, ball(match, { strikerId: ali, bowlerId: bowler, batterRuns: 4 }));
  match = startNextInnings(endCurrentInnings(match));
  for (let left = tigersRuns; left > 0 && match.status === "live"; left -= 4) match = recordDelivery(match, ball(match, { batterRuns: 4 }));
  if (match.status === "live") match = endCurrentInnings(match);
  return startNextInnings(match);
}

// Lions: W, W, L, W, W, W (Tigers chase 1 more than Lions in match 3).
const season = [play(1, 40, 20, 1), play(2, 32, 12, 1), play(3, 8, 12), play(4, 36, 8, 2), play(5, 44, 4), play(6, 48, 0, 1)];

test("team streaks: Lions are on a 3-match winning run; best is 3", () => {
  const lionsRow = teamStreaks(season).find((row) => row.teamId === lions.id)!;
  assert.deepEqual(lionsRow.current, { letter: "W", length: 3 });
  assert.equal(lionsRow.longestWinning, 3);
  assert.deepEqual(lionsRow.form, ["W", "L", "W", "W", "W"]);
  const tigersRow = teamStreaks(season).find((row) => row.teamId === tigers.id)!;
  assert.deepEqual(tigersRow.current, { letter: "L", length: 3 });
});

test("rivalry record counts each side's wins", () => {
  const [rivalry] = rivalries(season);
  assert.equal(rivalry?.played, 6);
  const lionsWins = rivalry!.teamA === lions.id ? rivalry!.winsA : rivalry!.winsB;
  assert.equal(lionsWins, 5);
});

test("batting streak: 30+ in innings in a row (40, 32, 8, 36, 44, 48 → current 3, best 3)", () => {
  const row = battingStreaks(season).find((item) => item.playerId === ali)!;
  assert.equal(row.current, 3);
  assert.equal(row.longest, 3);
});

test("wicket streak: matches in a row with a wicket (1,1,0,2,0,1 → best 2, current 1)", () => {
  const row = wicketStreaks(season).find((item) => item.playerId === bowler)!;
  assert.equal(row.longest, 2);
  assert.equal(row.current, 1);
});
