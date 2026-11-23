import assert from "node:assert/strict";
import test from "node:test";
import { installMode, installSnoozed } from "../src/lib/install-app.ts";

const iphoneSafari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const iphoneChrome = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0 Mobile/15E148 Safari/604.1";
const ipad = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

test("already installed shows nothing else", () => {
  assert.equal(installMode({ userAgent: iphoneSafari, standalone: true, canPrompt: false }), "installed");
});
test("Android / desktop Chrome use the browser's install prompt", () => {
  assert.equal(installMode({ userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/123", standalone: false, canPrompt: true }), "prompt");
});
test("iPhone Safari gets Add to Home Screen steps; iPhone Chrome is pointed to Safari", () => {
  assert.equal(installMode({ userAgent: iphoneSafari, standalone: false, canPrompt: false }), "ios-safari");
  assert.equal(installMode({ userAgent: iphoneChrome, standalone: false, canPrompt: false }), "ios-other");
});
test("iPad (reports as Mac) is detected by touch support", () => {
  assert.equal(installMode({ userAgent: ipad, standalone: false, canPrompt: false, maxTouchPoints: 5 }), "ios-safari");
  assert.equal(installMode({ userAgent: ipad, standalone: false, canPrompt: false, maxTouchPoints: 0 }), "none");
});
test("dismissing hides the offer for 30 days", () => {
  const now = Date.parse("2027-01-31T00:00:00Z");
  assert.equal(installSnoozed("2027-01-02T00:00:00Z", now), true);
  assert.equal(installSnoozed("2026-12-31T00:00:00Z", now), false);
  assert.equal(installSnoozed(null, now), false);
});
