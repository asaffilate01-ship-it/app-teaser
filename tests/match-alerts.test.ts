import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, currentInnings, recordDelivery, undoLastDelivery, type CricketMatch, type RecordDeliveryInput } from "../src/lib/cricket.ts";
import { alertsBetween } from "../src/lib/match-alerts.ts";

const base = () =>
  createMatch({
    homeTeamName: "Lions", awayTeamName: "Tigers",
    homePlayers: ["Ali Khan", "Ben", "Cal", "Dev"], awayPlayers: ["Fin", "Gus", "Hal", "Ian"],
    battingFirst: "home",
    settings: { format: "T20", oversPerInnings: 20, inningsPerSide: 1, ballsPerOver: 6, ground: "", weather: "", startTime: "" },
  });
const ball = (m: CricketMatch, extra: Partial<RecordDeliveryInput> = {}): RecordDeliveryInput => {
  const i = currentInnings(m);
  return { strikerId: i.strikerId, nonStrikerId: i.nonStrikerId, bowlerId: i.bowlerId, end: "Pavilion", deliveryStyle: "Medium", outcome: "hit", batterRuns: 0, ...extra };
};

test("a wicket alert gives the score and how out, never the player's name", () => {
  const prev = base();
  const next = recordDelivery(prev, ball(prev, { outcome: "wicket", dismissal: { type: "bowled", batterId: currentInnings(prev).strikerId } }));
  const [alert] = alertsBetween(prev, next);
  assert.equal(alert?.kind, "wickets");
  assert.equal(alert?.title, "WICKET! Lions 0/1 (0.1 ov)");
  assert.match(alert!.body, /Bowled · 1st wicket down/);
  assert.doesNotMatch(JSON.stringify(alert), /Ali|Fin/);
});

test("a fifty is announced once, by batting position", () => {
  let match = base();
  const opener = currentInnings(match).strikerId;
  const other = currentInnings(match).nonStrikerId;
  const four = (m: CricketMatch) => recordDelivery(m, ball(m, { strikerId: opener, nonStrikerId: other, batterRuns: 4 }));
  for (let i = 0; i < 12; i++) match = four(match);
  const prev = match;
  const next = four(prev);
  const alerts = alertsBetween(prev, next);
  assert.deepEqual(alerts.map((item) => item.title), ["FIFTY! Lions' No. 1 batter"]);
  assert.equal(alertsBetween(next, four(next)).length, 0);
});

test("undoing a ball sends nothing", () => {
  const prev = base();
  const next = recordDelivery(prev, ball(prev, { outcome: "wicket", dismissal: { type: "lbw", batterId: currentInnings(prev).strikerId } }));
  assert.equal(alertsBetween(next, undoLastDelivery(next)).length, 0);
});
