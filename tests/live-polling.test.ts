import assert from "node:assert/strict";
import test from "node:test";
import { createLivePolling } from "../src/lib/live-polling.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture(load: () => Promise<void>) {
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let nextId = 0;
  let hidden = false;
  const poller = createLivePolling({
    load,
    interval: () => (hidden ? 45_000 : 15_000),
    schedule: (callback, delay) => {
      const id = ++nextId;
      timers.set(id, { callback, delay });
      return id;
    },
    cancel: (id) => {
      timers.delete(id);
    },
  });
  return {
    poller,
    timers,
    hide: () => {
      hidden = true;
    },
  };
}

test("polling and manual refresh bursts serialize requests and retain only one timer", async () => {
  const first = deferred();
  const second = deferred();
  let calls = 0;
  const { poller, timers } = fixture(async () => {
    calls += 1;
    await (calls === 1 ? first.promise : second.promise);
  });
  const initial = poller.request();
  await Promise.resolve();
  assert.equal(calls, 1);
  const requests = Array.from({ length: 20 }, () => poller.request());
  assert.equal(timers.size, 0);
  first.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls, 2);
  second.resolve();
  await Promise.all([initial, ...requests]);
  assert.equal(calls, 2);
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0]?.delay, 15_000);
});

test("disposal invalidates pending work and prevents late polling timers", async () => {
  const first = deferred();
  let calls = 0;
  const { poller, timers } = fixture(async () => {
    calls += 1;
    await first.promise;
  });
  const result = poller.request();
  await Promise.resolve();
  void poller.request();
  poller.dispose();
  first.resolve();
  await result;
  await poller.request();
  assert.equal(calls, 1);
  assert.equal(timers.size, 0);
  assert.equal(poller.isActive(), false);
});

test("failed refreshes retry, use visibility-specific intervals and replace the old timer", async () => {
  let calls = 0;
  const { poller, timers, hide } = fixture(async () => {
    calls += 1;
    if (calls === 1) throw new Error("Network unavailable");
  });
  await poller.request();
  assert.equal(timers.size, 1);
  hide();
  await poller.request();
  assert.equal(calls, 2);
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0]?.delay, 45_000);
  poller.dispose();
  assert.equal(timers.size, 0);
});
