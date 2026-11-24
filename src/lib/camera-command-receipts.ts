/** Reconciles private camera commands without silently replaying old START requests. */
export type CameraRecordingAction = "start" | "stop";
export type CameraCommandOutcome =
  "started" | "already_recording" | "stopped" | "already_stopped" | "blocked" | "failed";

export type CameraCommandReason =
  "none" | "missing_consent" | "not_armed" | "preview_off" | "capture_failed";

export interface CameraCommand {
  id: string;
  device_id: string;
  action: CameraRecordingAction;
  created_at: string;
}

export interface CameraCommandCursor {
  id: string;
  timestampMs: number;
}

export interface CameraReceiptResult {
  outcome: CameraCommandOutcome;
  reason_code: CameraCommandReason;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const commandMaxAgeMs = 120_000;

export function nextCameraCommand(
  value: unknown,
  deviceId: string,
  last: CameraCommandCursor | null,
  nowMs: number,
): { command: CameraCommand; cursor: CameraCommandCursor } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    !uuid.test(deviceId) ||
    typeof candidate["id"] !== "string" ||
    !uuid.test(candidate["id"]) ||
    candidate["device_id"] !== deviceId ||
    (candidate["action"] !== "start" && candidate["action"] !== "stop") ||
    typeof candidate["created_at"] !== "string"
  )
    return null;
  const timestampMs = Date.parse(candidate["created_at"]);
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(timestampMs) ||
    timestampMs > nowMs + 5000 ||
    nowMs - timestampMs > commandMaxAgeMs
  )
    return null;
  if (
    last &&
    (timestampMs < last.timestampMs ||
      (timestampMs === last.timestampMs && candidate["id"] <= last.id))
  )
    return null;
  return {
    command: {
      id: candidate["id"],
      device_id: deviceId,
      action: candidate["action"],
      created_at: candidate["created_at"],
    },
    cursor: { id: candidate["id"], timestampMs },
  };
}

export function reportCameraCommandResult(input: {
  action: CameraRecordingAction;
  before: boolean;
  after: boolean;
  consent: boolean;
  armed: boolean;
  previewing: boolean;
}): CameraReceiptResult {
  if (input.action === "stop") {
    if (!input.before) return { outcome: "already_stopped", reason_code: "none" };
    return input.after
      ? { outcome: "failed", reason_code: "capture_failed" }
      : { outcome: "stopped", reason_code: "none" };
  }
  if (input.before) return { outcome: "already_recording", reason_code: "none" };
  if (!input.consent) return { outcome: "blocked", reason_code: "missing_consent" };
  if (!input.armed) return { outcome: "blocked", reason_code: "not_armed" };
  if (!input.previewing) return { outcome: "blocked", reason_code: "preview_off" };
  return input.after
    ? { outcome: "started", reason_code: "none" }
    : { outcome: "failed", reason_code: "capture_failed" };
}

export function commandReceiptLabel(
  action: CameraRecordingAction,
  outcome?: CameraCommandOutcome,
  reason?: CameraCommandReason,
): string {
  if (!outcome) return "No phone acknowledgment yet";
  if (outcome === "started") return "Phone reported recording started";
  if (outcome === "already_recording") return "Phone reported it was already recording";
  if (outcome === "stopped") return "Phone reported recording stopped";
  if (outcome === "already_stopped") return "Phone reported it was already stopped";
  if (outcome === "failed") return "Phone reported a recorder error";
  if (action === "start" && outcome === "blocked") {
    const codes: Record<string, string> = {
      missing_consent: "Phone declined: recording permission missing",
      not_armed: "Phone declined: automatic recording not armed",
      preview_off: "Phone declined: camera preview is off",
    };
    return codes[reason ?? ""] ?? "Phone declined recording";
  }
  return "Phone response not verified";
}

/** Phone presence is advisory and must expire when its heartbeat is no longer current. */
export function freshCameraPresence<
  T extends { deviceId: string; lastSeenAt: string; recording: boolean },
>(
  presence: T | undefined,
  deviceId: string,
  nowMs: number,
): T | undefined {
  if (!presence || presence.deviceId !== deviceId || typeof presence.recording !== "boolean")
    return undefined;
  const timestamp = Date.parse(presence.lastSeenAt);
  if (!Number.isFinite(timestamp) || !Number.isFinite(nowMs)) return undefined;
  if (timestamp > nowMs + 5_000 || nowMs - timestamp > 45_000) return undefined;
  return presence;
}

/** Acknowledgments must refer to both the command and the phone that received it. */
export function matchingCameraReceipt<T extends { command_id: string; device_id: string }>(
  command: Pick<CameraCommand, "id" | "device_id">,
  receipts: readonly T[],
): T | undefined {
  return receipts.find(
    (receipt) => receipt.command_id === command.id && receipt.device_id === command.device_id,
  );
}
