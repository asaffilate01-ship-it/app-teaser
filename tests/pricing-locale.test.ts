import test from "node:test";
import assert from "node:assert/strict";
import { regionFromLocale } from "../src/lib/pricing.ts";

test("pricing region uses language subtags, not IP-based geolocation", () => {
  assert.equal(regionFromLocale("en-GB"), "GB");
  assert.equal(regionFromLocale("en_US"), "US");
  assert.equal(regionFromLocale("de-DE"), "DE");
  assert.equal(regionFromLocale("zh-Hant-TW"), "TW");
  assert.equal(regionFromLocale("fr"), null);
  assert.equal(regionFromLocale(null), null);
  assert.equal(regionFromLocale(undefined), null);
  assert.equal(regionFromLocale("es-419"), null);
});
