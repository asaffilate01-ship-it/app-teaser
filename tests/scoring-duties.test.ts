import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, currentInnings, recordDelivery } from "../src/lib/cricket.ts";
import {
  applyBowlingUpdate,
  applyDeliveryTag,
  applyPatches,
  bowlingHandledByOther,
  collectScoringPatches,
  pendingScoringPatches,
  rememberScoringPatch,
  scoringPatchPageSize,
  type ScoringPatch,
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
  assert.deepEqual(dutyAccess(["batting"]), {
    recordBalls: true,
    bowlingFielding: false,
    video: false,
    onTeam: true,
  });
  assert.deepEqual(dutyAccess(["bowling"]), {
    recordBalls: false,
    bowlingFielding: true,
    video: false,
    onTeam: true,
  });
  assert.deepEqual(dutyAccess(["video"]), {
    recordBalls: false,
    bowlingFielding: false,
    video: true,
    onTeam: true,
  });
  assert.deepEqual(dutyAccess(["lead"]), {
    recordBalls: true,
    bowlingFielding: true,
    video: true,
    onTeam: true,
  });
  assert.equal(dutyAccess([]).onTeam, false);
});

test("the batting scorer leaves bowler and fielding to the bowling scorer only when one is named", () => {
  const team: ScoringTeamMember[] = [
    { userId: "bat", name: "B", clubRole: "scorer", duties: ["batting"], alwaysFull: false },
    { userId: "bowl", name: "F", clubRole: "scorer", duties: ["bowling"], alwaysFull: false },
  ];
  assert.equal(bowlingHandledByOther(team, "bat"), true);
  assert.equal(bowlingHandledByOther([team[0]!], "bat"), false);
  const both = [
    { ...team[0]!, duties: ["batting", "bowling"] as ScoringTeamMember["duties"] },
    team[1]!,
  ];
  assert.equal(bowlingHandledByOther(both, "bat"), false);
});

test("a fielding note fills in the fielder and position on that ball only", () => {
  const match = fixture();
  const innings = currentInnings(match);
  const ball = innings.deliveries[0]!;
  const fielder = match.teams.find((team) => team.id === innings.bowlingTeamId)!.players[1]!.id;
  const tagged = applyDeliveryTag(match, innings.id, ball.id, {
    fieldZone: "Point",
    fielderId: fielder,
    deliveryStyle: "Off spin",
  });
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
  assert.equal(
    currentInnings(applyBowlingUpdate(match, innings.id, next, earlier)).bowlerId,
    innings.bowlerId,
  );
});

test("notes are applied in the order the cloud accepted them, latest wins", () => {
  const match = fixture();
  const innings = currentInnings(match);
  const ball = innings.deliveries[0]!;
  const base = {
    inningsId: innings.id,
    deliveryId: ball.id,
    occurredAt: ball.recordedAt,
    kind: "delivery.tagged" as const,
  };
  const result = applyPatches(match, [
    { ...base, sequence: 9, tag: { fieldZone: "Cover" } },
    { ...base, sequence: 4, tag: { fieldZone: "Point" } },
  ]);
  assert.equal(currentInnings(result).deliveries[0]!.fieldZone, "Cover");
});

test("malformed fielding events from the network are ignored", () => {
  assert.equal(
    readPatchEvent({
      eventType: "delivery.tagged",
      sequence: 1,
      payload: { inningsId: "i", deliveryId: "d", tag: { fieldZone: "Moon" } },
    }),
    null,
  );
  assert.equal(
    readPatchEvent({ eventType: "bowling.updated", sequence: 1, payload: { inningsId: "i" } }),
    null,
  );
  assert.equal(
    readPatchEvent({ eventType: "match.snapshot", sequence: 1, payload: { inningsId: "i" } }),
    null,
  );
  assert.equal(
    readPatchEvent({
      eventType: "bowling.updated",
      sequence: 2,
      payload: { inningsId: "i", bowlerId: "b", end: "Far" },
    })?.kind,
    "bowling.updated",
  );
});

test("late fielding notes preserve newer independent fields and ignore duplicate updates", () => {
  const match = fixture();
  const innings = currentInnings(match);
  const deliveryId = innings.deliveries[0]!.id;
  const base = {
    kind: "delivery.tagged" as const,
    occurredAt: innings.deliveries[0]!.recordedAt,
    inningsId: innings.id,
    deliveryId,
  };
  const ledger = new Map<string, ScoringPatch>();
  rememberScoringPatch(ledger, { ...base, sequence: 9, tag: { fieldZone: "Cover" } });
  const changed = rememberScoringPatch(ledger, {
    ...base,
    sequence: 4,
    tag: { fieldZone: "Point", deliveryStyle: "Off spin" },
  });
  assert.equal(changed.length, 1);
  assert.equal(
    rememberScoringPatch(ledger, { ...base, sequence: 9, tag: { fieldZone: "Point" } }).length,
    0,
  );
  const updated = currentInnings(applyPatches(match, ledger.values())).deliveries[0]!;
  assert.equal(updated.fieldZone, "Cover");
  assert.equal(updated.deliveryStyle, "Off spin");
  assert.equal(updated.batterRuns, 2);
});

test("derived catch location survives subsequent partial fielding updates", () => {
  const match = fixture();
  const innings = currentInnings(match);
  const ball = innings.deliveries[0]!;
  ball.dismissal = { type: "caught", batterId: ball.strikerId };
  const fielderId = match.teams[1].players[1]!.id;
  const ledger = new Map<string, ScoringPatch>();
  const base = {
    kind: "delivery.tagged" as const,
    occurredAt: ball.recordedAt,
    inningsId: innings.id,
    deliveryId: ball.id,
  };
  rememberScoringPatch(ledger, {
    ...base,
    sequence: 1,
    tag: { dismissalFielderId: fielderId, fieldZone: "Point" },
  });
  rememberScoringPatch(ledger, { ...base, sequence: 2, tag: { fieldZone: "Cover" } });
  const updated = currentInnings(applyPatches(match, ledger.values())).deliveries[0]!;
  assert.equal(updated.dismissal?.fielderId, fielderId);
  assert.equal(updated.dismissal?.catchZone, "Point");
  assert.equal(updated.fieldZone, "Cover");
});

test("pending local overlays are derived from the current queue, not pinned to cloud history", () => {
  const match = fixture();
  const innings = currentInnings(match);
  const ball = innings.deliveries[0]!;
  const events = [
    {
      eventType: "delivery.tagged",
      occurredAt: ball.recordedAt,
      payload: { inningsId: innings.id, deliveryId: ball.id, tag: { fieldZone: "Cover" } },
    },
  ];
  const accepted = new Map<string, ScoringPatch>();
  rememberScoringPatch(accepted, {
    kind: "delivery.tagged",
    sequence: 1,
    occurredAt: ball.recordedAt,
    inningsId: innings.id,
    deliveryId: ball.id,
    tag: { fieldZone: "Point" },
  });
  const local = applyPatches(match, [...accepted.values(), ...pendingScoringPatches(events)]);
  assert.equal(currentInnings(local).deliveries[0]!.fieldZone, "Cover");
  const after = applyPatches(match, [...accepted.values(), ...pendingScoringPatches([])]);
  assert.equal(currentInnings(after).deliveries[0]!.fieldZone, "Point");
});

test("fielding history recovery pages past the first batch and rejects repeated cursors", async () => {
  const rows: ScoringPatch[] = Array.from({ length: scoringPatchPageSize + 1 }, (_, index) => ({
    kind: "bowling.updated",
    sequence: index + 1,
    occurredAt: "2026-11-25T10:00:00Z",
    inningsId: "innings",
    bowlerId: "bowler",
  }));
  const cursors: number[] = [];
  const loaded = await collectScoringPatches(0, async (after, limit) => {
    cursors.push(after);
    return rows.filter((row) => row.sequence > after).slice(0, limit);
  });
  assert.deepEqual(loaded, rows);
  assert.deepEqual(cursors, [0, scoringPatchPageSize]);
  await assert.rejects(
    collectScoringPatches(0, async () => rows.slice(0, scoringPatchPageSize)),
    /out of order/,
  );
});
