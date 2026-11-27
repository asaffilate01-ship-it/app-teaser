import assert from "node:assert/strict";
import test from "node:test";
import {
  integrationReportCurrent,
  integrationReportLifetimeMs,
  parseIntegrationReport,
  summarizeIntegrationReport,
} from "../src/lib/integration-report.ts";

const now = Date.parse("2026-11-27T05:30:00Z");
const checkedAt = new Date(now).toISOString();
const core = {
  id: "core",
  label: "Core schema",
  status: "verified",
  detail: "Schema responded.",
};

test("configuration reports reject malformed and ambiguous checks", () => {
  for (const value of [
    null,
    [],
    { checkedAt: "not a date", checks: [core] },
    { checkedAt, checks: [] },
    { checkedAt, checks: [core, core] },
    { checkedAt, checks: [{ ...core, status: "production ready" }] },
    { checkedAt, checks: [{ ...core, detail: "" }] },
    { checkedAt, checks: [{ ...core, id: "invalid id" }] },
    { checkedAt, checks: [{ ...core, label: "a".repeat(161) }] },
    { checkedAt, checks: Array.from({ length: 65 }, (_, i) => ({ ...core, id: String(i) })) },
  ]) {
    assert.equal(parseIntegrationReport(value), null);
  }
});

test("reports are time-limited and reject invalid or excessively future clocks", () => {
  const report = parseIntegrationReport({ checkedAt, checks: [core] });
  assert.ok(report);
  assert.equal(integrationReportCurrent(report, now), true);
  assert.equal(integrationReportCurrent(report, now + integrationReportLifetimeMs - 1), true);
  assert.equal(integrationReportCurrent(report, now + integrationReportLifetimeMs), false);
  assert.equal(integrationReportCurrent(report, now - 60_001), false);
  assert.equal(integrationReportCurrent(report, NaN), false);
});

test("missing expected checks remain visible and configuration never counts as verification", () => {
  const report = parseIntegrationReport({
    checkedAt,
    checks: [
      core,
      { id: "billing", label: "Billing", status: "configured", detail: "Configuration present." },
      { id: "paid-ai", label: "Paid AI", status: "disabled", detail: "Disabled." },
      { id: "backup", label: "Backup", status: "unverified", detail: "Restore not tested." },
      { id: "email", label: "Email", status: "missing", detail: "Missing." },
    ],
  });
  assert.ok(report);
  const summary = summarizeIntegrationReport(report);
  assert.equal(summary.responded, 1);
  assert.equal(summary.configured, 1);
  assert.equal(summary.disabled, 1);
  assert.equal(summary.unverified, 1);
  assert.equal(summary.needsAttention, 1);
  assert.ok(summary.missingChecks.includes("Cloud camera recording"));
  assert.ok(!summary.missingChecks.includes("Backup recovery"));
});
