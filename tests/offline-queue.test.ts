import assert from "node:assert/strict";
import test from "node:test";
import { reconcilePendingEvents } from "../src/lib/offline-queue.ts";

test("replay reconciliation does not drop deliveries added during an upload", () => {
  const beforeReplay = [
    { clientEventId: "ball-1", number: 1 },
    { clientEventId: "ball-2", number: 2 },
  ];
  const afterConcurrentScore = [
    ...beforeReplay,
    { clientEventId: "ball-3", number: 3 },
  ];

  const remaining = reconcilePendingEvents(afterConcurrentScore, new Set(["ball-1"]));
  assert.deepEqual(
    remaining.map((event) => event.clientEventId),
    ["ball-2", "ball-3"],
  );
  assert.deepEqual(
    afterConcurrentScore.map((event) => event.clientEventId),
    ["ball-1", "ball-2", "ball-3"],
  );
});

test("only acknowledged events are removed and failed events remain ordered", () => {
  const queued = [
    { clientEventId: "first" },
    { clientEventId: "second" },
    { clientEventId: "third" },
  ];
  assert.deepEqual(
    reconcilePendingEvents(queued, new Set(["first"])),
    [queued[1], queued[2]],
  );
  assert.deepEqual(reconcilePendingEvents(queued, new Set()), queued);
  assert.deepEqual(
    reconcilePendingEvents(queued, new Set(["first", "second", "third"])),
    [],
  );
});
