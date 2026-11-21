// Pure, conservative alignment helpers for recorded match video.
// These timestamps come from independent device clocks and are NOT
// validated synchronization, ball detection or automated umpiring evidence.

export type CameraClip = {
  id: string;
  device_id: string;
  started_at: string;
  ended_at: string | null;
  storage_path: string | null;
  status: string;
  recording_consent: string;
  retention_expires_at: string;
  blur_mode: "none" | "faces" | "people";
};

export type CameraDelivery = {
  id: string;
  sequence: number;
  over_number: number;
  ball_in_over: number;
  occurred_at: string;
  total_runs: number;
  wicket: boolean;
};

export type ReplayCue = {
  clipId: string;
  deviceId: string;
  deliveryId: string;
  deliverySequence: number;
  label: string;
  seekSeconds: number;
  alignment: "device-clock-estimate";
};

export function storageVideoMimeType(type: string): "video/mp4" | "video/webm" {
  const base = type.toLowerCase().split(";")[0]?.trim();
  if (base === "video/mp4") return "video/mp4";
  if (base === "video/webm") return "video/webm";
  throw new Error("Unsupported camera recording type.");
}

export function isReviewableClip(clip: CameraClip, nowMs: number): boolean {
  const until = Date.parse(clip.retention_expires_at);
  const start = Date.parse(clip.started_at);
  return Boolean(
    clip.id &&
      clip.device_id &&
      clip.storage_path &&
      ["uploaded", "processing", "ready"].includes(clip.status) &&
      clip.recording_consent === "granted" &&
      Number.isFinite(start) &&
      Number.isFinite(until) &&
      until > nowMs,
  );
}

export function estimateDeliveryCues(
  clips: readonly CameraClip[],
  deliveries: readonly CameraDelivery[],
  nowMs: number,
): ReplayCue[] {
  const result: ReplayCue[] = [];
  for (const clip of clips) {
    if (!isReviewableClip(clip, nowMs) || !clip.ended_at) continue;
    const start = Date.parse(clip.started_at);
    const end = Date.parse(clip.ended_at);
    if (!Number.isFinite(end) || end <= start) continue;
    for (const delivery of deliveries) {
      const when = Date.parse(delivery.occurred_at);
      if (!Number.isFinite(when) || when < start || when >= end) continue;
      const preRollMs = 3_000;
      const seekSeconds = Math.max(0, (when - start - preRollMs) / 1_000);
      result.push({
        clipId: clip.id,
        deviceId: clip.device_id,
        deliveryId: delivery.id,
        deliverySequence: delivery.sequence,
        label:
          "Over " +
          (delivery.over_number + 1) +
          " · Ball " +
          delivery.ball_in_over +
          (delivery.wicket ? " · WICKET" : " · " + delivery.total_runs + " runs"),
        seekSeconds,
        alignment: "device-clock-estimate",
      });
    }
  }
  return result.sort(
    (a, b) =>
      a.deliverySequence - b.deliverySequence ||
      a.deviceId.localeCompare(b.deviceId) ||
      a.clipId.localeCompare(b.clipId),
  );
}
