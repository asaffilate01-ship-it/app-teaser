import test from "node:test";
import assert from "node:assert/strict";
import { effectiveTheme } from "../src/lib/theme.ts";

test("with no saved choice the app is dark and club websites are light", () => {
  assert.equal(effectiveTheme(null, "dark", "/app"), "dark");
  assert.equal(effectiveTheme(null, "light", "/club/riverside"), "light");
});

test("a saved choice applies everywhere except big screens, overlays and camera screens", () => {
  assert.equal(effectiveTheme("light", "dark", "/platform"), "light");
  assert.equal(effectiveTheme("dark", "light", "/club/riverside"), "dark");
  for (const path of [
    "/ground/riverside",
    "/overlay/riverside",
    "/camera/room",
    "/director/room",
  ]) {
    assert.equal(effectiveTheme("light", "dark", path), "dark", path);
  }
});
