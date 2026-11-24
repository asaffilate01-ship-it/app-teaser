import assert from "node:assert/strict";
import test from "node:test";
import {
  createMatch,
  currentInnings,
  endCurrentInnings,
  matchResult,
  recordDelivery,
  startNextInnings,
  type CricketMatch,
  type RecordDeliveryInput,
} from "../src/lib/cricket.ts";
import {
  callStumps,
  closeOfPlayText,
  endMatchOutOfTime,
  outOfTime,
  startNextDay,
} from "../src/lib/multi-day.ts";

function newMatch(days = 3): CricketMatch {
  return createMatch({
    homeTeamName: "Lions",
    awayTeamName: "Tigers",
    homePlayers: ["A", "B", "C", "D", "E"],
    awayPlayers: ["F", "G", "H", "I", "J"],
    battingFirst: "home",
    settings: {
      format: "Multi-day",
      oversPerInnings: null,
      inningsPerSide: 2,
      ballsPerOver: 6,
      ground: "",
      weather: "",
      startTime: "",
      rules: { followOnLead: 150, days },
    },
  });
}
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
const fours = (m: CricketMatch, n: number) => {
  for (let i = 0; i < n; i++) m = recordDelivery(m, ball(m, { batterRuns: 4 }));
  return m;
};
const allOut = (m: CricketMatch) => {
  while (m.status === "live")
    m = recordDelivery(
      m,
      ball(m, {
        outcome: "wicket",
        dismissal: { type: "bowled", batterId: currentInnings(m).strikerId },
      }),
    );
  return m;
};

test("stumps records the close-of-play score and stops scoring until the next day", () => {
  let match = fours(newMatch(), 10); // Lions 40/0
  match = callStumps(match, new Date("2027-06-01T18:30:00Z"));
  assert.equal(match.days?.atStumps, true);
  assert.equal(
    closeOfPlayText(match, match.days!.closes[0]!),
    "Stumps, Day 1: Lions 40/0 (1.4 ov)",
  );
  assert.equal(recordDelivery(match, ball(match, { batterRuns: 4 })), match);
  match = startNextDay(match);
  assert.equal(match.days?.current, 2);
  assert.equal(currentInnings(fours(match, 1)).deliveries.length, 11);
});

test("the close-of-play line shows the lead", () => {
  let match = allOut(fours(newMatch(), 10)); // Lions 40 all out
  match = startNextInnings(match);
  match = fours(match, 15); // Tigers 60
  match = callStumps(match);
  assert.equal(match.days?.closes[0]?.note, "Tigers lead by 20");
});

test("out of time on the last scheduled day: the match is drawn", () => {
  let match = fours(newMatch(2), 10);
  match = startNextDay(callStumps(match));
  match = callStumps(match);
  assert.equal(outOfTime(match), true);
  match = endMatchOutOfTime(match);
  assert.equal(match.status, "completed");
  assert.equal(matchResult(match)?.text, "Match drawn");
});

test("following on and still behind when time runs out is a draw, not an innings defeat", () => {
  let match = startNextInnings(endCurrentInnings(fours(newMatch(), 50))); // Lions 200 declared-ish
  match = startNextInnings(allOut(fours(match, 5)), { followOn: true }); // Tigers 20 all out, follow on
  match = fours(match, 10); // Tigers 40/0 — 140 behind
  match = endMatchOutOfTime(match);
  assert.equal(matchResult(match)?.drawn, true);
});
