import assert from "node:assert/strict";
import test from "node:test";
import {
  billingReturnMatches,
  billingReturnMessage,
  billingReturnUrl,
  readBillingOrganisation,
  readBillingReturn,
} from "../src/lib/billing-return.ts";

const org = "ab000000-0000-4000-8000-000000000001";
const other = "ab000000-0000-4000-8000-000000000002";

test("billing return links preserve the operations section and originating organisation", () => {
  for (const result of ["success", "cancelled", "portal"] as const) {
    const url = new URL(billingReturnUrl("https://criclume.com", org, result));
    assert.equal(url.origin, "https://criclume.com");
    assert.equal(url.pathname, "/platform");
    assert.equal(url.searchParams.get("section"), "operations");
    assert.equal(url.searchParams.get("billing"), result);
    assert.equal(url.searchParams.get("billingOrg"), org);
  }
});

test("invalid billing return context cannot be treated as an organisation match", () => {
  for (const value of [null, [], {}, "paid", "active", "complete"]) {
    assert.equal(readBillingReturn(value), undefined);
  }
  assert.equal(readBillingOrganisation("not-an-id"), undefined);
  assert.equal(billingReturnMatches(undefined, org), false);
  assert.equal(billingReturnMatches(other, org), false);
  assert.equal(billingReturnMatches(org, org), true);
  assert.equal(billingReturnMatches(org, org.toUpperCase()), true);
  assert.throws(() => billingReturnUrl("https://criclume.com", "invalid", "success"));
});

test("browser return outcomes never assert verified payment or entitlement activation", () => {
  assert.match(billingReturnMessage("success"), /not yet confirmed/);
  assert.match(billingReturnMessage("cancelled"), /No new payment/);
  assert.match(billingReturnMessage("portal"), /Refresh the recorded subscription/);
});
