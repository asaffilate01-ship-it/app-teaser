import assert from "node:assert/strict";
import test from "node:test";
import {
  availableBatters,
  canBowl,
  correctDelivery,
  createMatch,
  currentInnings,
  findTeam,
  formatPreset,
  recordDelivery,
  substitutePlayer,
  summarizeInnings,
  type CricketMatch,
  type MatchSettings,
  type RecordDeliveryInput,
} from "../src/lib/cricket.ts";

const base: MatchSettings = {
  format: "T20",
  oversPerInnings: 20,
  inningsPerSide: 1,
  ballsPerOver: 6,
  ground: "",
  weather: "",
  startTime: "2027-05-01T10:00:00Z",
};
const make = (settings: Partial<MatchSettings> = {}) =>
  createMatch({
    homeTeamName: "Lions",
    awayTeamName: "Tigers",
    homePlayers: ["Ali", "Ben", "Cal", "Dev", "Eli", "Fay"],
    awayPlayers: ["Fin", "Gus", "Hal", "Ian", "Jay", "Kit"],
    battingFirst: "home",
    settings: { ...base, ...settings },
  });
const ball = (m: CricketMatch, extra: Partial<RecordDeliveryInput> = {}): RecordDeliveryInput => {
  const i = currentInnings(m);
  return {
    strikerId: i.strikerId,
    nonStrikerId: i.nonStrikerId,
    bowlerId: i.bowlerId,
    end: "Pavilion",
    deliveryStyle: "Fast",
    outcome: "hit",
    batterRuns: 0,
    ...extra,
  };
};
const play = (m: CricketMatch, n: number, extra: Partial<RecordDeliveryInput> = {}) => {
  let out = m;
  for (let i = 0; i < n; i += 1) out = recordDelivery(out, ball(out, extra));
  return out;
};

test("The Hundred: 100 balls a side in sets of five", () => {
  const p = formatPreset("The Hundred");
  assert.equal(p.overs! * p.ballsPerOver, 100);
  assert.equal(p.ballsPerOver, 5);
});

test("The Hundred: batters only swap ends for a new set every 10 balls", () => {
  let m = make({ format: "The Hundred", ballsPerOver: 5, rules: { endsChangeEvery: 10 } });
  const striker = currentInnings(m).strikerId;
  m = play(m, 5);
  assert.equal(currentInnings(m).strikerId, striker, "no change after 5 balls");
  m = play(m, 5);
  assert.notEqual(currentInnings(m).strikerId, striker, "ends change after 10 balls");
});

test("Indoor pairs: a wicket costs 5 runs and the batter stays in", () => {
  let m = make({ format: "Indoor", rules: { pairs: { oversPerPair: 4, runsPerWicket: 5 } } });
  m = play(m, 1, { batterRuns: 4 });
  const i = currentInnings(m);
  m = recordDelivery(
    m,
    ball(m, { outcome: "wicket", dismissal: { type: "bowled", batterId: i.strikerId } }),
  );
  assert.equal(summarizeInnings(currentInnings(m)).runs, -1);
  assert.equal(currentInnings(m).strikerId, i.strikerId);
});

test("Indoor pairs: a new pair comes in after 4 overs", () => {
  let m = make({ format: "Indoor", rules: { pairs: { oversPerPair: 4, runsPerWicket: 5 } } });
  const first = [currentInnings(m).strikerId, currentInnings(m).nonStrikerId];
  m = play(m, 24);
  const now = [currentInnings(m).strikerId, currentInnings(m).nonStrikerId];
  assert.ok(now.every((id) => !first.includes(id)));
});

test("a fielding substitute can neither bat nor bowl", () => {
  const m = make();
  const bowling = currentInnings(m).bowlingTeamId;
  const result = substitutePlayer(m, bowling, "fielding", "Sub Sam");
  assert.ok("match" in result);
  const sub = findTeam(result.match, bowling).players.at(-1)!;
  assert.equal(canBowl(sub), false);
});

test("a concussion replacement takes over and the replaced player can no longer bat", () => {
  const m = make();
  const batting = findTeam(m, currentInnings(m).battingTeamId);
  const out = batting.players[3]!;
  const result = substitutePlayer(m, batting.id, "concussion", "New Ned", out.id);
  assert.ok("match" in result);
  const team = findTeam(result.match, batting.id);
  const free = availableBatters(team, currentInnings(result.match), []);
  assert.ok(!free.includes(out.id));
  assert.ok(free.includes(team.players.at(-1)!.id));
});

test("a batter at the crease must retire before being replaced", () => {
  const m = make();
  const i = currentInnings(m);
  const result = substitutePlayer(m, i.battingTeamId, "concussion", "New Ned", i.strikerId);
  assert.ok("error" in result);
});

test("correcting an earlier ball from 1 run to 4 updates the total", () => {
  let m = play(make(), 3, { batterRuns: 1 });
  const target = currentInnings(m).deliveries[0]!;
  const result = correctDelivery(m, target.id, { batterRuns: 4 });
  assert.ok("match" in result);
  m = result.match;
  assert.equal(summarizeInnings(currentInnings(m)).runs, 6);
  assert.equal(currentInnings(m).deliveries[0]!.id, target.id);
});

test("correcting a dot into a wide adds a ball to the over", () => {
  let m = play(make(), 6);
  const first = currentInnings(m).deliveries[0]!;
  const result = correctDelivery(m, first.id, { extras: { wide: 1 } });
  assert.ok("match" in result);
  m = result.match;
  assert.equal(summarizeInnings(currentInnings(m)).legalBalls, 5);
  assert.equal(summarizeInnings(currentInnings(m)).runs, 1);
});

test("a batter who kept batting cannot be given out on an earlier ball", () => {
  const m = play(make(), 3);
  const first = currentInnings(m).deliveries[0]!;
  const result = correctDelivery(m, first.id, {
    dismissal: { type: "bowled", batterId: first.strikerId },
  });
  assert.ok("error" in result);
});

test("removing a wicket from an earlier ball takes it off the score", () => {
  let m = make();
  const i = currentInnings(m);
  m = recordDelivery(
    m,
    ball(m, { outcome: "wicket", dismissal: { type: "bowled", batterId: i.strikerId } }),
  );
  m = play(m, 2);
  const result = correctDelivery(m, currentInnings(m).deliveries[0]!.id, { dismissal: null });
  assert.ok("match" in result);
  assert.equal(summarizeInnings(currentInnings(result.match)).wickets, 0);
});
