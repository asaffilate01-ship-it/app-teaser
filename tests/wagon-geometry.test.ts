import test from "node:test";
import assert from "node:assert/strict";
import {
  matchesFilter,
  plotShot,
  summarizeWheel,
  type WheelBall,
} from "../src/lib/wagon-geometry.ts";

const ball = (over: Partial<WheelBall>): WheelBall => ({
  id: "b1",
  over: 0,
  ball: 1,
  strikerId: "s",
  bowlerId: "b",
  batterRuns: 1,
  fieldZone: "Cover",
  wicket: false,
  ...over,
});

test("off-side shots for a right-hander are drawn on the right, leg side on the left", () => {
  assert.ok(plotShot(ball({ fieldZone: "Deep cover" }))!.x > 0);
  assert.ok(plotShot(ball({ fieldZone: "Deep mid-wicket" }))!.x < 0);
});
test("left-hander view mirrors the shot", () => {
  const rh = plotShot(ball({ fieldZone: "Deep cover" }))!;
  const lh = plotShot(ball({ fieldZone: "Deep cover" }), true)!;
  assert.ok(Math.abs(rh.x + lh.x) < 0.001 && Math.abs(rh.y - lh.y) < 0.001);
});
test("straight shots go up the screen, keeper shots go down", () => {
  assert.ok(plotShot(ball({ fieldZone: "Long straight", batterRuns: 4 }))!.y < -0.9);
  assert.ok(plotShot(ball({ fieldZone: "Fine leg", batterRuns: 4 }))!.y > 0.8);
});
test("fours reach the rope and sixes clear it", () => {
  assert.ok(plotShot(ball({ batterRuns: 4 }))!.length >= 0.95);
  assert.ok(plotShot(ball({ batterRuns: 6 }))!.length > 1.05);
  assert.ok(plotShot(ball({ batterRuns: 1, fieldZone: "Cover" }))!.length < 0.6);
});
test("the same ball is always drawn in the same spot", () => {
  assert.deepEqual(plotShot(ball({ id: "x9" })), plotShot(ball({ id: "x9" })));
});
test("unrecorded positions are not drawn", () => {
  assert.equal(plotShot(ball({ fieldZone: "Not recorded" })), null);
});
test("filters: all = scoring shots and wickets; 3s include 5s", () => {
  assert.equal(matchesFilter(ball({ batterRuns: 0 }), "all"), false);
  assert.equal(matchesFilter(ball({ batterRuns: 0, wicket: true }), "all"), true);
  assert.equal(matchesFilter(ball({ batterRuns: 5 }), "3"), true);
});
test("summary splits runs by side and counts unplaced runs", () => {
  const s = summarizeWheel([
    ball({ id: "a", fieldZone: "Cover", batterRuns: 4 }),
    ball({ id: "b", fieldZone: "Square leg", batterRuns: 2 }),
    ball({ id: "c", fieldZone: "Not recorded", batterRuns: 1 }),
    ball({ id: "d", batterRuns: 0 }),
  ]);
  assert.equal(s.offRuns, 4);
  assert.equal(s.legRuns, 2);
  assert.equal(s.unplacedRuns, 1);
  assert.equal(s.fours, 1);
  assert.equal(s.dots, 1);
  assert.equal(s.areas[0]!.area, "Cover");
});
