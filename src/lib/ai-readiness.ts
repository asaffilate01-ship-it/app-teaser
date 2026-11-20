import type { IntelligenceConnection } from "./omniqora";

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
