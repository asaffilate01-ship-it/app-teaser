import assert from "node:assert/strict";
import test from "node:test";
import {
  approvedProjectRef,
  evaluateReleaseEvidence,
  releaseGates,
  type ReleaseEvidenceBundle,
  type ReleasePhase,
} from "../src/lib/release-readiness.ts";

const nowMs = Date.parse("2026-11-24T12:00:00.000Z");
const sha = "a".repeat(40);
const fresh = (phase: ReleasePhase): ReleaseEvidenceBundle => ({
  projectRef: approvedProjectRef,
  releaseSha: sha,
  checks: Object.fromEntries(
    releaseGates
      .filter((gate) => ["p0", "p1", "p2", "p3"].indexOf(gate.phase) <=
        ["p0", "p1", "p2", "p3"].indexOf(phase))
      .map((gate) => [
        gate.id,
        {
          passed: true,
          checkedAt: new Date(nowMs - 60_000).toISOString(),
          checkedBy: "Approved test reviewer",
          evidenceUrl: "https://github.com/asaffilate01-ship-it/app-teaser/actions/runs/123",
        },
      ]),
  ),
});

test("release gates require real, recent, reviewer-attributed evidence", () => {
  for (const phase of ["p0", "p1", "p2", "p3"] as const) {
    const report = evaluateReleaseEvidence(fresh(phase), phase, sha, nowMs);
    assert.equal(report.approved, true);
    assert.equal(report.blockers.length, 0);
  }
  assert.equal(evaluateReleaseEvidence(null, "p0", sha, nowMs).approved, false);
  assert.equal(evaluateReleaseEvidence(fresh("p0"), "p1", sha, nowMs).approved, false);
});

test("a passing CI report cannot approve the wrong source commit or backend", () => {
  const data = fresh("p0");
  assert.equal(evaluateReleaseEvidence(data, "p0", "b".repeat(40), nowMs).approved, false);
  assert.equal(
    evaluateReleaseEvidence({ ...data, projectRef: "ebzinvoxundsdubczqfg" }, "p0", sha, nowMs).approved,
    false,
  );
  assert.equal(evaluateReleaseEvidence(data, "p0", "not-a-real-sha", nowMs).approved, false);
});

test("stale backups, fake links, missing reviewer, and future reports block release", () => {
  for (const defect of [
    { passed: false },
    { evidenceUrl: "http://example.com/green" },
    { evidenceUrl: "https://example.com/check" },
    { evidenceUrl: "https://valid.org", checkedBy: " " },
    { checkedAt: "invalid" },
    { checkedAt: new Date(nowMs + 60 * 60_000).toISOString() },
    { checkedAt: new Date(nowMs - 72 * 60 * 60_000).toISOString() },
  ]) {
    const bundle = fresh("p0");
    bundle.checks.recent_database_backup = {
      ...bundle.checks.recent_database_backup!,
      ...defect,
    };
    const result = evaluateReleaseEvidence(bundle, "p0", sha, nowMs);
    assert.equal(result.approved, false);
    assert.ok(result.blockers.includes("recent_database_backup"));
  }
});

test("a green P0 source never implies a verified club pilot, paid video or native release", () => {
  const sourceOnly = fresh("p0");
  assert.equal(evaluateReleaseEvidence(sourceOnly, "p0", sha, nowMs).approved, true);
  for (const phase of ["p1", "p2", "p3"] as const) {
    const result = evaluateReleaseEvidence(sourceOnly, phase, sha, nowMs);
    assert.equal(result.approved, false);
    assert.ok(result.results.some((check) => check.phase === phase && check.status === "missing"));
  }
});
