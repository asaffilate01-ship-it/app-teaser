import assert from "node:assert/strict";
import test from "node:test";
import {
  createMatch,
  currentInnings,
  recordDelivery,
  type CricketMatch,
} from "../src/lib/cricket.ts";
import {
  initialsOf,
  scorecardHtml,
  scorecardSheet,
  scorecardText,
} from "../src/lib/scorecard-share.ts";

function played(): CricketMatch {
  let match = createMatch({
    homeTeamName: "Lions",
    awayTeamName: "Tigers <U13>",
    homePlayers: ["Ayaan Khan", "Sam Lee"],
    awayPlayers: ["Dan Moss", "Ed Fry"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: 20,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "Park",
      weather: "",
      startTime: "2026-11-23T10:00:00Z",
    },
  });
  const inn = currentInnings(match);
  match = recordDelivery(match, {
    strikerId: inn.strikerId,
    nonStrikerId: inn.nonStrikerId,
    bowlerId: inn.bowlerId,
    end: "Pavilion",
    deliveryStyle: "Medium",
    outcome: "hit",
    batterRuns: 4,
  });
  const next = currentInnings(match);
  match = recordDelivery(match, {
    strikerId: next.strikerId,
    nonStrikerId: next.nonStrikerId,
    bowlerId: next.bowlerId,
    end: "Pavilion",
    deliveryStyle: "Medium",
    outcome: "wicket",
    batterRuns: 0,
    dismissal: {
      type: "caught",
      batterId: next.strikerId,
      fielderId: match.teams[1].players[1]!.id,
    },
  });
  return match;
}

test("initials hide full names", () => {
  assert.equal(initialsOf("Ayaan Khan"), "A. K.");
});

test("initials mode removes every full player name, including fielders inside dismissals", () => {
  const sheet = scorecardSheet(played(), { initials: true });
  const text = JSON.stringify(sheet) + scorecardText(sheet) + scorecardHtml(sheet);
  for (const name of ["Ayaan Khan", "Sam Lee", "Dan Moss", "Ed Fry"])
    assert.equal(text.includes(name), false, name);
  assert.equal(sheet.innings[0]?.batting[0]?.howOut, "c E. F. b D. M.");
});

test("sheet carries totals and top scorers for text sharing", () => {
  const sheet = scorecardSheet(played());
  assert.equal(sheet.innings[0]?.total, "4/1");
  assert.match(scorecardText(sheet), /Bat: Ayaan Khan 4 \(2\)/);
});

test("printable scorecard escapes team names", () => {
  const html = scorecardHtml(scorecardSheet(played()));
  assert.equal(html.includes("<U13>"), false);
  assert.match(html, /Tigers &lt;U13&gt;/);
});
