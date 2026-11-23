import test from "node:test";
import assert from "node:assert/strict";
import { canUseFeature, showsAds } from "../src/lib/plans.ts";

test("free plan is basic scoring only, with ads", () => {
  assert.equal(canUseFeature("starter", "basicScoring"), true);
  assert.equal(canUseFeature("starter", "scoringAnalytics"), false);
  assert.equal(showsAds("starter"), true);
});

test("free plan never gets video, even with the add-on", () => {
  assert.equal(canUseFeature("starter", "video", { videoAddon: true }), false);
});

test("paid plans include full scoring analytics and no ads", () => {
  for (const plan of ["club", "league"] as const) {
    assert.equal(canUseFeature(plan, "scoringAnalytics"), true);
    assert.equal(showsAds(plan), false);
  }
});

test("video and video analytics need the extra add-on on paid plans", () => {
  for (const plan of ["club", "league"] as const) {
    assert.equal(canUseFeature(plan, "video"), false);
    assert.equal(canUseFeature(plan, "video", { videoAddon: true }), true);
  }
});
