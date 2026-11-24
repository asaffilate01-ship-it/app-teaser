import assert from "node:assert/strict";
import test from "node:test";
import { generateRoundRobinFixtures } from "../src/lib/platform.ts";
import { approvedProjectRef, evaluateReleaseEvidence } from "../src/lib/release-readiness.ts";

const teams = ["a", "b", "c", "d"].map((id) => ({ id, homeGroundId: "g1" }));
const slots = [
  { id: "s1", startsAt: "2027-05-01T13:00:00Z", availableGroundIds: ["g1", "g2"] },
];

test("a shared preferred ground does not prevent use of an available alternative", () => {
  const fixtures = generateRoundRobinFixtures(teams, slots);
  const scheduled = fixtures.filter((fixture) => fixture.slotId === "s1");
  assert.equal(scheduled.length, 2);
  assert.equal(new Set(scheduled.map((fixture) => fixture.groundId)).size, 2);
});

test("teams cannot play simultaneously, even when many grounds are free", () => {
  const fixtures = generateRoundRobinFixtures(teams, [
    { ...slots[0]!, availableGroundIds: ["g1", "g2", "g3", "g4", "g5", "g6"] },
  ]);
  const scheduled = fixtures.filter((fixture) => fixture.slotId === "s1");
  const participants = scheduled.flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]);
  assert.equal(scheduled.length, 2);
  assert.equal(new Set(participants).size, participants.length);
  assert.ok(fixtures.filter((fixture) => !fixture.slotId).every((fixture) => fixture.conflicts.length));
});

test("malformed release SHA is rejected without crashing the evidence evaluator", () => {
  const malformed = {
    projectRef: approvedProjectRef,
    releaseSha: null as unknown as string,
    checks: {},
  };
  assert.equal(evaluateReleaseEvidence(malformed, "p0", "a".repeat(40), Date.now()).approved, false);
});
