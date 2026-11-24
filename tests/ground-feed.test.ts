import assert from "node:assert/strict";
import test from "node:test";
import { buildGroundFeed, groundFeedText } from "../src/lib/ground-feed.ts";

const board = {
  status: "live",
  homeTeam: { id: "h", name: "Lions CC" },
  awayTeam: { id: "a", name: "Tigers CC", shortName: "TIG" },
  liveState: {
    battingTeamId: "a",
    runs: 142,
    wickets: 4,
    overs: "17.2",
    target: 168,
    oversLimit: 20,
    settings: { oversPerInnings: 20, ballsPerOver: 6 },
    striker: { name: "Striker", runs: 58, balls: 34 },
    nonStriker: { name: "Non-striker", runs: 12, balls: 9 },
    bowler: { name: "Bowler", wickets: 2, runs: 28, overs: "3.2" },
    recent: [{ label: "1" }, { label: "4" }, { label: "W" }],
  },
};

test("ground feed: 142/4 after 17.2 chasing 168 needs 26 from 16 balls", () => {
  const feed = buildGroundFeed(board);
  assert.equal(feed.battingTeam, "TIG");
  assert.equal(feed.runsNeeded, 26);
  assert.equal(feed.ballsLeft, 16);
  assert.equal(feed.requiredRate, 9.75);
  assert.equal(feed.runRate, 8.19);
});

test("ground feed carries no player names", () => {
  const text = JSON.stringify(buildGroundFeed(board));
  assert.ok(!text.includes("Striker") && !text.includes('Bowler"'));
});

test("text format is one KEY VALUE per line", () => {
  const text = groundFeedText(buildGroundFeed(board));
  assert.match(text, /^TOTAL 142$/m);
  assert.match(text, /^NEED 26$/m);
  assert.match(text, /^PAR -$/m);
});

test("ground controller text cannot inject additional records through team or result labels", () => {
  const text = groundFeedText(
    buildGroundFeed({
      ...board,
      awayTeam: { ...board.awayTeam, shortName: "TIG\nTOTAL 999" },
      liveState: { ...board.liveState, result: "Finished\r\nWICKETS 99" },
    }),
  );
  assert.equal(text.split("\n").filter((line) => line.startsWith("TOTAL ")).length, 1);
  assert.equal(text.split("\n").filter((line) => line.startsWith("WICKETS ")).length, 1);
});

test("malformed recent-ball entries do not crash the ground feed", () => {
  const feed = buildGroundFeed({
    ...board,
    liveState: { ...board.liveState, recent: [null, { label: "W" }] },
  });
  assert.deepEqual(feed.lastBalls, ["W"]);
});
