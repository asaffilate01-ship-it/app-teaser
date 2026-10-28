import test from "node:test";
import assert from "node:assert/strict";
import {
  reviewSnapshot,
  reviewReportHtml,
  type ReviewReportInput,
} from "../src/lib/review-report.ts";
import { defaultAnalysisFilters, type DeliveryEvidence } from "../src/lib/analysis.ts";
const delivery: DeliveryEvidence = {
  id: "d",
  innings_id: "innings",
  sequence: 1,
  over_number: 2,
  ball_in_over: 1,
  striker_id: "b",
  bowler_id: "w",
  fielder_id: null,
  delivery_style: "spin",
  outcome: "runs",
  batter_runs: 4,
  total_runs: 5,
  legal_ball: true,
  wicket: false,
  shot_zone: "cover",
  fielding_zone: null,
  superseded_by: null,
};
const input: ReviewReportInput = {
  organisationId: "club",
  matchId: "match",
  loadedAt: "2026-10-28T12:00:00Z",
  generatedAt: "2026-10-28T13:00:00Z",
  filters: defaultAnalysisFilters,
  history: "all",
  search: "",
  deliveries: [delivery, { ...delivery, id: "old", voided_by_event_id: "undo", total_runs: 99 }],
  mediaIds: new Set(),
  notes: [
    {
      id: "n",
      discipline: "batting",
      delivery_id: "old",
      note: "Previous observation",
      tags: "practice",
      created_at: "2026-10-28T10:00:00Z",
      evidence_file_id: "source",
      evidence_time_seconds: 12,
    },
  ],
};
test("report uses current filtered totals and separately labels historical notes", () => {
  const snapshot = reviewSnapshot(input);
  assert.equal(snapshot.summary.teamRuns, 5);
  assert.equal(snapshot.rows.length, 1);
  assert.equal(snapshot.notes[0]?.deliveryState, "no_longer_current");
  const html = reviewReportHtml(input);
  assert.match(html, /no longer current/);
  assert.match(html, /Evidence loaded \(UTC\)/);
  assert.match(html, /2026-10-28T12:00:00.000Z/);
  assert.match(html, /source · 12 seconds/);
  assert.equal(reviewSnapshot({ ...input, history: "current" }).notes.length, 0);
  assert.equal(
    reviewSnapshot({ ...input, filters: { ...defaultAnalysisFilters, player: "someone-else" } })
      .rows.length,
    0,
  );
});
test("report encodes untrusted text and has no executable or remote resources", () => {
  const attack = '</p><script>alert("x")</script><img src="https://bad.invalid/x">';
  const html = reviewReportHtml({
    ...input,
    matchId: attack,
    notes: [{ ...input.notes[0]!, note: attack, tags: attack }],
    filters: { ...defaultAnalysisFilters, style: attack },
  });
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<img"));
  assert.ok(!/<(?:iframe|link)\b/i.test(html));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /default-src 'none'/);
  assert.ok(!html.includes("<a "));
});
test("long report excerpts are labelled while aggregate totals cover all matching rows", () => {
  const expanded = {
    ...input,
    deliveries: Array.from({ length: 251 }, (_, i) => ({ ...delivery, id: `d${i}` })),
    notes: Array.from({ length: 101 }, (_, i) => ({
      ...input.notes[0]!,
      id: `n${i}`,
      delivery_id: null,
    })),
  };
  const html = reviewReportHtml(expanded);
  assert.match(html, /Showing 250 of 251 matching deliveries/);
  assert.match(html, /Showing 100 of 101 matching observations/);
  assert.equal(reviewSnapshot(expanded).summary.teamRuns, 1255);
  assert.equal((html.match(/<article>/g) || []).length, 100);
});
test("empty reports explain missing evidence without fabricated statistics", () => {
  const html = reviewReportHtml({ ...input, deliveries: [], notes: [], loadedAt: "invalid" });
  assert.match(html, /No current deliveries match/);
  assert.match(html, /No saved observations match/);
  assert.match(html, /Not recorded/);
  assert.ok(!html.includes("NaN"));
});
