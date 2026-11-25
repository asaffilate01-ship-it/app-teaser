import assert from "node:assert/strict";
import test from "node:test";
import { verifiedBillingRedirect } from "../src/lib/billing-redirect.ts";
import { gateWhenPlanUnknown, parsePlanAccess } from "../src/lib/plans.ts";

test("malformed entitlement responses are not verified plans", () => {
  for (const value of [
    null,
    [],
    {},
    { plan: "unknown", videoAddon: true },
    { plan: "club", videoAddon: "true" },
    { plan: "league" },
  ]) {
    assert.equal(parsePlanAccess(value), null);
  }
});

test("verified plan access does not grant video to a starter club", () => {
  assert.deepEqual(parsePlanAccess({ plan: "starter", videoAddon: true }), {
    plan: "starter",
    videoAddon: false,
  });
  assert.deepEqual(parsePlanAccess({ plan: "club", videoAddon: true }), {
    plan: "club",
    videoAddon: true,
  });
  assert.equal(gateWhenPlanUnknown("basicScoring", true), "open");
  assert.equal(gateWhenPlanUnknown("video", true), "locked");
});

test("billing redirects accept only their expected HTTPS provider host", () => {
  assert.equal(
    verifiedBillingRedirect("https://checkout.stripe.com/c/pay/test", "checkout"),
    "https://checkout.stripe.com/c/pay/test",
  );
  assert.equal(
    verifiedBillingRedirect("https://billing.stripe.com/p/session/test", "portal"),
    "https://billing.stripe.com/p/session/test",
  );
  for (const url of [
    "http://checkout.stripe.com/",
    "https://checkout.stripe.com.example.com/",
    "https://checkout.stripe.com@evil.example/",
    "https://user:pass@checkout.stripe.com/",
    "https://checkout.stripe.com:444/",
    "javascript:alert(1)",
    "https://billing.stripe.com/",
    "/checkout",
    null,
  ]) {
    assert.throws(() => verifiedBillingRedirect(url, "checkout"), /Invalid billing redirect/);
  }
});
