import test from "node:test";
import assert from "node:assert/strict";
import {
  filterDeliveries,
  summarizeDeliveries,
  deliveryCsv,
  defaultAnalysisFilters,
  type DeliveryEvidence,
} from "../src/lib/analysis.ts";
import { handleCricketMcp } from "../supabase/functions/_shared/criclume-mcp.ts";
const row: DeliveryEvidence = {
  id: "a",
  innings_id: "i",
  sequence: 1,
  over_number: 2,
  ball_in_over: 1,
  striker_id: "batter",
  bowler_id: "bowler",
  fielder_id: "fielder",
  delivery_style: "spin",
  outcome: "runs",
  batter_runs: 4,
  total_runs: 5,
  legal_ball: true,
  wicket: false,
  shot_zone: "cover",
  fielding_zone: "point",
  superseded_by: null,
};
test("combined discipline, player, range, zone and media filtering", () => {
  assert.equal(
    filterDeliveries(
      [row],
      {
        ...defaultAnalysisFilters,
        discipline: "fielding",
        player: "fielder",
        zone: "point",
        fromOver: "2",
        toOver: "2",
        mediaOnly: true,
      },
      new Set(["a"]),
    ).length,
    1,
  );
  for (const patch of [
    { player: "bowler" },
    { zone: "leg" },
    { fromOver: "3" },
    { toOver: "1" },
    { mediaOnly: true },
  ])
    assert.equal(filterDeliveries([row], { ...defaultAnalysisFilters, ...patch }).length, 0);
  assert.equal(
    filterDeliveries([{ ...row, superseded_by: "new" }], defaultAnalysisFilters).length,
    0,
  );
});
test("team extras and wicket events remain distinct from batting metrics", () => {
  assert.deepEqual(
    summarizeDeliveries([
      row,
      { ...row, id: "w", batter_runs: 0, total_runs: 0, wicket: true, legal_ball: false },
    ]),
    { deliveries: 2, batterRuns: 4, teamRuns: 5, legalBalls: 1, wicketEvents: 1, boundaries: 1 },
  );
});
test("CSV quotes delimiters and blocks formula cells", () => {
  const csv = deliveryCsv([{ ...row, delivery_style: '=IMPORTXML("bad")', shot_zone: "a,b" }]);
  assert.match(csv, /"'=IMPORTXML/);
  assert.match(csv, /"a,b"/);
});
test("MCP does not expose write tools or arbitrary arguments", async () => {
  let calls = 0;
  const reader = async () => {
    calls++;
    return {};
  };
  const args = {
    organisationId: "11111111-1111-4111-8111-111111111111",
    matchId: "22222222-2222-4222-8222-222222222222",
  };
  for (const params of [
    { name: "write_score", arguments: args },
    { name: "criclume_match_summary", arguments: { ...args, url: "https://example.com" } },
  ])
    assert.ok(
      (await handleCricketMcp({ jsonrpc: "2.0", id: 1, method: "tools/call", params }, reader))
        ?.error,
    );
  assert.equal(calls, 0);
  const r = await handleCricketMcp(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "criclume_match_summary", arguments: args },
    },
    async () => {
      throw new Error("private SQL details");
    },
  );
  assert.equal(JSON.stringify(r).includes("private SQL"), false);
  assert.match(JSON.stringify(r), /isError":true/);
});

test("undone and replaced deliveries are excluded from filtering, summary and CSV", () => {
  const undone = {
    ...row,
    id: "undone",
    voided_by_event_id: "undo",
    batter_runs: 6,
    total_runs: 6,
  };
  const replaced = { ...row, id: "replaced", superseded_by: "new", batter_runs: 6, total_runs: 6 };
  assert.deepEqual(filterDeliveries([row, undone, replaced], defaultAnalysisFilters), [row]);
  assert.deepEqual(summarizeDeliveries([row, undone, replaced]), summarizeDeliveries([row]));
  assert.equal(deliveryCsv([row, undone, replaced]), deliveryCsv([row]));
});
