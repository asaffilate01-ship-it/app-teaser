import assert from "node:assert/strict";
import test from "node:test";
import { oversToBalls, parseHistoricCsv } from "../src/lib/historic-import.ts";
import { checkEligibility, type EligibilityData } from "../src/lib/eligibility.ts";
import { attendanceRate, fitnessProgress } from "../src/lib/training.ts";

const players = [{ id: "p1", name: "Ali Khan" }, { id: "p2", name: "Ben Stokes" }];

test("old scorecards: overs 12.3 become 75 balls", () => {
  assert.equal(oversToBalls("12.3"), 75);
});

test("old scorecards: rows match players by name and HS keeps the number", () => {
  const csv = "Player,Season,M,Inns,NO,Runs,HS,O,R,W,Ct\nali khan,2024,10,9,2,345,87*,40.2,180,12,4\nNobody,2024,1,1,0,5,5,0,0,0,0";
  const result = parseHistoricCsv(csv, players);
  assert.equal(result.error, null);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]!.runs, 345);
  assert.equal(result.rows[0]!.highScore, 87);
  assert.equal(result.rows[0]!.ballsBowled, 242);
  assert.deepEqual(result.unknownNames, ["Nobody"]);
});

test("old scorecards: a Name column is required", () => {
  assert.ok(parseHistoricCsv("Runs\n5", players).error);
});

const base: EligibilityData = {
  settings: { overseas_limit: 1, played_down_limit: 5, registered_only: true },
  registrations: [{ playerId: "a", overseas: true, status: "registered", teamId: "t" }, { playerId: "b", overseas: true, status: "registered", teamId: "t" }],
  permits: [],
  suspensions: [],
  higherTeamGames: {},
};
const name = (id: string) => id.toUpperCase();

test("eligibility: more overseas players than the league allows is flagged", () => {
  assert.ok(checkEligibility(["a", "b"], base, name).some((i) => i.kind === "overseas"));
  assert.ok(!checkEligibility(["a"], base, name).some((i) => i.kind === "overseas"));
});

test("eligibility: an unregistered player is flagged when the league requires registration", () => {
  assert.ok(checkEligibility(["c"], base, name).some((i) => i.kind === "not-registered" && i.playerId === "c"));
});

test("eligibility: 5 games for a higher team means they can't play down without a permit", () => {
  const data = { ...base, higherTeamGames: { a: 5 } };
  assert.ok(checkEligibility(["a"], data, name).some((i) => i.kind === "played-down"));
  assert.ok(!checkEligibility(["a"], { ...data, permits: [{ playerId: "a", validUntil: null }] }, name).some((i) => i.kind === "played-down"));
});

test("eligibility: a suspended player is flagged", () => {
  assert.ok(checkEligibility(["a"], { ...base, suspensions: [{ playerId: "a", until: "2027-06-01" }] }, name).some((i) => i.kind === "suspended"));
});

test("attendance: excused sessions don't count against the player", () => {
  assert.equal(attendanceRate(["present", "absent", "excused", "late"]), 67);
});

test("fitness: a faster 20 m sprint counts as an improvement", () => {
  const result = fitnessProgress([{ recorded_on: "2027-05-01", value: 3.4 }, { recorded_on: "2027-01-01", value: 3.6 }], "sprint_20m");
  assert.equal(result.improved, true);
  assert.equal(result.change, -0.2);
});

import { parseLots, teamPosition } from "../src/lib/auction.ts";

test("auction: a team keeps enough to fill its squad at the base price", () => {
  const lots = [{ status: "sold", sold_team_id: "t", sold_price_minor: 40_000, base_price_minor: 0 }];
  const pos = teamPosition(lots, "t", 100_000, 4, 10_000);
  assert.equal(pos.left, 60_000);
  assert.equal(pos.slots, 3);
  assert.equal(pos.maxBid, 40_000);
});

test("auction: a full squad can't bid", () => {
  const lots = [{ status: "sold", sold_team_id: "t", sold_price_minor: 1, base_price_minor: 0 }];
  assert.equal(teamPosition(lots, "t", 100, 1).maxBid, 0);
});

test("auction: pasted lines become lots with base prices in minor units", () => {
  assert.deepEqual(parseLots("Ali Khan, Batter, 50\nX\nBen, , "), [
    { player_name: "Ali Khan", role: "Batter", base_price_minor: 5000 },
    { player_name: "Ben", role: null, base_price_minor: 0 },
  ]);
});

import { availabilitySummary, eventIcs, repliesClosed } from "../src/lib/club-office.ts";

test("availability: waiting-list replies are counted separately from available", () => {
  const s = availabilitySummary(["a", "b", "c"], new Map([["a", "available"], ["b", "waitlist"]]));
  assert.equal(s.available, 1);
  assert.equal(s.waitlist, 1);
  assert.deepEqual(s.noReply, ["c"]);
});

test("availability: replies close once the reply-by time has passed", () => {
  assert.equal(repliesClosed("2027-05-01T10:00:00Z", Date.parse("2027-05-01T10:00:01Z")), true);
  assert.equal(repliesClosed(null), false);
});

test("calendar file has the event start and escapes commas", () => {
  const ics = eventIcs({ id: "e1", title: "Nets, then pizza", starts_at: "2027-05-01T17:30:00Z" }, new Date("2027-04-01T00:00:00Z"));
  assert.match(ics, /DTSTART:20270501T173000Z/);
  assert.match(ics, /SUMMARY:Nets\\, then pizza/);
});

import { decisionSummary, overallPercent, readDecisions } from "../src/lib/umpire-reports.ts";

test("umpire record: wides and no-balls are not counted as appeals", () => {
  const s = decisionSummary(readDecisions([
    { kind: "lbw", given: true }, { kind: "lbw", given: false }, { kind: "caught", given: true }, { kind: "wide", given: true }, { kind: "bogus", given: true },
  ]));
  assert.equal(s.appeals, 3);
  assert.equal(s.given, 2);
  assert.equal(s.lbwGiven, 1);
  assert.equal(s.lbwAppeals, 2);
  assert.equal(s.wides, 1);
});

test("umpire assessment: overall is the average of marked areas out of 100", () => {
  assert.equal(overallPercent({ decisions: 4, positioning: 3 }), 70);
  assert.equal(overallPercent({}), 0);
});
