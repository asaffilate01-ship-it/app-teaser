import test from "node:test";
import assert from "node:assert/strict";
import { periodRange, totalsByCurrency } from "../src/lib/promo-earnings.ts";

test("periods cover whole months and the whole year", () => {
  const now = new Date(Date.UTC(2026, 10, 23));
  assert.deepEqual(periodRange("month", now), { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(periodRange("lastMonth", now), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(periodRange("year", now), { from: "2026-01-01", to: "2026-12-31" });
});

test("earnings in different currencies are never added together", () => {
  const rows = [
    {
      campaign_id: "1",
      advertiser: "A",
      campaign_name: "x",
      currency: "PKR",
      club_plays: 100,
      share_percent: 30,
      estimated_earnings: 1500,
    },
    {
      campaign_id: "2",
      advertiser: "B",
      campaign_name: "y",
      currency: "PKR",
      club_plays: 50,
      share_percent: 30,
      estimated_earnings: 750.5,
    },
    {
      campaign_id: "3",
      advertiser: "C",
      campaign_name: "z",
      currency: "GBP",
      club_plays: 10,
      share_percent: 50,
      estimated_earnings: 12,
    },
  ];
  assert.deepEqual(totalsByCurrency(rows), [
    { currency: "PKR", amount: 2250.5, plays: 150 },
    { currency: "GBP", amount: 12, plays: 10 },
  ]);
});
