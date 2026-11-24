import assert from "node:assert/strict";
import test from "node:test";
import {
  hashShareToken,
  newShareToken,
  shareExpiry,
  shareLink,
} from "../src/lib/scouting-share.ts";

test("share tokens are long, random and stored only as a 64-character hash", async () => {
  const a = newShareToken();
  const b = newShareToken();
  assert.notEqual(a, b);
  assert.equal(a.length, 43);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  const hash = await hashShareToken(a);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(
    await hashShareToken("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("shared links expire after at most 180 days", () => {
  const now = new Date("2027-01-01T00:00:00Z");
  assert.equal(shareExpiry(30, now), "2027-01-31T00:00:00.000Z");
  assert.equal(shareExpiry(999, now), "2027-06-30T00:00:00.000Z");
  assert.equal(shareLink("https://criclume.com/", "tok"), "https://criclume.com/scout/tok");
});
