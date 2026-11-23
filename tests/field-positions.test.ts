import assert from "node:assert/strict";
import test from "node:test";
import { allFieldZones, closeCatchers, ringSectors, zoneArea, zoneInfo } from "../src/lib/field-positions.ts";
import { recentZones, lastFielderInZone } from "../src/lib/shot-entry.ts";
import { wagonWheel } from "../src/lib/match-insights.ts";

test("offers inside-the-ring, deep and close-catcher positions", () => {
  assert.equal(ringSectors.length * 2, 22);
  assert.equal(closeCatchers.length, 15);
  for (const name of ["Third man", "Deep mid-wicket", "Extra cover", "Gully", "First slip", "Second slip", "Third slip", "Fourth slip", "Fly slip", "Silly point", "Silly mid-off", "Silly mid-on", "Short leg", "Backward short leg", "Leg slip", "Leg gully", "Short mid-wicket", "Short extra cover", "Keeper", "Bowler"]) {
    assert.ok(allFieldZones.includes(name as never), name);
  }
});

test("ring slices cover the whole ground without gaps", () => {
  let previous = 0;
  for (const sector of ringSectors) {
    assert.equal(sector.start, previous);
    previous = sector.end;
  }
  assert.equal(previous, 360);
});

test("specific positions roll up into the broad wagon-wheel areas", () => {
  assert.equal(zoneArea("Third man"), "Third");
  assert.equal(zoneArea("Second slip"), "Third");
  assert.equal(zoneArea("Gully"), "Third");
  assert.equal(zoneArea("Leg gully"), "Fine leg");
  assert.equal(zoneInfo("Silly mid-on")?.side, "leg");
  assert.equal(zoneInfo("Fly slip")?.depth, "close");
  assert.equal(zoneArea("Deep extra cover"), "Cover");
  assert.equal(zoneArea("Deep backward square"), "Square leg");
  assert.equal(zoneArea("deep  mid-wicket"), "Mid-wicket");
  assert.equal(zoneArea("Cover"), "Cover");
  assert.equal(zoneInfo("Deep point")?.depth, "deep");
  assert.equal(zoneInfo("Mid-off")?.side, "off");
  assert.equal(zoneArea("Somewhere"), undefined);
});

test("wagon wheel counts runs to a specific position in its area", () => {
  const wheel = wagonWheel([
    { fieldZone: "Deep extra cover", batterRuns: 4 },
    { fieldZone: "Cover", batterRuns: 2 },
    { fieldZone: "Keeper", batterRuns: 1 },
  ] as never);
  assert.equal(wheel.zones.find((zone) => zone.zone === "Cover")?.runs, 6);
  assert.equal(wheel.unplacedRuns, 1);
});

test("suggests the last fielder in the same area when the exact position is new", () => {
  const balls = [{ fieldZone: "Cover" as const, fielderId: "a" }];
  assert.equal(lastFielderInZone(balls, "Extra cover"), "a");
  assert.equal(lastFielderInZone(balls, "Point"), undefined);
});

test("recent positions are newest first without repeats", () => {
  const balls = [
    { fieldZone: "Cover" as const },
    { fieldZone: "Gully" as const },
    { fieldZone: "Not recorded" as const },
    { fieldZone: "Cover" as const },
  ];
  assert.deepEqual(recentZones(balls), ["Cover", "Gully"]);
});
