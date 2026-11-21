/** Guard the handoff from provider-verified S3 output into CricLume's private media library. */
export const privateImportMaxBytes = 32 * 1024 * 1024;
export const privateImportRetentionDays = 30;

export const cloudImportStates = ["approved", "importing", "imported", "manual_review"] as const;

export type CloudImportState = (typeof cloudImportStates)[number];

export interface CloudImportApproval {
  recordingPermissionAttested: boolean;
  includesJunior: boolean;
  guardianPermissionAttested: boolean;
}

export interface CloudImportPrerequisites {
  providerStatus: string;
  archiveCheckStatus: string;
  fileBytes: number | null;
  endedAt: string | null;
  recordingPermissionStillValid: boolean;
  reviewerStillAuthorised: boolean;
  approval: CloudImportApproval;
}

export function cloudImportEligible(input: CloudImportPrerequisites): boolean {
  return (
    input.providerStatus === "provider_completed" &&
    input.archiveCheckStatus === "object_confirmed" &&
    Number.isSafeInteger(input.fileBytes) &&
    (input.fileBytes ?? 0) >= 1024 &&
    input.endedAt !== null &&
    Number.isFinite(Date.parse(input.endedAt)) &&
    input.recordingPermissionStillValid &&
    input.reviewerStillAuthorised &&
    input.approval.recordingPermissionAttested &&
    (!input.approval.includesJunior || input.approval.guardianPermissionAttested)
  );
}

export function cloudImportRequiresExternalWorker(fileBytes: number): boolean {
  return !Number.isSafeInteger(fileBytes) || fileBytes > privateImportMaxBytes;
}

export function cloudImportStoragePath(
  organisationId: string,
  roomId: string,
  assetId: string,
): string {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (![organisationId, roomId, assetId].every((part) => uuid.test(part))) {
    throw new Error("Invalid tenant-scoped private media identifiers.");
  }
  return organisationId + "/" + roomId + "/" + assetId + "/source.mp4";
}

export function cloudImportReviewLabel(state: CloudImportState): string {
  switch (state) {
    case "approved":
      return "Import approved; queued for private server transfer";
    case "importing":
      return "Private transfer in progress; footage not yet available";
    case "imported":
      return "Private media copied; privacy processing required before playback";
    case "manual_review":
      return "Transfer needs operator review; do not claim media was saved";
  }
}
