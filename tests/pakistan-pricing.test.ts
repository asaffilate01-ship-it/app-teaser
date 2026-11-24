import test from "node:test";
import assert from "node:assert/strict";
import { findRegion, pakistanClubFee, pakistanLeagueFee } from "../src/lib/pricing.ts";

test("Pakistan club plan is ₨25,000 per team per year, ₨50,000 with video", () => {
  assert.equal(pakistanClubFee(1), 25_000);
  assert.equal(pakistanClubFee(1, { video: true }), 50_000);
  assert.equal(pakistanClubFee(3), 75_000);
});

test("Pakistan leagues of up to 10 teams pay ₨20,000 per team", () => {
  assert.equal(pakistanLeagueFee(10), 200_000);
});

test("Pakistan league teams 11–20 are ₨17,500 each, only on those teams", () => {
  assert.equal(pakistanLeagueFee(15), 10 * 20_000 + 5 * 17_500);
});

test("Pakistan league teams 21+ are ₨15,000 each", () => {
  assert.equal(pakistanLeagueFee(25), 10 * 20_000 + 10 * 17_500 + 5 * 15_000);
});

test("Pakistan league video (full system) adds ₨20,000 per team", () => {
  assert.equal(pakistanLeagueFee(10, { video: true }), 200_000 + 10 * 20_000);
});

test("Pakistan price list shows the yearly prices", () => {
  const pk = findRegion("PK");
  assert.ok(pk);
  assert.equal(pk.clubPrice, "₨25,000");
  assert.equal(pk.period, "per team / year");
  assert.equal(pk.addonPrice, "₨25,000");
  assert.equal(
    findRegion("GB")?.addonPrice,
    undefined,
    "outside Pakistan the add-on stays quoted per club",
  );
});
