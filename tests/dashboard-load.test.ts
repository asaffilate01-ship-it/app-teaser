import assert from "node:assert/strict";
import test from "node:test";
import {
  appendDashboardGroup,
  collectDashboardPages,
  collectDashboardRows,
  dashboardIdBatchSize,
  dashboardMaxPages,
  dashboardPageSize,
  requireDashboardCount,
} from "../src/lib/dashboard-load.ts";

test("empty workspace relations issue no requests", async () => {
  const result = await collectDashboardRows([], async () => {
    throw new Error("Unexpected query");
  });
  assert.deepEqual(result, []);
});

test("scoped loading deduplicates IDs, bounds filter size and retrieves every page", async () => {
  const ids = Array.from({ length: dashboardIdBatchSize + 1 }, (_, i) => `id-${i}`);
  const calls: Array<{ ids: string[]; from: number; to: number }> = [];
  const result = await collectDashboardRows([...ids, ids[0]!, ""], async (batch, from, to) => {
    calls.push({ ids: batch, from, to });
    const size = batch.length === dashboardIdBatchSize ? dashboardPageSize + 2 : 1;
    return Array.from({ length: size }, (_, i) => `${batch[0]}:${i}`).slice(from, to + 1);
  });
  assert.equal(result.length, dashboardPageSize + 3);
  assert.deepEqual(
    calls.map((call) => [call.ids.length, call.from, call.to]),
    [
      [dashboardIdBatchSize, 0, dashboardPageSize - 1],
      [dashboardIdBatchSize, dashboardPageSize, 2 * dashboardPageSize - 1],
      [1, 0, dashboardPageSize - 1],
    ],
  );
});

test("relation fetch failures are not silently treated as empty results", async () => {
  await assert.rejects(
    collectDashboardRows(["team"], async () => {
      throw new Error("Access denied");
    }),
    /Access denied/,
  );
});

test("group appends preserve order and reuse the same array", () => {
  const map = new Map<string, string[]>();
  appendDashboardGroup(map, "team", "a");
  const first = map.get("team");
  appendDashboardGroup(map, "team", "b");
  appendDashboardGroup(map, "other", "c");
  assert.equal(map.get("team"), first);
  assert.deepEqual(map.get("team"), ["a", "b"]);
  assert.deepEqual(map.get("other"), ["c"]);
});

test("root workspace pagination loads beyond the usual REST row cap", async () => {
  const source = Array.from({ length: 1201 }, (_, index) => index);
  const calls: number[][] = [];
  const result = await collectDashboardPages(async (from, to) => {
    calls.push([from, to]);
    return source.slice(from, to + 1);
  });
  assert.deepEqual(result, source);
  assert.deepEqual(calls, [
    [0, 499],
    [500, 999],
    [1000, 1499],
  ]);
});

test("bounded paging accepts an exact safety limit but never silently truncates", async () => {
  const maximum = dashboardPageSize * dashboardMaxPages;
  const load = (size: number) => async (from: number, to: number) =>
    Array.from({ length: Math.max(0, Math.min(size, to + 1) - from) }, (_, i) => from + i);
  assert.equal((await collectDashboardPages(load(maximum))).length, maximum);
  await assert.rejects(collectDashboardPages(load(maximum + 1)), /safety limit/);
});

test("missing, invalid or failed exact counts are not treated as zero", () => {
  assert.equal(requireDashboardCount({ count: 0, error: null }), 0);
  assert.equal(requireDashboardCount({ count: 12001, error: null }), 12001);
  for (const count of [null, NaN, Infinity, -1, 1.5]) {
    assert.throws(() => requireDashboardCount({ count, error: null }), /exact workspace count/);
  }
  assert.throws(
    () => requireDashboardCount({ count: 0, error: { message: "Access denied" } }),
    /Access denied/,
  );
});
