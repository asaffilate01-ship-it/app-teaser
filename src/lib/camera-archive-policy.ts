// Pure archive checks: confirming the existence of a private MP4 object is NOT
// proof of complete playback, authenticity, or safeguarding/publication approval.
export const cameraArchiveStatuses = [
  "uninspected",
  "object_confirmed",
  "object_missing",
  "invalid_object",
  "storage_error",
  "review_required",
] as const;

export type CameraArchiveStatus = (typeof cameraArchiveStatuses)[number];

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function expectedCameraArchiveKey(
  organisationId: string,
  roomId: string,
  deviceId: string,
  sessionId: string,
): string {
  for (const value of [organisationId, roomId, deviceId, sessionId]) {
    if (!uuidPattern.test(value)) throw new Error("Invalid cloud camera archive identifiers.");
  }
  return [organisationId, roomId, deviceId, sessionId + ".mp4"].join("/");
}

export function isCameraArchiveStatus(value: unknown): value is CameraArchiveStatus {
  return cameraArchiveStatuses.some((status) => status === value);
}

export function mayCheckCameraArchive(
  providerState: string,
  archiveStatus: string,
  attempts: number,
): boolean {
  return (
    providerState === "provider_completed" &&
    ["uninspected", "object_missing", "storage_error"].includes(archiveStatus) &&
    Number.isInteger(attempts) &&
    attempts >= 0 &&
    attempts < 5
  );
}

export function inspectCameraMp4(
  length: number | undefined,
  contentType: string | undefined,
  firstBytes: Uint8Array,
): "object_confirmed" | "invalid_object" {
  const mime = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  const allowedMime = !mime || mime === "video/mp4" || mime === "application/octet-stream";
  const header = firstBytes.length >= 12 &&
    firstBytes[4] === 0x66 &&
    firstBytes[5] === 0x74 &&
    firstBytes[6] === 0x79 &&
    firstBytes[7] === 0x70;
  if (
    !Number.isSafeInteger(length) ||
    (length ?? 0) < 1024 ||
    !allowedMime ||
    !header
  ) return "invalid_object";
  return "object_confirmed";
}

export function cameraArchiveStatusLabel(status: CameraArchiveStatus): string {
  switch (status) {
    case "uninspected":
      return "Private archive inspection pending";
    case "object_confirmed":
      return "Private MP4 object confirmed; review and safeguarding still required";
    case "object_missing":
      return "Private file not found; inspection will retry";
    case "invalid_object":
      return "Recorded file failed basic MP4 integrity checks";
    case "storage_error":
      return "Private storage check unavailable; inspection will retry";
    case "review_required":
      return "Manual archive investigation required";
  }
}
