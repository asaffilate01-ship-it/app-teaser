import assert from "node:assert/strict";
import test from "node:test";
import { assessCricketAIRequest } from "../src/lib/ai-readiness.ts";
import { coachBriefingMarkdown } from "../src/lib/coach-briefing.ts";

const connection = {
  connection: "verified" as const,
  entitlementActive: true as const,
  budgetedAdmissionRequired: true as const,
  modelExecutionReady: false,
};

test("connection-only readiness never enables a paid agent request", () => {
  const result = assessCricketAIRequest({ role: "coach", hasMatch: true, connection });
  assert.equal(result.ready, false);
  assert.match(result.reason, /Certified budgeted AI worker/);
});

test("unverified tenants, unauthorized roles and missing matches are blocked", () => {
  assert.equal(
    assessCricketAIRequest({ role: "viewer", hasMatch: true, connection: null }).ready,
    false,
  );
  assert.equal(
    assessCricketAIRequest({
      role: "coach",
      hasMatch: false,
      connection: { ...connection, modelExecutionReady: true },
    }).ready,
    false,
  );
  assert.equal(assessCricketAIRequest({ role: "player", hasMatch: true, connection }).ready, false);
});

test("an independently certified worker allows request eligibility, not model execution", () => {
  const result = assessCricketAIRequest({
    role: "coach",
    hasMatch: true,
    connection: { ...connection, modelExecutionReady: true },
  });
  assert.equal(result.ready, true);
  assert.equal(result.checks.length, 4);
});

test("free briefing is labelled as rules-based, dated and subject to human approval", () => {
  const briefing = coachBriefingMarkdown({
    mode: "deterministic",
    headline: "Example",
    facts: ["Score: 25/2."],
    coachingPrompts: ["Review bowling control."],
    limitations: ["No media was analysed."],
    sourceUpdatedAt: "2026-11-20T15:00:00Z",
  });
  assert.match(briefing, /not AI inference/);
  assert.match(briefing, /Score: 25\/2/);
  assert.match(briefing, /No media was analysed/);
  assert.match(briefing, /Human review.*Required/);
  assert.match(briefing, /2026-11-20T15:00:00Z/);
});
