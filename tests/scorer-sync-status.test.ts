import assert from "node:assert/strict";
import test from "node:test";
import { describeScorerSyncRecovery } from "../src/lib/scorer-sync-status.ts";

test("offline scoring stays visible and never suggests sending while offline", () => {
  const message = describeScorerSyncRecovery("offline", 3);
  assert.equal(message.show, true);
  assert.equal(message.canRetry, false);
  assert.match(message.detail, /3 scoring changes waiting to sync/);
});

test("queued changes display their actual count and enable manual retry", () => {
  const message = describeScorerSyncRecovery("queued", 1);
  assert.equal(message.canRetry, true);
  assert.match(message.detail, /1 scoring change not yet confirmed/);
});

test("cloud errors without a persisted queue never claim a score is uploaded", () => {
  const message = describeScorerSyncRecovery("error", 0);
  assert.equal(message.show, true);
  assert.equal(message.canRetry, false);
  assert.match(message.detail, /could not be verified/);
});

test("unconfirmed local events override a stale synced status", () => {
  const message = describeScorerSyncRecovery("synced", 2);
  assert.equal(message.show, true);
  assert.equal(message.canRetry, true);
});

test("scorer conflicts are not resolved by retrying queued events", () => {
  const message = describeScorerSyncRecovery("conflict", 10);
  assert.equal(message.show, false);
  assert.equal(message.canRetry, false);
});

test("invalid event counts cannot produce misleading negative or infinite claims", () => {
  assert.equal(describeScorerSyncRecovery("queued", -1).canRetry, false);
  assert.equal(describeScorerSyncRecovery("queued", Number.POSITIVE_INFINITY).canRetry, false);
  assert.equal(describeScorerSyncRecovery("local", 0).show, false);
});

test("unreadable saved queues block retry and clearly explain preservation", () => {
  const message = describeScorerSyncRecovery("error", 0, true);
  assert.equal(message.show, true);
  assert.equal(message.canRetry, false);
  assert.match(message.title, /needs recovery/);
  assert.match(message.detail, /No|not cleared/i);
  assert.match(message.detail, /backup/);
  assert.equal(describeScorerSyncRecovery("synced", 0, true).canRetry, false);
});

test("an empty offline queue is not evidence that the cloud has the latest score", () => {
  const message = describeScorerSyncRecovery("offline", 0);
  assert.equal(message.show, true);
  assert.equal(message.canRetry, false);
  assert.match(message.detail, /Cloud status cannot be verified offline/);
  assert.doesNotMatch(message.detail, /reached the cloud/);
});
