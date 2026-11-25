import assert from "node:assert/strict";
import test from "node:test";
import { pakistanSubscriptionEstimate } from "../src/lib/subscription-estimate.ts";
import { pakistanClubFee, pakistanLeagueFee } from "../src/lib/pricing.ts";

test("Pakistan club estimate itemises base and video fees at published annual rates", () => {
  const quote = pakistanSubscriptionEstimate("club", "3", true);
  assert.ok(quote);
  assert.equal(quote.total, 150000);
  assert.equal(quote.currency, "PKR");
  assert.equal(quote.period, "year");
  assert.deepEqual(
    quote.lines.map((line) => line.amount),
    [75000, 75000],
  );
});

test("Pakistan league bands apply only to the teams in each band", () => {
  const quote = pakistanSubscriptionEstimate("league", "25", true);
  assert.ok(quote);
  assert.deepEqual(
    quote.lines.map((line) => [line.teams, line.rate, line.amount]),
    [
      [10, 20000, 200000],
      [10, 17500, 175000],
      [5, 15000, 75000],
      [25, 20000, 500000],
    ],
  );
  assert.equal(quote.total, 950000);
});

test("itemised estimates match published pricing at every tier boundary", () => {
  for (const count of [1, 9, 10, 11, 19, 20, 21, 100, 10000]) {
    for (const video of [false, true]) {
      assert.equal(
        pakistanSubscriptionEstimate("club", String(count), video)?.total,
        pakistanClubFee(count, { video }),
      );
      assert.equal(
        pakistanSubscriptionEstimate("league", String(count), video)?.total,
        pakistanLeagueFee(count, { video }),
      );
    }
  }
});

test("invalid team counts cannot produce a subscription estimate", () => {
  for (const count of ["", "0", "-1", "2.5", "1e2", "NaN", "Infinity", "10001"]) {
    assert.equal(pakistanSubscriptionEstimate("league", count, false), null);
  }
});
