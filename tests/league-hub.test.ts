import assert from "node:assert/strict";
import test from "node:test";
import {
  createMatch,
  currentInnings,
  recordDelivery,
  startNextInnings,
  type CricketMatch,
} from "../src/lib/cricket.ts";
import { projectLiveTable, readLiveSituation } from "../src/lib/live-table.ts";
import { seasonStats } from "../src/lib/season-stats.ts";
import type { TableRow } from "../src/lib/platform.ts";

const row = (teamId: string, points: number, won: number): TableRow => ({
  teamId,
  played: won,
  won,
  tied: 0,
  lost: 0,
  noResult: 0,
  points,
  runsFor: 0,
  ballsFaced: 0,
  runsAgainst: 0,
  ballsBowled: 0,
  netRunRate: 0,
});
const rules = {
  points: { win: 2, tie: 1, noResult: 1, loss: 0 },
  tieBreakers: ["points", "wins", "net-run-rate"] as Array<"points" | "wins" | "net-run-rate">,
};

test("live table awards each live match to the side the predictor favours", () => {
  const base = [row("A", 4, 2), row("B", 2, 1), row("C", 2, 1)];
  const live = [
    {
      matchId: "m",
      homeTeamId: "A",
      awayTeamId: "C",
      battingTeamId: "C",
      runs: 0,
      wickets: 0,
      overs: "0.0",
      legalBalls: 0,
      target: null,
      oversPerInnings: 20,
      ballsPerOver: 6,
      homeWin: 30,
    },
  ];
  const table = projectLiveTable(base, live, rules);
  const c = table.find((r) => r.teamId === "C")!;
  assert.equal(c.points, 4);
  assert.equal(c.liveOutcome, "W");
  assert.equal(table.find((r) => r.teamId === "A")!.liveOutcome, "L");
  assert.equal(c.movement, 1);
});

test("a 50-50 live match counts as a tie and matches without a prediction are skipped", () => {
  const base = [row("A", 0, 0), row("B", 0, 0)];
  const even = {
    matchId: "m",
    homeTeamId: "A",
    awayTeamId: "B",
    battingTeamId: "A",
    runs: 0,
    wickets: 0,
    overs: "0.0",
    legalBalls: 0,
    target: null,
    oversPerInnings: 20,
    ballsPerOver: 6,
    homeWin: 50,
  };
  assert.equal(projectLiveTable(base, [even], rules)[0]!.points, 1);
  assert.equal(projectLiveTable(base, [{ ...even, homeWin: null }], rules)[0]!.played, 0);
});

test("reads a published live state into a home-side win chance", () => {
  const live = readLiveSituation({
    id: "m",
    homeTeamId: "H",
    awayTeamId: "A",
    liveState: {
      battingTeamId: "A",
      runs: 150,
      wickets: 2,
      overs: "18.0",
      target: 151,
      inningsNumber: 2,
      settings: { oversPerInnings: 20, inningsPerSide: 1, ballsPerOver: 6 },
    },
  });
  assert.equal(live.legalBalls, 108);
  assert.ok(live.homeWin !== null && live.homeWin < 10);
});

function league(): CricketMatch {
  return createMatch({
    homeTeamName: "Lions",
    awayTeamName: "Tigers",
    homePlayers: ["Bat One", "Bat Two", "Bat Three"],
    awayPlayers: ["Bowl One", "Bowl Two", "Keep Three"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: 20,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "",
      weather: "",
      startTime: "2026-11-23T10:00:00Z",
    },
  });
}
function ball(m: CricketMatch, input: Record<string, unknown> = {}) {
  const inn = currentInnings(m);
  const bowlTeam = m.teams.find((t) => t.id === inn.bowlingTeamId)!;
  return recordDelivery(m, {
    strikerId: inn.strikerId,
    nonStrikerId: inn.nonStrikerId,
    bowlerId: bowlTeam.players[0]!.id,
    end: "Pavilion",
    deliveryStyle: "Fast",
    outcome: "hit",
    batterRuns: 0,
    fieldZone: "Not recorded",
    note: "",
    ...input,
  } as never);
}

test("season stats count runs, fifties, not-outs, averages, wickets and catches", () => {
  let m = league();
  const opener = currentInnings(m).strikerId;
  const partner = currentInnings(m).nonStrikerId;
  const pair = { strikerId: opener, nonStrikerId: partner };
  for (let i = 0; i < 9; i += 1) m = ball(m, { ...pair, batterRuns: 6 });
  m = ball(m, {
    ...pair,
    batterRuns: 0,
    outcome: "wicket",
    dismissal: { type: "caught", batterId: opener, fielderId: m.teams[1].players[2]!.id },
  });
  const stats = seasonStats([m]);
  const top = stats.batting[0]!;
  assert.equal(top.playerId, opener);
  assert.equal(top.runs, 54);
  assert.equal(top.fifties, 1);
  assert.equal(top.sixes, 9);
  assert.equal(top.average, 54);
  const bowler = stats.bowling[0]!;
  assert.equal(bowler.wickets, 1);
  assert.equal(bowler.runs, 54);
  assert.equal(bowler.overs, "1.4");
  assert.deepEqual(bowler.best, { wickets: 1, runs: 54 });
  assert.equal(stats.fielding[0]!.catches, 1);
});

test("five wickets in an innings and a not-out hundred are recorded", () => {
  let m = league();
  const pair = {
    strikerId: currentInnings(m).strikerId,
    nonStrikerId: currentInnings(m).nonStrikerId,
  };
  for (let i = 0; i < 17; i += 1) m = ball(m, { ...pair, batterRuns: 6 });
  const runs = seasonStats([m]).batting[0]!;
  assert.equal(runs.hundreds, 1);
  assert.equal(runs.notOuts, 1);
  assert.equal(runs.average, null);
  assert.equal(runs.highScoreNotOut, true);
  let n = createMatch({
    homeTeamName: "Lions",
    awayTeamName: "Tigers",
    homePlayers: ["A", "B", "C", "D", "E", "F", "G"],
    awayPlayers: ["X", "Y"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: 20,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "",
      weather: "",
      startTime: "2026-11-23T10:00:00Z",
    },
  });
  for (let i = 0; i < 5; i += 1)
    n = ball(n, {
      outcome: "wicket",
      dismissal: { type: "bowled", batterId: currentInnings(n).strikerId },
    });
  const bowler = seasonStats([n]).bowling[0]!;
  assert.equal(bowler.fiveWickets, 1);
  assert.deepEqual(bowler.best, { wickets: 5, runs: 0 });
  void startNextInnings;
});
