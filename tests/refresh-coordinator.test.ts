import assert from "node:assert/strict";
import test from "node:test";
import { createRefreshCoordinator } from "../src/lib/refresh-coordinator.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("refresh bursts share a single in-flight request and one follow-up", async () => {
  const first = deferred();
  const second = deferred();
  let calls = 0;
  const coordinator = createRefreshCoordinator(async () => {
    calls += 1;
    await (calls === 1 ? first.promise : second.promise);
  });
  const result = coordinator.request();
  await Promise.resolve();
  assert.equal(calls, 1);
  for (let i = 0; i < 50; i += 1) assert.equal(coordinator.request(), result);
  first.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls, 2);
  second.resolve();
  await result;
  assert.equal(calls, 2);
});

test("disposal drops pending work without starting another tenant request", async () => {
  const first = deferred();
  let calls = 0;
  const coordinator = createRefreshCoordinator(async () => {
    calls += 1;
    await first.promise;
  });
  const result = coordinator.request();
  await Promise.resolve();
  void coordinator.request();
  coordinator.dispose();
  first.resolve();
  await result;
  await coordinator.request();
  assert.equal(coordinator.isActive(), false);
  assert.equal(calls, 1);
});

test("a disposed coordinator does not start a queued initial refresh", async () => {
  let calls = 0;
  const coordinator = createRefreshCoordinator(async () => {
    calls += 1;
  });
  const result = coordinator.request();
  coordinator.dispose();
  await result;
  assert.equal(calls, 0);
});

test("a rejected refresh can be retried", async () => {
  let calls = 0;
  const coordinator = createRefreshCoordinator(async () => {
    calls += 1;
    if (calls === 1) throw new Error("Unavailable");
  });
  await assert.rejects(coordinator.request(), /Unavailable/);
  await coordinator.request();
  assert.equal(calls, 2);
});
