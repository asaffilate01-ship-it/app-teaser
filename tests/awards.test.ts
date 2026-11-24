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
import { awardBoard, matchAwards, tournamentAwards } from "../src/lib/awards.ts";

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
const [lions, tigers] = base.teams as [(typeof base.teams)[0], (typeof base.teams)[0]];
const id = (team: typeof lions, i: number) => team.players[i]!.id;
const ball = (m: CricketMatch, extra: Partial<RecordDeliveryInput> = {}): RecordDeliveryInput => {
  const i = currentInnings(m);
  return {
    strikerId: i.strikerId,
    nonStrikerId: i.nonStrikerId,
    bowlerId: i.bowlerId,
    end: "Pavilion",
    deliveryStyle: "Medium",
    outcome: "hit",
    batterRuns: 0,
    ...extra,
  };
};

/** Ali hits `sixes` sixes; then Tigers lose 2 wickets to Ben (one caught by Cal) and score `tigersRuns`. */
function play(matchId: string, sixes: number, tigersRuns: number): CricketMatch {
  let match: CricketMatch = { ...structuredClone(base), id: matchId };
  for (let i = 0; i < sixes; i++)
    match = recordDelivery(
      match,
      ball(match, { strikerId: id(lions, 0), nonStrikerId: id(lions, 1), batterRuns: 6 }),
    );
  match = startNextInnings(endCurrentInnings(match));
  match = recordDelivery(
    match,
    ball(match, {
      bowlerId: id(lions, 1),
      outcome: "wicket",
      dismissal: {
        type: "caught",
        batterId: currentInnings(match).strikerId,
        fielderId: id(lions, 2),
      },
    }),
  );
  match = recordDelivery(
    match,
    ball(match, {
      bowlerId: id(lions, 1),
      outcome: "wicket",
      dismissal: { type: "bowled", batterId: currentInnings(match).strikerId },
    }),
  );
  for (let left = tigersRuns; left > 0 && match.status === "live"; left -= 4)
    match = recordDelivery(match, ball(match, { bowlerId: id(lions, 3), batterRuns: 4 }));
  if (match.status === "live") match = endCurrentInnings(match);
  return startNextInnings(match);
}

test("match awards: Player of the Match, best batter, best bowler and best fielder", () => {
  const awards = matchAwards(play("m1", 5, 8));
  const by = Object.fromEntries(awards.map((item) => [item.category, item]));
  // Impact: Ben 2 wickets × 20 = 40 beats Ali's 30 runs.
  assert.equal(by["player-of-match"]?.name, "Ben");
  assert.equal(by["best-batter"]?.name, "Ali");
  assert.equal(by["best-batter"]?.value, "30 (5)");
  assert.equal(by["best-bowler"]?.name, "Ben");
  assert.equal(by["best-bowler"]?.value, "2/0");
  assert.equal(by["best-fielder"]?.name, "Cal");
  assert.equal(by["best-fielder"]?.value, "1 dismissal");
});

test("tournament awards add up across matches and respect minimum balls", () => {
  const matches = [play("m1", 10, 8), play("m2", 9, 4)];
  const by = Object.fromEntries(tournamentAwards(matches).map((item) => [item.category, item]));
  assert.equal(by["top-run-scorer"]?.name, "Ali");
  assert.match(by["top-run-scorer"]!.value, /^114 runs/);
  assert.equal(by["top-wicket-taker"]?.name, "Ben");
  assert.match(by["top-wicket-taker"]!.value, /^4 wickets/);
  assert.equal(by["most-sixes"]?.value, "19 sixes");
  assert.equal(by["highest-score"]?.value, "60*");
  assert.equal(by["best-fielder"]?.name, "Cal");
  assert.equal(by["player-of-tournament"]?.name, "Ali");
  // Nobody bowled 60 balls or faced 60 balls, so these awards stay empty.
  assert.equal(by["best-economy"], undefined);
  assert.equal(by["best-strike-rate"], undefined);
  const relaxed = Object.fromEntries(
    tournamentAwards(matches, { minStrikeRateBalls: 10 }).map((item) => [item.category, item]),
  );
  assert.equal(relaxed["best-strike-rate"]?.name, "Ali");
});

test("an organiser's choice replaces the automatic winner and prizes show", () => {
  const auto = tournamentAwards([play("m1", 10, 8)]);
  const board = awardBoard(auto, [
    {
      category: "top-run-scorer",
      prize: "Bat from Sialkot Sports",
      winnerPlayerId: id(tigers, 0),
      winnerName: "Fin",
    },
  ]);
  const row = board.find((item) => item.category === "top-run-scorer")!;
  assert.equal(row.winner?.name, "Fin");
  assert.equal(row.winner?.chosen, true);
  assert.equal(row.automatic?.name, "Ali");
  assert.equal(row.prize, "Bat from Sialkot Sports");
  assert.equal(board.length, 10);
});
