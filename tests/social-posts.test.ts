import assert from "node:assert/strict";
import test from "node:test";
import { fixturePost, hashtags, resultPost, topPerformers } from "../src/lib/social-posts.ts";
import type { ScorecardSheet } from "../src/lib/scorecard-share.ts";

const sheet: ScorecardSheet = {
  title: "Lions v Tigers",
  subtitle: "T20",
  result: "Lions won by 16 runs",
  innings: [
    {
      title: "1st innings", team: "Lions", total: "156/7", overs: "20.0", runRate: "7.80",
      batting: [
        { name: "Ali Khan", howOut: "b Fin", runs: 72, balls: 48, fours: 8, sixes: 2, strikeRate: "150.0" },
        { name: "Ben Shah", howOut: "not out", runs: 72, balls: 40, fours: 6, sixes: 3, strikeRate: "180.0" },
      ],
      extras: "", extrasTotal: 4,
      bowling: [{ name: "Fin Hale", overs: "4.0", maidens: 0, runs: 30, wickets: 3, economy: "7.50" }],
      fallOfWickets: "",
    },
    {
      title: "2nd innings", team: "Tigers", total: "140", overs: "19.2", runRate: "7.24",
      batting: [{ name: "Gus Moor", howOut: "c Ali b Cal", runs: 40, balls: 30, fours: 3, sixes: 1, strikeRate: "133.3" }],
      extras: "", extrasTotal: 2,
      bowling: [{ name: "Cal Reid", overs: "4.0", maidens: 1, runs: 21, wickets: 3, economy: "5.25" }],
      fallOfWickets: "",
    },
  ],
};

test("top bat breaks ties on fewer balls; top bowl breaks ties on fewer runs", () => {
  const top = topPerformers(sheet);
  assert.equal(top.batter?.name, "Ben Shah");
  assert.equal(top.bowler?.name, "Cal Reid");
});

test("result post lists both scores, the result and performers", () => {
  const post = resultPost(sheet, ["Lions", "Tigers"]);
  assert.match(post, /Lions 156\/7 \(20\.0 ov\)/);
  assert.match(post, /Tigers 140 \(19\.2 ov\)/);
  assert.match(post, /Lions won by 16 runs/);
  assert.match(post, /Top bat: Ben Shah 72\* \(40\)/);
  assert.match(post, /Top bowl: Cal Reid 3\/21/);
});

test("hashtags strip spaces and punctuation", () => {
  assert.equal(hashtags("St. John's CC", "Riverside 2nd XI"), "#StJohnsCCvRiverside2ndXI #Cricket #CricLume");
});

test("fixture post shows date, ground and live link", () => {
  const post = fixturePost({ home: "Lions", away: "Tigers", startsAt: "2027-06-12T12:30:00Z", ground: "Riverside", competition: "Sunday League", round: "Round 3", link: "https://criclume.com/scoreboard/abc", timeZone: "UTC" });
  assert.match(post, /Sat 12 Jun/);
  assert.match(post, /12:30/);
  assert.match(post, /📍 Riverside/);
  assert.match(post, /Follow live: https:\/\/criclume\.com\/scoreboard\/abc/);
});
