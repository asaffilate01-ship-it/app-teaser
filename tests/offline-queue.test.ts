import assert from "node:assert/strict";
import test from "node:test";
import { reconcilePendingEvents } from "../src/lib/offline-queue.ts";

test("replay reconciliation does not drop deliveries added during an upload", () => {
  const beforeReplay = [
    { clientEventId: "ball-1", number: 1 },
    { clientEventId: "ball-2", number: 2 },
  ];
  const afterConcurrentScore = [...beforeReplay, { clientEventId: "ball-3", number: 3 }];

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
  assert.deepEqual(reconcilePendingEvents(queued, new Set(["first"])), [queued[1], queued[2]]);
  assert.deepEqual(reconcilePendingEvents(queued, new Set()), queued);
  assert.deepEqual(reconcilePendingEvents(queued, new Set(["first", "second", "third"])), []);
});

import { createOrderedQueueDrainer } from "../src/lib/offline-queue.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("concurrent reconnects share one replay and drain new scores behind older events", async () => {
  let queue = [{ clientEventId: "offline" }];
  const gate = deferred();
  const started = deferred();
  const calls: string[] = [];
  const drain = createOrderedQueueDrainer({
    read: () => queue,
    write: (_match, next) => {
      queue = next;
    },
    send: async (event) => {
      calls.push(event.clientEventId);
      if (event.clientEventId === "offline") {
        started.resolve();
        await gate.promise;
      }
      return { sequence: calls.length };
    },
  });
  const first = drain("match");
  await started.promise;
  queue.push({ clientEventId: "new-score" });
  const reconnect = drain("match");
  assert.equal(first, reconnect);
  assert.deepEqual(calls, ["offline"]);
  gate.resolve();
  assert.deepEqual(await first, { sent: 2, remaining: 0, lastSequence: 2 });
  assert.deepEqual(calls, ["offline", "new-score"]);
  assert.deepEqual(queue, []);
});

test("failed delivery blocks newer scores and retries with the same event identity", async () => {
  let queue = [{ clientEventId: "first" }, { clientEventId: "second" }];
  let fail = true;
  const calls: string[] = [];
  const drain = createOrderedQueueDrainer({
    read: () => queue,
    write: (_match, next) => {
      queue = next;
    },
    send: async (event) => {
      calls.push(event.clientEventId);
      if (fail) throw new Error("offline");
      return { sequence: calls.length };
    },
  });
  assert.deepEqual(await drain("match"), { sent: 0, remaining: 2, lastSequence: 0 });
  queue.push({ clientEventId: "third" });
  assert.equal((await drain("match")).remaining, 3);
  assert.deepEqual(calls, ["first", "first"]);
  fail = false;
  assert.equal((await drain("match")).remaining, 0);
  assert.deepEqual(calls, ["first", "first", "first", "second", "third"]);
});

test("acknowledgement storage failure stops replay without discarding pending identities", async () => {
  let queue = [{ clientEventId: "first" }, { clientEventId: "second" }];
  let fail = true;
  const calls: string[] = [];
  const drain = createOrderedQueueDrainer({
    read: () => queue,
    write: (_match, next) => {
      if (fail) throw new Error("quota");
      queue = next;
    },
    send: async (event) => {
      calls.push(event.clientEventId);
      return { sequence: 1 };
    },
  });
  await assert.rejects(drain("match"), /quota/);
  assert.deepEqual(calls, ["first"]);
  assert.equal(queue.length, 2);
  fail = false;
  await drain("match");
  assert.deepEqual(calls, ["first", "first", "second"]);
});

test("separate matches drain independently and an empty drain releases its slot", async () => {
  const queues = new Map([
    ["a", [{ clientEventId: "a1" }]],
    ["b", [{ clientEventId: "b1" }]],
  ]);
  const gate = deferred();
  const drain = createOrderedQueueDrainer({
    read: (match) => queues.get(match) ?? [],
    write: (match, next) => {
      queues.set(match, next);
    },
    send: async (event) => {
      if (event.clientEventId === "a1") await gate.promise;
      return { sequence: 1 };
    },
  });
  const a = drain("a");
  assert.equal((await drain("b")).sent, 1);
  assert.equal((await drain("b")).sent, 0);
  queues.set("b", [{ clientEventId: "b2" }]);
  assert.equal((await drain("b")).sent, 1);
  gate.resolve();
  assert.equal((await a).sent, 1);
});
