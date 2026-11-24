/**
 * CricLume release-evidence contract. A passing unit test or source merge is
 * NEVER treated as proof that a production service, provider, device or app
 * store has been tested. Every release check needs a current human-reviewed
 * evidence reference. No secrets, private clips or player data belong here.
 */
export type ReleasePhase = "p0" | "p1" | "p2" | "p3";
export type GateId =
  | "green_main_build"
  | "correct_backend_and_schema"
  | "deployed_auth_functions"
  | "cross_tenant_rls"
  | "recent_database_backup"
  | "database_and_private_media_restore"
  | "legal_safeguarding"
  | "two_device_full_match"
  | "offline_reconnect_and_conflicts"
  | "anonymous_public_scoreboard"
  | "mobile_desktop_accessibility"
  | "club_academy_league_pilot"
  | "commercial_entitlements"
  | "email_push_reminders"
  | "domain_and_monitoring"
  | "multi_camera_consent_blur"
  | "private_media_archive_retention"
  | "ai_disabled_or_budget_certified"
  | "rain_disabled_or_licensed"
  | "native_capture_interruptions"
  | "signed_ios_android_builds"
  | "testflight_and_play_closed_testing"
  | "store_privacy_billing_compliance";

export interface ReleaseGate {
  id: GateId;
  label: string;
  phase: ReleasePhase;
  /** Maximum evidence age; operational status expires even when code remains green. */
  maxAgeHours: number;
}

const hours = (days: number) => days * 24;

export const releaseGates: readonly ReleaseGate[] = [
  { id: "green_main_build", label: "Green required CI on current release SHA", phase: "p0", maxAgeHours: hours(7) },
  { id: "correct_backend_and_schema", label: "Approved live project and migration parity", phase: "p0", maxAgeHours: hours(7) },
  { id: "deployed_auth_functions", label: "Live authentication and server functions tested", phase: "p0", maxAgeHours: hours(7) },
  { id: "cross_tenant_rls", label: "Actual cross-club and junior-permission negative tests", phase: "p0", maxAgeHours: hours(30) },
  { id: "recent_database_backup", label: "Recoverable recent managed database backup or PITR", phase: "p0", maxAgeHours: 36 },
  { id: "database_and_private_media_restore", label: "Independent database and private-video restore rehearsal", phase: "p0", maxAgeHours: hours(90) },
  { id: "legal_safeguarding", label: "Signed privacy, player/guardian and safety review", phase: "p0", maxAgeHours: hours(90) },
  { id: "two_device_full_match", label: "Complete iPhone and Android dual-scorer match", phase: "p1", maxAgeHours: hours(30) },
  { id: "offline_reconnect_and_conflicts", label: "Airplane mode, replay, undo and conflict field tests", phase: "p1", maxAgeHours: hours(30) },
  { id: "anonymous_public_scoreboard", label: "Anonymous live scoreboard correctness and data-exposure tests", phase: "p1", maxAgeHours: hours(30) },
  { id: "mobile_desktop_accessibility", label: "Phone, tablet and desktop usability/accessibility acceptance", phase: "p1", maxAgeHours: hours(30) },
  { id: "club_academy_league_pilot", label: "Real club/academy/league workflows with signed pilot approval", phase: "p1", maxAgeHours: hours(45) },
  { id: "commercial_entitlements", label: "Approved subscription provider, payment/cancel and plan checks", phase: "p2", maxAgeHours: hours(14) },
  { id: "email_push_reminders", label: "Production mail, push and paid-only messaging acceptance", phase: "p2", maxAgeHours: hours(14) },
  { id: "domain_and_monitoring", label: "Production domains, TLS, alerts and error monitoring", phase: "p2", maxAgeHours: hours(7) },
  { id: "multi_camera_consent_blur", label: "Actual multi-phone capture, permissions and private blurred replay", phase: "p2", maxAgeHours: hours(30) },
  { id: "private_media_archive_retention", label: "Private storage, verified copies, expiry and deletion tested", phase: "p2", maxAgeHours: hours(30) },
  { id: "ai_disabled_or_budget_certified", label: "AI remains disabled or is budget/consent certified", phase: "p2", maxAgeHours: hours(30) },
  { id: "rain_disabled_or_licensed", label: "Official rain rules remain disabled or are licensed/verified", phase: "p2", maxAgeHours: hours(30) },
  { id: "native_capture_interruptions", label: "Real native camera and background interruption tests", phase: "p3", maxAgeHours: hours(30) },
  { id: "signed_ios_android_builds", label: "Reproducible signed production native binaries", phase: "p3", maxAgeHours: hours(14) },
  { id: "testflight_and_play_closed_testing", label: "TestFlight and closed Play Console test reports", phase: "p3", maxAgeHours: hours(30) },
  { id: "store_privacy_billing_compliance", label: "Approved store privacy, children and billing declarations", phase: "p3", maxAgeHours: hours(30) },
];

export type GateEvidence = {
  passed: boolean;
  checkedAt: string;
  evidenceUrl: string;
  checkedBy: string;
};

export type ReleaseEvidenceBundle = {
  projectRef: string;
  releaseSha: string;
  checks: Partial<Record<GateId, GateEvidence>>;
};

export const approvedProjectRef = "eivwnjbykohrlxavvpcr";
export const releasePhases: readonly ReleasePhase[] = ["p0", "p1", "p2", "p3"];

export type GateResult = {
  id: GateId;
  phase: ReleasePhase;
  label: string;
  status: "verified" | "missing" | "failed" | "stale" | "invalid";
};

const hasVerifiedReference = (item: GateEvidence): boolean => {
  try {
    const url = new URL(item.evidenceUrl);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.hostname !== "example.com" &&
      url.hostname !== "localhost" &&
      item.checkedBy.trim().length >= 2
    );
  } catch {
    return false;
  }
};

export function evaluateReleaseEvidence(
  bundle: ReleaseEvidenceBundle | null,
  phase: ReleasePhase,
  expectedSha: string,
  nowMs: number,
): {
  approved: boolean;
  environmentMatched: boolean;
  results: GateResult[];
  blockers: GateId[];
} {
  const environmentMatched = Boolean(
    bundle &&
    bundle.projectRef === approvedProjectRef &&
    /^[a-f0-9]{40}$/i.test(expectedSha) &&
    bundle.releaseSha.toLowerCase() === expectedSha.toLowerCase(),
  );
  const phaseIndex = releasePhases.indexOf(phase);
  const results: GateResult[] = releaseGates
    .filter((gate) => releasePhases.indexOf(gate.phase) <= phaseIndex)
    .map((gate) => {
      const evidence = bundle?.checks?.[gate.id];
      let status: GateResult["status"] = "missing";
      if (evidence) {
        if (evidence.passed !== true) status = "failed";
        else if (!hasVerifiedReference(evidence)) status = "invalid";
        else {
          const checkedAtMs = Date.parse(evidence.checkedAt);
          if (
            !Number.isFinite(nowMs) ||
            !Number.isFinite(checkedAtMs) ||
            checkedAtMs > nowMs + 5 * 60_000 ||
            nowMs - checkedAtMs > gate.maxAgeHours * 60 * 60_000
          ) status = "stale";
          else status = "verified";
        }
      }
      return { id: gate.id, phase: gate.phase, label: gate.label, status };
    });
  return {
    approved: environmentMatched && results.length > 0 && results.every((r) => r.status === "verified"),
    environmentMatched,
    results,
    blockers: results.filter((r) => r.status !== "verified").map((r) => r.id),
  };
}
