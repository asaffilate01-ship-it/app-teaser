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

test("report zone totals follow discipline, filters and unknown-zone coverage", () => {
  const data = {
    ...input,
    deliveries: [delivery, { ...delivery, id: "missing", shot_zone: null }],
  };
  const batting = reviewSnapshot(data);
  assert.equal(batting.ground.mapped, 1);
  assert.equal(batting.ground.unmapped, 1);
  assert.equal(batting.ground.zones.find((z) => z.name === "Cover")?.runs, 4);
  assert.equal(batting.bowling, null);
  assert.match(reviewReportHtml(data), /1 of 2 matching deliveries/);
  const bowling = reviewSnapshot({
    ...data,
    filters: { ...defaultAnalysisFilters, discipline: "bowling" },
  });
  assert.equal(bowling.ground.zones.find((z) => z.name === "Cover")?.runs, 5);
  const fielding = reviewSnapshot({
    ...data,
    filters: { ...defaultAnalysisFilters, discipline: "fielding" },
  });
  assert.equal(fielding.ground.mapped, 0);
  assert.equal(fielding.ground.unmapped, 2);
  assert.equal(
    reviewSnapshot({ ...data, filters: { ...defaultAnalysisFilters, player: "other" } }).ground
      .mapped,
    0,
  );
});

test("report placement agrees with dashboard semantics even when note search hides conflicts", () => {
  const note = {
    ...input.notes[0]!,
    discipline: "bowling" as const,
    delivery_id: "d",
    bowling_line: "off_stump",
    bowling_length: "good",
  };
  const data = {
    ...input,
    filters: { ...defaultAnalysisFilters, discipline: "bowling" as const },
    notes: [note, { ...note, id: "n2", bowling_length: "short" }],
    search: "no such text",
    history: "historical" as const,
  };
  const result = reviewSnapshot(data);
  assert.equal(result.notes.length, 0);
  assert.equal(result.bowling?.conflicting.length, 1);
  assert.equal(result.bowling?.mapped, 0);
  const html = reviewReportHtml(data);
  assert.match(html, /Conflicting classifications/);
  assert.match(html, /even when observation search or history settings hide some notes/);
  assert.match(html, /full toss \(no bounce\)/);
});

test("placement aggregates cover every matching row beyond report excerpt limits", () => {
  const deliveries = Array.from({ length: 251 }, (_, i) => ({ ...delivery, id: `ball${i}` }));
  const notes = deliveries.map((d) => ({
    ...input.notes[0]!,
    discipline: "bowling" as const,
    delivery_id: d.id,
    bowling_line: "off_stump",
    bowling_length: "good",
  }));
  const data = {
    ...input,
    filters: { ...defaultAnalysisFilters, discipline: "bowling" as const },
    deliveries,
    notes: [...notes, notes[0]!],
  };
  const result = reviewSnapshot(data);
  assert.equal(result.bowling?.mapped, 251);
  assert.equal(result.bowling?.cells.find((c) => c.key === "good:off_stump")?.runs, 1255);
  const html = reviewReportHtml(data);
  assert.match(html, /251 \/ 1255 \/ 0/);
  assert.match(html, /Showing 250 of 251 matching deliveries/);
  assert.match(html, /251 of 251 matching deliveries have a recognised shot zone/);
});

test("new report sections remain resource-free and reject hostile classification values", () => {
  const attack = '<img src="https://bad.invalid/x" onerror="alert(1)">';
  const html = reviewReportHtml({
    ...input,
    filters: { ...defaultAnalysisFilters, discipline: "bowling" },
    deliveries: [{ ...delivery, shot_zone: attack }],
    notes: [
      {
        ...input.notes[0]!,
        discipline: "bowling",
        delivery_id: "d",
        bowling_line: attack,
        bowling_length: "good",
      },
    ],
  });
  assert.ok(!/<(?:script|img|canvas|iframe|link)\b/i.test(html));
  assert.match(html, /No mapped zones/);
  assert.match(html, /Unclassified deliveries/);
  assert.match(html, /&lt;img/);
});

test("zone drill-down criteria preserve player filters and report the same ground subset", () => {
  const data = {
    ...input,
    deliveries: [
      delivery,
      { ...delivery, id: "variant", shot_zone: " COVER " },
      { ...delivery, id: "other", striker_id: "someone-else" },
    ],
    filters: { ...defaultAnalysisFilters, zone: "Cover", player: "b" },
  };
  const report = reviewSnapshot(data);
  assert.equal(report.rows.length, 2);
  assert.equal(report.ground.mapped, 2);
  assert.equal(report.summary.batterRuns, 8);
  assert.match(reviewReportHtml(data), /2 of 2 matching deliveries have a recognised shot zone/);
});
