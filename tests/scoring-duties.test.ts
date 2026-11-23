import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, currentInnings, recordDelivery } from "../src/lib/cricket.ts";
import {
  applyBowlingUpdate,
  applyDeliveryTag,
  applyPatches,
  bowlingHandledByOther,
  dutyAccess,
  readPatchEvent,
  type ScoringTeamMember,
} from "../src/lib/scoring-duties.ts";

function fixture() {
  const match = createMatch({
    homeTeamName: "Home",
    awayTeamName: "Away",
    homePlayers: ["H1", "H2", "H3"],
    awayPlayers: ["A1", "A2", "A3"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: 20,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "Club",
      weather: "Clear",
      startTime: new Date("2026-11-20T12:00:00Z").toISOString(),
    },
  });
  const innings = currentInnings(match);
  return recordDelivery(match, {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Medium",
    outcome: "hit",
    batterRuns: 2,
    fieldZone: "Not recorded",
  });
}

test("each duty only unlocks its own part of scoring", () => {
  assert.deepEqual(dutyAccess(["batting"]), { recordBalls: true, bowlingFielding: false, video: false, onTeam: true });
  assert.deepEqual(dutyAccess(["bowling"]), { recordBalls: false, bowlingFielding: true, video: false, onTeam: true });
  assert.deepEqual(dutyAccess(["video"]), { recordBalls: false, bowlingFielding: false, video: true, onTeam: true });
  assert.deepEqual(dutyAccess(["lead"]), { recordBalls: true, bowlingFielding: true, video: true, onTeam: true });
  assert.equal(dutyAccess([]).onTeam, false);
});

test("the batting scorer leaves bowler and fielding to the bowling scorer only when one is named", () => {
  const team: ScoringTeamMember[] = [
    { userId: "bat", name: "B", clubRole: "scorer", duties: ["batting"], alwaysFull: false },
    { userId: "bowl", name: "F", clubRole: "scorer", duties: ["bowling"], alwaysFull: false },
  ];
  assert.equal(bowlingHandledByOther(team, "bat"), true);
  assert.equal(bowlingHandledByOther([team[0]!], "bat"), false);
  const both = [{ ...team[0]!, duties: ["batting", "bowling"] as ScoringTeamMember["duties"] }, team[1]!];
  assert.equal(bowlingHandledByOther(both, "bat"), false);
});

test("a fielding note fills in the fielder and position on that ball only", () => {
  const match = fixture();
  const innings = currentInnings(match);
  const ball = innings.deliveries[0]!;
  const fielder = match.teams.find((team) => team.id === innings.bowlingTeamId)!.players[1]!.id;
  const tagged = applyDeliveryTag(match, innings.id, ball.id, { fieldZone: "Point", fielderId: fielder, deliveryStyle: "Off spin" });
  const after = currentInnings(tagged).deliveries[0]!;
  assert.equal(after.fieldZone, "Point");
  assert.equal(after.fielderId, fielder);
  assert.equal(after.deliveryStyle, "Off spin");
  assert.equal(after.batterRuns, 2, "runs never change");
  // A batter can't be named as the fielder.
  const batter = match.teams.find((team) => team.id === innings.battingTeamId)!.players[0]!.id;
  assert.equal(applyDeliveryTag(match, innings.id, ball.id, { fielderId: batter }), match);
});

test("a bowler change applies to the next ball but never to a newer ball already bowled", () => {
  const match = fixture();
  const innings = currentInnings(match);
  const next = match.teams.find((team) => team.id === innings.bowlingTeamId)!.players[2]!.id;
  const later = new Date(Date.parse(innings.deliveries[0]!.recordedAt) + 1000).toISOString();
  const earlier = new Date(Date.parse(innings.deliveries[0]!.recordedAt) - 1000).toISOString();
  assert.equal(currentInnings(applyBowlingUpdate(match, innings.id, next, later)).bowlerId, next);
  assert.equal(currentInnings(applyBowlingUpdate(match, innings.id, next, earlier)).bowlerId, innings.bowlerId);
});

test("notes are applied in the order the cloud accepted them, latest wins", () => {
  const match = fixture();
  const innings = currentInnings(match);
  const ball = innings.deliveries[0]!;
  const base = { inningsId: innings.id, deliveryId: ball.id, occurredAt: ball.recordedAt, kind: "delivery.tagged" as const };
  const result = applyPatches(match, [
    { ...base, sequence: 9, tag: { fieldZone: "Cover" } },
    { ...base, sequence: 4, tag: { fieldZone: "Point" } },
  ]);
  assert.equal(currentInnings(result).deliveries[0]!.fieldZone, "Cover");
});

test("malformed fielding events from the network are ignored", () => {
  assert.equal(readPatchEvent({ eventType: "delivery.tagged", sequence: 1, payload: { inningsId: "i", deliveryId: "d", tag: { fieldZone: "Moon" } } }), null);
  assert.equal(readPatchEvent({ eventType: "bowling.updated", sequence: 1, payload: { inningsId: "i" } }), null);
  assert.equal(readPatchEvent({ eventType: "match.snapshot", sequence: 1, payload: { inningsId: "i" } }), null);
  assert.equal(readPatchEvent({ eventType: "bowling.updated", sequence: 2, payload: { inningsId: "i", bowlerId: "b", end: "Far" } })?.kind, "bowling.updated");
});
