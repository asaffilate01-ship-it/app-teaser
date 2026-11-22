import assert from "node:assert/strict";
import test from "node:test";
import { lastFielderInZone, orderFielders, outcomeAfterZone } from "../src/lib/shot-entry.ts";

const balls = [
  { fieldZone: "Cover" as const, fielderId: "a" },
  { fieldZone: "Point" as const, fielderId: "b" },
  { fieldZone: "Cover" as const, fielderId: "c" },
  { fieldZone: "Long on" as const },
];

test("suggests the fielder who last stopped a ball in that area", () => {
  assert.equal(lastFielderInZone(balls, "Cover"), "c");
  assert.equal(lastFielderInZone(balls, "Long on"), undefined);
  assert.equal(lastFielderInZone(balls, "Not recorded"), undefined);
});

test("orders fielders: last in area, then recent fielders, then the rest", () => {
  assert.deepEqual(orderFielders(["a", "b", "c", "d"], balls, "Point"), ["b", "c", "a", "d"]);
});

test("choosing a field area turns 'left' or 'missed' into a hit", () => {
  assert.equal(outcomeAfterZone("Cover", "left"), "hit-no-run");
  assert.equal(outcomeAfterZone("Cover", "missed"), "hit-no-run");
  assert.equal(outcomeAfterZone("Cover", "hit"), "hit");
  assert.equal(outcomeAfterZone("Not recorded", "left"), "left");
});
