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
import { matchups, teamHeadToHead } from "../src/lib/head-to-head.ts";
import { hasHatTrick, playerOfTheMatch, playerProfile } from "../src/lib/player-profile.ts";

const base = createMatch({
  homeTeamName: "Lions",
  awayTeamName: "Tigers",
  homePlayers: ["Ali", "Ben", "Cal", "Dev", "Eli"],
  awayPlayers: ["Fin", "Gus", "Hal", "Ian", "Jay"],
  battingFirst: "home",
  settings: {
    format: "T20",
    oversPerInnings: 20,
    inningsPerSide: 1,
    ballsPerOver: 6,
    ground: "",
    weather: "",
    startTime: "2027-05-01T10:00:00Z",
  },
});
const [lions, tigers] = base.teams;
const id = (team: typeof lions, i: number) => team.players[i]!.id;

function fresh(matchId: string, date: string): CricketMatch {
  const copy = structuredClone(base);
  return { ...copy, id: matchId, settings: { ...copy.settings, startTime: date } };
}

function ball(match: CricketMatch, extra: Partial<RecordDeliveryInput> = {}): RecordDeliveryInput {
  const innings = currentInnings(match);
  return {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: "Pavilion",
    deliveryStyle: "Medium",
    outcome: "hit",
    batterRuns: 0,
    ...extra,
  };
}

/** Lions make `lionsRuns` (all by the opener, in sixes then the rest), Tigers make `tigersRuns`. */
function play(
  matchId: string,
  date: string,
  lionsRuns: number,
  tigersRuns: number,
  hatTrick = false,
): CricketMatch {
  let match = fresh(matchId, date);
  for (let left = lionsRuns; left > 0; left -= Math.min(6, left)) {
    const runs = Math.min(6, left);
    match = recordDelivery(
      match,
      ball(match, {
        strikerId: id(lions, 0),
        nonStrikerId: id(lions, 1),
        batterRuns: runs % 2 === 1 ? runs - 1 || 2 : runs,
      }),
    );
  }
  match = endCurrentInnings(match);
  match = startNextInnings(match);
  if (hatTrick) {
    for (let i = 0; i < 3; i += 1) {
      const innings = currentInnings(match);
      match = recordDelivery(
        match,
        ball(match, {
          bowlerId: id(lions, 0),
          outcome: "wicket",
          dismissal: { type: "bowled", batterId: innings.strikerId },
        }),
      );
    }
  }
  for (let left = tigersRuns; left > 0 && match.status === "live"; left -= Math.min(4, left)) {
    match = recordDelivery(
      match,
      ball(match, {
        bowlerId: id(lions, 1),
        batterRuns: Math.min(4, left) % 2 === 1 ? 2 : Math.min(4, left),
      }),
    );
  }
  if (match.status === "live") match = endCurrentInnings(match);
  return startNextInnings(match);
}

test("a hat-trick is three bowler wickets with consecutive legal balls", () => {
  const match = play("m1", "2027-05-01T10:00:00Z", 30, 10, true);
  assert.equal(hasHatTrick(match.innings[1]!, id(lions, 0)), true);
  assert.equal(hasHatTrick(match.innings[1]!, id(lions, 1)), false);
});

test("Player of the Match is the highest impact score (runs + 20 per wicket + fielding)", () => {
  const match = play("m1", "2027-05-01T10:00:00Z", 30, 10, true);
  // Ali: 30 runs + 3 wickets × 20 = 90.
  assert.equal(playerOfTheMatch(match)?.playerId, id(lions, 0));
});

test("profile collects career totals, form (newest first) and milestone badges", () => {
  const matches = [
    play("m1", "2027-05-01T10:00:00Z", 54, 10, true),
    play("m2", "2027-05-08T10:00:00Z", 102, 20),
  ];
  const profile = playerProfile(matches, id(lions, 0))!;
  assert.equal(profile.matches, 2);
  assert.equal(profile.batting?.runs, 156);
  assert.equal(profile.form[0]?.matchId, "m2");
  const kinds = profile.badges.map((badge) => badge.kind);
  assert.ok(kinds.includes("fifty"));
  assert.ok(kinds.includes("hundred"));
  assert.ok(kinds.includes("hat-trick"));
  assert.equal(profile.playerOfMatchAwards, 2);
});

test("team head-to-head counts wins and highest totals", () => {
  const matches = [
    play("m1", "2027-05-01T10:00:00Z", 30, 10),
    play("m2", "2027-05-08T10:00:00Z", 20, 24),
  ];
  const record = teamHeadToHead(matches, lions.id, tigers.id);
  assert.equal(record.played, 2);
  assert.equal(record.wins[lions.id], 1);
  assert.equal(record.wins[tigers.id], 1);
  assert.equal(record.highest[lions.id], 30);
  assert.equal(record.recent[0]?.matchId, "m2");
});

test("batter v bowler matchups count balls faced, runs and dismissals", () => {
  const match = play("m1", "2027-05-01T10:00:00Z", 12, 0, true);
  const line = matchups([match]).find(
    (item) => item.bowlerId === id(lions, 0) && item.batterId === id(tigers, 0),
  );
  assert.equal(line?.balls, 1);
  assert.equal(line?.dismissals, 1);
});
