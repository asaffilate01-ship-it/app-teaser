import assert from "node:assert/strict";
import test from "node:test";
import {
  appendDashboardGroup,
  collectDashboardRows,
  dashboardIdBatchSize,
  dashboardPageSize,
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
