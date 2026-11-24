import type { IntelligenceConnection, IntelligenceRequest, IntelligenceTask } from "./omniqora";

const approvedRoles = new Set([
  "owner",
  "league_admin",
  "club_admin",
  "coach",
  "safeguarding_officer",
]);

/**
 * Client display gate. Every paid run still requires independent server-side
 * tenant verification, model/tariff approval and atomic spend reservation.
 */
export function assessCricketAIRequest(input: {
  role: string;
  hasMatch: boolean;
  connection: IntelligenceConnection | null;
}) {
  const roleAllowed = approvedRoles.has(input.role);
  const connectionVerified =
    input.connection?.connection === "verified" &&
    input.connection.entitlementActive === true &&
    input.connection.budgetedAdmissionRequired === true;
  const certifiedWorker = connectionVerified && input.connection?.modelExecutionReady === true;
  const checks = [
    { label: "Authorised club or coaching role", passed: roleAllowed },
    { label: "Club match selected", passed: input.hasMatch },
    { label: "Scoped Omniqora access and entitlement verified", passed: connectionVerified },
    { label: "Certified budgeted AI worker available", passed: certifiedWorker },
  ];
  return {
    ready: checks.every((check) => check.passed),
    checks,
    reason:
      checks.find((check) => !check.passed)?.label ??
      "Server will still verify the model, budget, source and tenant for each run.",
  };
}

const terminalRunStatuses = new Set(["completed", "failed", "cancelled", "stale"]);

/** A conservative UI preflight; the server remains responsible for spend admission. */
export function assessIntelligenceHistory(input: {
  historyLoaded: boolean;
  requests: readonly Pick<IntelligenceRequest, "task" | "status">[];
  task: IntelligenceTask;
}) {
  if (!input.historyLoaded) {
    return { ready: false, reason: "Refresh AI task history before requesting a model run." };
  }
  if (
    input.requests.some(
      (request) => request.task === input.task && !terminalRunStatuses.has(request.status),
    )
  ) {
    return {
      ready: false,
      reason: "Review or refresh the existing task before requesting another run.",
    };
  }
  return { ready: true, reason: "Task history is available. Server budget checks still apply." };
}
