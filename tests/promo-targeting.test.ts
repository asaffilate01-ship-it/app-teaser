import test from "node:test";
import assert from "node:assert/strict";
import { buildRotation, choosePromos, matchesTarget, parsePlaceList, readVisitorPlace, type VisitorPlace } from "../src/lib/promo-targeting.ts";

const lahore: VisitorPlace = { country: "PK", region: "Punjab", regionCode: "PB", city: "Lahore" };
const none = { countries: [], regions: [], cities: [] };

test("an ad with no places runs everywhere, even when the place is unknown", () => {
  assert.equal(matchesTarget(none, lahore), true);
  assert.equal(matchesTarget(none, { country: null, region: null, regionCode: null, city: null }), true);
});

test("country-targeted ads only reach that country", () => {
  assert.equal(matchesTarget({ ...none, countries: ["PK"] }, lahore), true);
  assert.equal(matchesTarget({ ...none, countries: ["AE"] }, lahore), false);
  assert.equal(matchesTarget({ ...none, countries: ["PK"] }, { country: null, region: null, regionCode: null, city: null }), false);
});

test("city and region targeting ignores case, spacing and accents", () => {
  assert.equal(matchesTarget({ ...none, cities: [" lahore "] }, lahore), true);
  assert.equal(matchesTarget({ ...none, cities: ["Láhore"] }, lahore), true);
  assert.equal(matchesTarget({ ...none, cities: ["Karachi"] }, lahore), false);
  assert.equal(matchesTarget({ ...none, regions: ["PB"] }, lahore), true);
  assert.equal(matchesTarget({ ...none, regions: ["Sindh"] }, lahore), false);
});

test("local ads come first in the rotation", () => {
  const ads = [
    { id: "global", slot: "top" as const, weight: 1, ...none },
    { id: "city", slot: "top" as const, weight: 1, ...none, cities: ["Lahore"] },
    { id: "elsewhere", slot: "top" as const, weight: 5, ...none, cities: ["Dubai"] },
    { id: "side", slot: "side" as const, weight: 1, ...none },
  ];
  const chosen = choosePromos(ads, lahore);
  assert.deepEqual(chosen.top.map((ad) => ad.id), ["city", "global"]);
  assert.deepEqual(chosen.side.map((ad) => ad.id), ["side"]);
});

test("an ad with weight 3 shows three times as often as weight 1, spread out", () => {
  const order = buildRotation([
    { id: "a", weight: 3 },
    { id: "b", weight: 1 },
  ]).map((item) => item.id);
  assert.equal(order.filter((id) => id === "a").length, 3);
  assert.equal(order.filter((id) => id === "b").length, 1);
  assert.equal(order.length, 4);
});

test("place lists drop blanks, repeats and bad country codes", () => {
  assert.deepEqual(parsePlaceList("Lahore, lahore; Karachi,,"), ["Lahore", "Karachi"]);
  assert.deepEqual(parsePlaceList("pk, AE, Pakistan", { countryCodes: true }), ["PK", "AE"]);
});

test("visitor place comes from the edge network and ignores unknown countries", () => {
  const headers: Record<string, string> = { "cf-ipcountry": "XX" };
  assert.equal(readVisitorPlace((name) => headers[name]).country, null);
  const place = readVisitorPlace(() => null, { country: "pk", region: "Punjab", regionCode: "PB", city: "Lahore" });
  assert.deepEqual(place, lahore);
});
