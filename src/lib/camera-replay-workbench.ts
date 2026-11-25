import type { CameraClip, CameraDelivery } from "./camera-review";

/** Metadata-level alignment only. Independent clocks can drift and must be checked by a reviewer. */
export interface ClipCalibration {
  asset_id: string;
  offset_ms: number;
  calibrated_by: string;
  calibrated_at: string;
}

export type HighlightKind = "wicket" | "boundary" | "fielding" | "other";

export interface PrivateHighlightCandidate {
  id: string;
  asset_id: string;
  delivery_id: string | null;
  at_ms: number;
  duration_ms: number;
  kind: HighlightKind;
  note: string | null;
  created_by: string;
  created_at: string;
}

export const calibrationLimitMs = 30_000;
export const maxHighlightDurationMs = 30_000;

export function validCalibrationOffset(value: number): boolean {
  return Number.isInteger(value) && Math.abs(value) <= calibrationLimitMs;
}

export function clipClockStart(clip: CameraClip, offsetMs: number): number {
  const start = Date.parse(clip.started_at);
  if (!Number.isFinite(start) || !validCalibrationOffset(offsetMs)) return Number.NaN;
  return start + offsetMs;
}

export function syncedSecondarySeconds(
  primary: CameraClip,
  secondary: CameraClip,
  primarySeconds: number,
  primaryOffsetMs: number,
  secondaryOffsetMs: number,
): number | null {
  const startA = clipClockStart(primary, primaryOffsetMs);
  const startB = clipClockStart(secondary, secondaryOffsetMs);
  if (
    !Number.isFinite(startA) ||
    !Number.isFinite(startB) ||
    !Number.isFinite(primarySeconds) ||
    primarySeconds < 0
  )
    return null;
  const second = (startA + primarySeconds * 1000 - startB) / 1000;
  const duration = clipDurationSeconds(secondary);
  if (duration === null || second < 0 || second >= duration) return null;
  return second;
}

export function clipDurationSeconds(clip: CameraClip): number | null {
  const start = Date.parse(clip.started_at);
  const end = Date.parse(clip.ended_at ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return (end - start) / 1000;
}

export function syncedDeliverySeconds(
  clip: CameraClip,
  delivery: CameraDelivery,
  offsetMs: number,
  preRollMs = 3000,
): number | null {
  const start = clipClockStart(clip, offsetMs);
  const deliveryAt = Date.parse(delivery.occurred_at);
  const duration = clipDurationSeconds(clip);
  if (!Number.isFinite(start) || !Number.isFinite(deliveryAt) || duration === null) return null;
  if (!Number.isFinite(preRollMs) || preRollMs < 0) return null;
  const moment = (deliveryAt - start) / 1000;
  if (moment < 0 || moment >= duration) return null;
  return Math.max(0, moment - preRollMs / 1000);
}

export function canMarkPrivateHighlight(
  clip: CameraClip,
  seconds: number,
  durationMs: number,
  nowMs: number,
): boolean {
  const duration = clipDurationSeconds(clip);
  return (
    clip.recording_consent === "granted" &&
    Boolean(clip.storage_path) &&
    ["uploaded", "processing", "ready"].includes(clip.status) &&
    Date.parse(clip.retention_expires_at) > nowMs &&
    Number.isFinite(seconds) &&
    seconds >= 0 &&
    duration !== null &&
    seconds < duration &&
    seconds * 1000 + durationMs <= duration * 1000 &&
    Number.isInteger(durationMs) &&
    durationMs >= 1000 &&
    durationMs <= maxHighlightDurationMs
  );
}

export function redactHighlightNote(value: string): string {
  return value.trim().slice(0, 240);
}
