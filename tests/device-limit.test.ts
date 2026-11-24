import test from "node:test";
import assert from "node:assert/strict";
import {
  deviceLabel,
  deviceLimit,
  devicesToSignOut,
  shouldSignOut,
} from "../src/lib/device-limit.ts";

test("one login works on two devices at once", () => {
  assert.equal(deviceLimit, 2);
});

test("signing in on a third device signs out only the oldest", () => {
  const devices = [
    { id: "a", signedInAt: "2026-11-01T10:00:00Z" },
    { id: "b", signedInAt: "2026-11-02T10:00:00Z" },
    { id: "c", signedInAt: "2026-11-03T10:00:00Z" },
  ];
  assert.deepEqual(
    devicesToSignOut(devices).map((d) => d.id),
    ["a"],
  );
});

test("two devices or fewer: nobody is signed out", () => {
  assert.deepEqual(
    devicesToSignOut([
      { id: "a", signedInAt: "2026-11-01T10:00:00Z" },
      { id: "b", signedInAt: "2026-11-02T10:00:00Z" },
    ]),
    [],
  );
});

test("only a clear server answer signs a device out, never an offline or unknown check", () => {
  assert.equal(shouldSignOut("revoked"), true);
  assert.equal(shouldSignOut("active"), false);
  assert.equal(shouldSignOut("unknown"), false);
  assert.equal(shouldSignOut(null), false);
});

test("devices get readable names", () => {
  assert.equal(
    deviceLabel(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    ),
    "iPhone · Safari",
  );
  assert.equal(
    deviceLabel(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
    ),
    "Android phone · Chrome",
  );
});
