import test from "node:test";
import assert from "node:assert/strict";
import { battingCrease, scorerWagonEvidence, wagonWheelShots } from "../src/lib/wagon-wheel.ts";
import { createMatch, currentInnings, recordDelivery } from "../src/lib/cricket.ts";
function fixture() {
  let match = createMatch({
    homeTeamName: "A",
    awayTeamName: "B",
    homePlayers: ["A1", "A2", "A3"],
    awayPlayers: ["B1", "B2", "B3"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: 20,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "Test",
      weather: "Dry",
      startTime: "2026-10-30T10:00:00Z",
    },
  });
  for (const [zone, runs] of [
    ["Cover", 4],
    ["Fine leg", 6],
    ["Not recorded", 0],
  ] as const) {
    const i = currentInnings(match);
    match = recordDelivery(match, {
      strikerId: i.strikerId,
      nonStrikerId: i.nonStrikerId,
      bowlerId: i.bowlerId,
      end: i.end,
      deliveryStyle: "Medium",
      outcome: "hit",
      batterRuns: runs,
      fieldZone: zone,
    });
  }
  return match;
}
test("scorer deliveries map to real zones and outcome colors; missing locations are not invented", () => {
  const rows = scorerWagonEvidence(currentInnings(fixture()));
  const shots = wagonWheelShots(rows, "batting");
  assert.equal(shots.length, 2);
  assert.equal(shots[0]!.zone, "Cover");
  assert.equal(shots[0]!.x, 29);
  assert.equal(shots[0]!.color, "#fbbf24");
  assert.equal(shots[1]!.color, "#c084fc");
  assert.deepEqual(battingCrease, { x: 0, z: 8.5 });
  assert.equal(rows[0]!.batter_runs, 4);
});
test("voided and superseded shots are excluded; duplicate evidence is not double counted", () => {
  const r = scorerWagonEvidence(currentInnings(fixture()))[0]!;
  assert.equal(
    wagonWheelShots(
      [
        r,
        r,
        { ...r, id: "old", superseded_by: "new" },
        { ...r, id: "void", voided_by_event_id: "x" },
      ],
      "batting",
    ).length,
    1,
  );
});
test("fielding maps are explicitly points in the recorded fielding zone", () => {
  const r = scorerWagonEvidence(currentInnings(fixture()))[0]!;
  const shot = wagonWheelShots([{ ...r, fielding_zone: "Point", wicket: true }], "fielding")[0]!;
  assert.equal(shot.fielding, true);
  assert.equal(shot.x, 34);
  assert.equal(shot.zone, "Point");
  assert.equal(shot.color, "#fb7185");
});
