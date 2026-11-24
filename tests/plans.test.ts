import test from "node:test";
import assert from "node:assert/strict";
import {
  adRevenueSharePercent,
  canUseFeature,
  gateWhenPlanUnknown,
  planGate,
  planLocksEnforced,
  sectionFeature,
  showsAds,
} from "../src/lib/plans.ts";

test("free plan is basic scoring only, with ads", () => {
  assert.equal(canUseFeature("starter", "basicScoring"), true);
  assert.equal(canUseFeature("starter", "scoringAnalytics"), false);
  assert.equal(showsAds("starter"), true);
});

test("free plan never gets video, even with the add-on", () => {
  assert.equal(canUseFeature("starter", "video", { videoAddon: true }), false);
});

test("paid plans include full scoring analytics and still show ads", () => {
  for (const plan of ["club", "league"] as const) {
    assert.equal(canUseFeature(plan, "scoringAnalytics"), true);
    assert.equal(showsAds(plan), true);
  }
});

test("video and video analytics need the extra add-on on paid plans", () => {
  for (const plan of ["club", "league"] as const) {
    assert.equal(canUseFeature(plan, "video"), false);
    assert.equal(canUseFeature(plan, "video", { videoAddon: true }), true);
  }
});

test("free clubs get no ad revenue share", () => {
  assert.equal(adRevenueSharePercent("starter"), 0);
  assert.equal(adRevenueSharePercent("starter", { videoAddon: true }), 0);
});

test("paid clubs get 30% of ad revenue", () => {
  assert.equal(adRevenueSharePercent("club"), 30);
  assert.equal(adRevenueSharePercent("league"), 30);
});

test("paid clubs on the full system (video add-on) get 50% of ad revenue", () => {
  assert.equal(adRevenueSharePercent("club", { videoAddon: true }), 50);
  assert.equal(adRevenueSharePercent("league", { videoAddon: true }), 50);
});

test("only the League plan gets the co-branded website on the club's own domain", () => {
  assert.equal(canUseFeature("starter", "customDomain"), false);
  assert.equal(canUseFeature("club", "customDomain"), false);
  assert.equal(canUseFeature("club", "customDomain", { videoAddon: true }), false);
  assert.equal(canUseFeature("league", "customDomain"), true);
  assert.equal(canUseFeature("league", "customDomain", { videoAddon: true }), true);
});

test("free clubs see a paid-plan badge on analysis and cameras until locks are switched on at go-live", () => {
  assert.equal(planLocksEnforced, false);
  assert.equal(planGate("starter", sectionFeature["analysis"]), "badge");
  assert.equal(planGate("starter", sectionFeature["capture"]), "badge");
  assert.equal(planGate("starter", sectionFeature["office"]), "open");
});

test("once locks are on, free clubs are locked out of analysis and cameras; paid clubs need the video add-on for cameras", () => {
  assert.equal(planGate("starter", "scoringAnalytics", { enforced: true }), "locked");
  assert.equal(planGate("club", "scoringAnalytics", { enforced: true }), "open");
  assert.equal(planGate("club", "video", { enforced: true }), "locked");
  assert.equal(planGate("club", "video", { enforced: true, videoAddon: true }), "open");
  assert.equal(planGate("league", "video", { enforced: true, videoAddon: true }), "open");
});

test("unverified club entitlements do not unlock paid features when production locks are enabled", () => {
  assert.equal(gateWhenPlanUnknown("video", true), "locked");
  assert.equal(gateWhenPlanUnknown("scoringAnalytics", true), "locked");
  assert.equal(gateWhenPlanUnknown(undefined, true), "open");
  assert.equal(gateWhenPlanUnknown("video", false), "badge");
});
