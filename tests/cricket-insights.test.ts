import assert from "node:assert/strict";
import test from "node:test";
import { buildCricketPreview } from "../src/lib/cricket-insights.ts";
import type { IntelligenceTask } from "../src/lib/omniqora.ts";

const snapshot = {
  status: "live",
  updatedAt: "2026-10-16T14:15:00.000Z",
  liveState: {
    runs: 78,
    wickets: 2,
    overs: "6.3",
    target: 95,
    recent: [{ label: "4" }, { label: "Wd" }, { label: "0" }, { label: "6" }],
    striker: { name: "Sensitive Junior Name", dob: "2013-02-01" },
    medicalNotes: "must never travel to AI",
    videoUrl: "private",
  },
};

test("free match analysis quotes only observed totals and never exports player secrets", () => {
  const view = buildCricketPreview(snapshot, "match_insights");
  assert.equal(view.mode, "deterministic");
  assert.ok(view.facts.some((item) => item.includes("78/2") && item.includes("6.3")));
  assert.ok(view.facts.some((item) => item.includes("17 more runs")));
  assert.ok(view.facts.some((item) => item.includes("12.00")));
  assert.ok(
    view.facts.some((item) => item.includes("2 boundaries") && item.includes("1 recorded")),
  );
  assert.doesNotMatch(JSON.stringify(view), /Sensitive Junior|dob|medical|videoUrl|private/i);
  assert.match(view.limitations.join(" "), /not GenAI output/);
});

test("all six cricket report types produce distinct coach discussions", () => {
  const kinds: IntelligenceTask[] = [
    "match_insights",
    "batting_coach",
    "bowling_coach",
    "fielding_review",
    "training_plan",
    "analyst_agent",
  ];
  const descriptions = kinds.map((task) =>
    buildCricketPreview(snapshot, task).coachingPrompts.at(-1),
  );
  assert.equal(new Set(descriptions).size, kinds.length);
  assert.ok(descriptions.every(Boolean));
});

test("missing or malformed score data is treated as unavailable, never guessed", () => {
  const view = buildCricketPreview(
    {
      status: "draft",
      updatedAt: "2026-10-16T14:15:00.000Z",
      liveState: {
        runs: -5,
        wickets: 12,
        target: "100",
        overs: "4.6",
        recent: [{ label: "player-sensitive-data" }],
      },
    },
    "fielding_review",
  );
  assert.match(view.facts.join(" "), /not available/);
  assert.ok(view.facts.every((item) => !/Run rate|target|boundary/i.test(item)));
  assert.ok(view.limitations.some((item) => /unavailable/.test(item)));
});
