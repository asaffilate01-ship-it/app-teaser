import assert from "node:assert/strict";
import test from "node:test";
import { retryDelayMs, syncChipLabel } from "../src/lib/sync-retry.ts";

test("automatic resend waits 3s, doubling, never more than a minute", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 20].map(retryDelayMs), [3000, 6000, 12000, 24000, 48000, 60000, 60000, 60000]);
  assert.equal(retryDelayMs(-1), 3000);
});

test("sync chip says plainly what is saved and what is waiting", () => {
  assert.equal(syncChipLabel({ status: "offline", pending: 7, online: false }), "Offline · saved on phone · 7 changes to send");
  assert.equal(syncChipLabel({ status: "synced", pending: 0, online: true }), "All sent");
  assert.equal(syncChipLabel({ status: "synced", pending: 1, online: true }), "Sending · 1 change to send");
  assert.equal(syncChipLabel({ status: "error", pending: 2, online: true }), "Retrying · 2 changes to send");
});
