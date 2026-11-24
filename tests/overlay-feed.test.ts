import test from "node:test";
import assert from "node:assert/strict";
import { buildOverlayFeed, detectMoment, teamCode } from "../src/lib/overlay-feed.ts";

const board = (live: Record<string, unknown>, names: boolean | undefined = undefined) => ({
  status: "live",
  homeTeam: { id: "h", name: "Riverside CC" },
  awayTeam: { id: "a", name: "Kingsmead Cricket Club" },
  liveState: {
    battingTeamId: "h",
    runs: 100,
    wickets: 2,
    overs: "12.0",
    settings: { oversPerInnings: 20, ballsPerOver: 6 },
    card: {
      batting: [
        { no: 3, ref: "r3", runs: 48, balls: 30, atCrease: true, onStrike: false },
        { no: 4, ref: "r4", runs: 20, balls: 15, atCrease: true, onStrike: true },
      ],
      bowling: [{ no: 7, ref: "b7", overs: "2.0", runs: 15, wickets: 1, current: true }],
    },
    recent: [{ label: "1", kind: "normal" }],
    ...live,
  },
  names,
});

test("team codes are short and readable", () => {
  assert.equal(teamCode({ name: "Riverside CC" }), "RIV");
  assert.equal(teamCode({ name: "Kingsmead Cricket Club" }), "KIN");
  assert.equal(teamCode({ name: "Old Boys United" }), "OBU");
});
test("striker is listed first; names only when the database gave them", () => {
  const feed = buildOverlayFeed(board({}));
  assert.equal(feed.batters[0]!.onStrike, true);
  assert.equal(feed.batters[0]!.name, "No. 4");
  const named = buildOverlayFeed(board({}), { r4: "A. Khan" });
  assert.equal(named.batters[0]!.name, "A. Khan");
});
test("chase headline counts balls left", () => {
  const feed = buildOverlayFeed(board({ target: 160 }));
  assert.equal(feed.headline, "Need 60 from 48 balls");
  assert.equal(feed.facts[0], "Req. rate 7.50");
});
test("moments: wicket beats boundary; fifty beats four; nothing on first load", () => {
  const before = buildOverlayFeed(board({}));
  assert.equal(detectMoment(null, before), null);
  const fifty = buildOverlayFeed(
    board({
      runs: 104,
      overs: "12.1",
      recent: [{ label: "4", kind: "boundary" }],
      card: {
        batting: [
          { no: 3, runs: 52, balls: 31, atCrease: true, onStrike: true },
          { no: 4, runs: 20, balls: 15, atCrease: true },
        ],
        bowling: [],
      },
    }),
  );
  assert.equal(detectMoment(before, fifty)?.kind, "fifty");
  const wicket = buildOverlayFeed(
    board({ wickets: 3, overs: "12.1", recent: [{ label: "W", kind: "wicket" }] }),
  );
  assert.equal(detectMoment(before, wicket)?.kind, "wicket");
  const six = buildOverlayFeed(
    board({ runs: 106, overs: "12.1", recent: [{ label: "6", kind: "boundary" }] }),
  );
  assert.equal(detectMoment(before, six)?.title, "SIX");
  assert.equal(detectMoment(before, before), null);
});
