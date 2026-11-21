import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultScorerDestination,
  scorerDestinations,
} from "../src/lib/scorer-navigation.ts";

test("scorer navigation includes all match sections in a fixed mobile-friendly order", () => {
  assert.equal(defaultScorerDestination, "score");
  assert.deepEqual(
    scorerDestinations.map((destination) => destination.id),
    ["score", "timeline", "scorecard", "analysis", "video"],
  );
  assert.equal(
    new Set(scorerDestinations.map((destination) => destination.id)).size,
    scorerDestinations.length,
  );
});

test("mobile tabs have concise visible names and distinct accessible destinations", () => {
  assert.equal(scorerDestinations.length, 5);
  for (const destination of scorerDestinations) {
    assert.ok(destination.label.length > 0);
    assert.ok(destination.mobileLabel.length > 0);
    assert.ok(destination.mobileLabel.length <= 10);
  }
  assert.equal(
    new Set(scorerDestinations.map((destination) => destination.mobileLabel)).size,
    scorerDestinations.length,
  );
});
