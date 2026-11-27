/** Configuration evidence only. This report does not authorise production release. */
export const integrationReportLifetimeMs = 10 * 60_000;

export const integrationCheckStatuses = [
  "verified",
  "configured",
  "missing",
  "unavailable",
  "disabled",
  "unverified",
] as const;

export type IntegrationCheckStatus = (typeof integrationCheckStatuses)[number];

export type IntegrationCheck = {
  id: string;
  label: string;
  status: IntegrationCheckStatus;
  detail: string;
};

export type IntegrationReport = {
  checkedAt: string;
  checks: IntegrationCheck[];
};

const requiredChecks = [
  ["core", "Core database schema"],
  ["analysis", "Analysis database schema"],
  ["media", "Media database schema"],
  ["intelligence", "Intelligence database schema"],
  ["billing", "Billing"],
  ["email", "Email delivery"],
  ["video", "Video processing"],
  ["rain", "Rain-rule provider"],
  ["omniqora", "Omniqora"],
  ["cloud-capture", "Cloud camera recording"],
  ["cloud-match-auto", "Automatic cloud recording"],
  ["cloud-archive-check", "Cloud archive inspection"],
  ["private-media-import", "Private media ingestion"],
  ["paid-ai", "Paid AI"],
  ["backup", "Backup recovery"],
] as const;

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function boundedText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

export function parseIntegrationReport(value: unknown): IntegrationReport | null {
  if (!object(value) || typeof value["checkedAt"] !== "string") return null;
  const checkedAt = value["checkedAt"];
  const rows = value["checks"];
  if (!Number.isFinite(Date.parse(checkedAt)) || !Array.isArray(rows)) return null;
  if (rows.length === 0 || rows.length > 64) return null;
  const seen = new Set<string>();
  const checks: IntegrationCheck[] = [];
  for (const row of rows) {
    if (!object(row)) return null;
    const { id, label, status, detail } = row;
    if (
      !boundedText(id, 64) ||
      !/^[a-z0-9-]+$/.test(id) ||
      seen.has(id) ||
      !boundedText(label, 160) ||
      !boundedText(detail, 1200) ||
      !(integrationCheckStatuses as readonly unknown[]).includes(status)
    ) {
      return null;
    }
    seen.add(id);
    checks.push({ id, label, status: status as IntegrationCheckStatus, detail });
  }
  return { checkedAt, checks };
}

export function integrationReportCurrent(report: IntegrationReport, nowMs: number): boolean {
  const time = Date.parse(report.checkedAt);
  return (
    Number.isFinite(time) &&
    Number.isFinite(nowMs) &&
    time <= nowMs + 60_000 &&
    nowMs - time < integrationReportLifetimeMs
  );
}

export function summarizeIntegrationReport(report: IntegrationReport) {
  const ids = new Set(report.checks.map((check) => check.id));
  return {
    missingChecks: requiredChecks.filter(([id]) => !ids.has(id)).map(([, label]) => label),
    responded: report.checks.filter((check) => check.status === "verified").length,
    configured: report.checks.filter((check) => check.status === "configured").length,
    needsAttention: report.checks.filter(
      (check) => check.status === "missing" || check.status === "unavailable",
    ).length,
    disabled: report.checks.filter((check) => check.status === "disabled").length,
    unverified: report.checks.filter((check) => check.status === "unverified").length,
  };
}

export const integrationStatusLabels: Record<IntegrationCheckStatus, string> = {
  verified: "Check responded",
  configured: "Configuration present",
  missing: "Configuration missing",
  unavailable: "Check unavailable",
  disabled: "Disabled",
  unverified: "Not verified",
};
