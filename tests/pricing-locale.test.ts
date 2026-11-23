import test from "node:test";
import assert from "node:assert/strict";
import { pricingRegionFor, regionFromLocale } from "../src/lib/pricing.ts";

test("language tags give a region code", () => {
  assert.equal(regionFromLocale("en-GB"), "GB");
  assert.equal(regionFromLocale("en_US"), "US");
  assert.equal(regionFromLocale("de-DE"), "DE");
  assert.equal(regionFromLocale("zh-Hant-TW"), "TW");
  assert.equal(regionFromLocale("fr"), null);
  assert.equal(regionFromLocale(null), null);
  assert.equal(regionFromLocale(undefined), null);
  assert.equal(regionFromLocale("es-419"), null);
});

test("a visitor in a listed country sees that country's prices by default", () => {
  assert.equal(pricingRegionFor("PK").currency, "PKR");
  assert.equal(pricingRegionFor("IN").currency, "INR");
  assert.equal(pricingRegionFor("AU").currency, "AUD");
  assert.equal(pricingRegionFor("FR").currency, "EUR");
});

test("a visitor in a country not on the list sees GBP", () => {
  assert.equal(pricingRegionFor("BR").currency, "GBP");
  assert.equal(pricingRegionFor("JP", ["en-PK"]).currency, "GBP");
});

test("the visitor's real country wins over their browser language", () => {
  assert.equal(pricingRegionFor("PK", ["en-US"]).currency, "PKR");
});

test("with no country known, the browser language is used, else GBP", () => {
  assert.equal(pricingRegionFor(null, ["en-ZA"]).currency, "ZAR");
  assert.equal(pricingRegionFor(null, ["pt-BR"]).currency, "GBP");
  assert.equal(pricingRegionFor(null, []).currency, "GBP");
});
