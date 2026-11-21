// Pure policy for a dedicated Node streaming worker. No user data, credentials,
// storage URLs, or S3 paths are taken from a browser request.
export const LONG_TRANSFER_MIN_BYTES = 32 * 1024 * 1024 + 1;
export const LONG_TRANSFER_MAX_BYTES = 5 * 1024 * 1024 * 1024;
export const LONG_TRANSFER_PART_BYTES = 8 * 1024 * 1024;
export const LONG_TRANSFER_WORKER_REF = "eivwnjbykohrlxavvpcr";

export function allowedLongTransferSize(value: number | null): boolean {
  return (
    value !== null &&
    Number.isSafeInteger(value) &&
    value >= LONG_TRANSFER_MIN_BYTES &&
    value <= LONG_TRANSFER_MAX_BYTES
  );
}

export function longTransferEligible(
  input: {
    jobState: string;
    failureCode: string | null;
    recordingState: string;
    archiveState: string;
    sizeBytes: number | null;
    retainsUntil: string;
    consentConfirmed: boolean;
    reviewerActive: boolean;
    recordingPermissionAttested: boolean;
    includesJunior: boolean;
    guardianPermissionAttested: boolean;
  },
  nowMs: number,
): boolean {
  return (
    input.jobState === "manual_review" &&
    input.failureCode === "large_file_requires_external_worker" &&
    input.recordingState === "provider_completed" &&
    input.archiveState === "object_confirmed" &&
    allowedLongTransferSize(input.sizeBytes) &&
    Number.isFinite(Date.parse(input.retainsUntil)) &&
    Date.parse(input.retainsUntil) > nowMs &&
    input.consentConfirmed &&
    input.reviewerActive &&
    input.recordingPermissionAttested &&
    (!input.includesJunior || input.guardianPermissionAttested)
  );
}

export function isExpectedSupabaseS3Endpoint(endpoint: string, projectRef: string): boolean {
  if (projectRef !== LONG_TRANSFER_WORKER_REF) return false;
  try {
    const parsed = new URL(endpoint);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === projectRef + ".supabase.co" ||
        parsed.hostname === projectRef + ".storage.supabase.co") &&
      parsed.pathname === "/storage/v1/s3" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash
    );
  } catch {
    return false;
  }
}

export function monitorMp4Header(firstBytes: Uint8Array): boolean {
  return (
    firstBytes.length >= 12 &&
    firstBytes[4] === 0x66 &&
    firstBytes[5] === 0x74 &&
    firstBytes[6] === 0x79 &&
    firstBytes[7] === 0x70
  );
}
