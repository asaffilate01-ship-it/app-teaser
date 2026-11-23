import test from "node:test";
import assert from "node:assert/strict";
import { availablePages, buildGroundBoard, pageOnScreen, readGroundSettings, wormLine } from "../src/lib/ground-board.ts";

const board = {
  status: "live",
  homeTeam: { id: "h", name: "Lions CC" },
  awayTeam: { id: "a", name: "Tigers CC" },
  liveState: {
    battingTeamId: "a",
    runs: 30,
    wickets: 1,
    overs: "3.0",
    target: 150,
    settings: { oversPerInnings: 20, ballsPerOver: 6 },
    card: {
      batting: [
        { no: 1, ref: "aaaa", runs: 12, balls: 10, fours: 2, sixes: 0, how: "caught" },
        { no: 2, ref: "bbbb", runs: 15, balls: 8, fours: 1, sixes: 1, how: null, atCrease: true, onStrike: true },
      ],
      bowling: [{ no: 1, ref: "cccc", overs: "2.0", maidens: 0, runs: 18, wickets: 1, economy: 9, current: true }],
      extras: 3,
    },
    progress: [{ battingTeamId: "h", overs: [[8, 0], [10, 1]] }, { battingTeamId: "a", overs: [[6, 0], [12, 1], [12, 0]] }],
    partnership: { runs: 18, balls: 9 },
  },
};

test("without names from the club, the screen shows batting position and bowling order only", () => {
  const view = buildGroundBoard(board);
  assert.equal(view.batting[0]!.name, "No. 1");
  assert.equal(view.bowling[0]!.name, "Bowler 1");
  assert.equal(view.batting[0]!.how, "caught");
});

test("names handed out for this board replace positions only for those players", () => {
  const view = buildGroundBoard(board, { bbbb: "A. Khan" });
  assert.equal(view.batting[1]!.name, "A. Khan");
  assert.equal(view.batting[0]!.name, "No. 1");
});

test("worm is the running total from 0", () => {
  assert.deepEqual(wormLine([[6, 0], [12, 1], [12, 0]]), [0, 6, 18, 30]);
});

test("automatic pages turn every 15 seconds by default, in order, on every screen together", () => {
  const settings = readGroundSettings({ mode: "auto", pages: ["score", "batting", "chase"] });
  const pages = availablePages(buildGroundBoard(board));
  assert.equal(settings.intervalSeconds, 15);
  assert.equal(pageOnScreen(settings, pages, 0).page, "score");
  assert.equal(pageOnScreen(settings, pages, 15_000).page, "batting");
  assert.equal(pageOnScreen(settings, pages, 30_000).page, "chase");
  assert.equal(pageOnScreen(settings, pages, 45_000).page, "score");
});

test("manual mode holds the chosen page", () => {
  const settings = readGroundSettings({ mode: "manual", manualPage: "worm" });
  const pages = availablePages(buildGroundBoard(board));
  assert.equal(pageOnScreen(settings, pages, 999_999).page, "worm");
});

test("seconds per page stay between 5 and 120", () => {
  assert.equal(readGroundSettings({ intervalSeconds: 1 }).intervalSeconds, 5);
  assert.equal(readGroundSettings({ intervalSeconds: 600 }).intervalSeconds, 120);
});

test("names are off by default", () => {
  assert.equal(readGroundSettings(null).showNames, false);
  assert.equal(readGroundSettings({}).replays, "off");
});
