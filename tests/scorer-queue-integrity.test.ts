import assert from "node:assert/strict";
import test from "node:test";
import { parsePendingScorerQueue } from "../src/lib/offline-queue.ts";

const matchId = "match-123";
const event = {
  matchId,
  clientEventId: "event-1",
  deviceId: "scorer-phone",
  eventType: "delivery.recorded",
  occurredAt: "2026-11-21T12:00:00Z",
  payload: {
    inningsId: "innings-1",
    matchSnapshot: { id: matchId },
    delivery: { id: "ball-1" },
  },
};

test("missing queue is empty, but an empty or corrupt stored value is not", () => {
  assert.deepEqual(parsePendingScorerQueue(null, matchId), []);
  assert.deepEqual(parsePendingScorerQueue("[]", matchId), []);
  for (const raw of ["", "{malformed", "null", "{}", "false", "0", '"empty"']) {
    assert.throws(
      () => parsePendingScorerQueue(raw, matchId),
      /original queue was preserved/i,
    );
  }
});

test("valid queued scores retain their order and unknown future fields", () => {
  const original = [
    { ...event, forwardCompatibleData: { version: 12 } },
    { ...event, clientEventId: "event-2", eventType: "match.snapshot" },
  ];
  assert.deepEqual(
    parsePendingScorerQueue(JSON.stringify(original), matchId),
    original,
  );
});

test("an unreadable, cross-match or duplicate pending event fails closed", () => {
  const corrupt = [
    [null],
    [42],
    [{ ...event, matchId: "some-other-match" }],
    [{ ...event, clientEventId: "" }],
    [{ ...event, payload: [] }],
    [{ ...event, payload: null }],
    [{ ...event, deviceId: null }],
    [{ ...event, occurredAt: 12 }],
    [{ ...event, eventType: "" }],
    [event, { ...event }],
    [event, { ...event, clientEventId: "event-2", matchId: "wrong" }],
  ];
  for (const records of corrupt) {
    assert.throws(
      () => parsePendingScorerQueue(JSON.stringify(records), matchId),
      /original queue was preserved/i,
    );
  }
});

test("validation does not alter the original queued event payload", () => {
  const original = [{ ...event }];
  const saved = JSON.stringify(original);
  const loaded = parsePendingScorerQueue(saved, matchId);
  assert.deepEqual(loaded, original);
  assert.equal(JSON.stringify(original), saved);
});
