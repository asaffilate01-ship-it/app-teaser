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
    ["none", "faces", "people"].includes(clip.blur_mode) &&
    Number.isFinite(nowMs) &&
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
  const timeline = deliveries
    .map((delivery) => ({ delivery, when: Date.parse(delivery.occurred_at) }))
    .filter((item) => Number.isFinite(item.when))
    .sort((a, b) => a.when - b.when);
  const lowerBound = (time: number) => {
    let low = 0;
    let high = timeline.length;
    while (low < high) {
      const mid = low + Math.floor((high - low) / 2);
      if (timeline[mid]!.when < time) low = mid + 1;
      else high = mid;
    }
    return low;
  };
  for (const clip of clips) {
    if (!isReviewableClip(clip, nowMs) || !clip.ended_at) continue;
    const start = Date.parse(clip.started_at);
    const end = Date.parse(clip.ended_at);
    if (!Number.isFinite(end) || end <= start) continue;
    const first = lowerBound(start);
    const last = lowerBound(end);
    for (let index = first; index < last; index++) {
      const { delivery, when } = timeline[index]!;
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

/** Local playback window is deliberately shorter than the signed URL lifetime. */
export const privateReplayWindowMs = 240_000;

export function privateReplayDeadline(clip: CameraClip, nowMs: number): number | null {
  if (!Number.isFinite(nowMs) || !isReviewableClip(clip, nowMs)) return null;
  return Math.min(Date.parse(clip.retention_expires_at), nowMs + privateReplayWindowMs);
}

/** Changing a source, consent, blur requirement or retention policy invalidates the old preview. */
export function sameReplaySource(previous: CameraClip, current: CameraClip): boolean {
  return (
    previous.id === current.id &&
    previous.device_id === current.device_id &&
    previous.storage_path === current.storage_path &&
    previous.recording_consent === current.recording_consent &&
    previous.blur_mode === current.blur_mode &&
    previous.retention_expires_at === current.retention_expires_at
  );
}

export function replaySeekPosition(seconds: number, duration: number): number | null {
  if (!Number.isFinite(seconds) || !Number.isFinite(duration) || duration <= 0) return null;
  return Math.min(Math.max(0, seconds), Math.max(0, duration - 0.01));
}

/** A playback session may display only its original, still-eligible selected sources. */
export function privateReplaySelectionCurrent(
  originals: readonly CameraClip[],
  selected: readonly CameraClip[],
  deadline: number,
  nowMs: number,
): boolean {
  return (
    originals.length > 0 &&
    originals.length === selected.length &&
    Number.isFinite(deadline) &&
    Number.isFinite(nowMs) &&
    deadline > nowMs &&
    originals.every((clip, index) => {
      const current = selected[index];
      return (
        current !== undefined &&
        isReviewableClip(current, nowMs) &&
        sameReplaySource(clip, current) &&
        clip.started_at === current.started_at &&
        clip.ended_at === current.ended_at
      );
    })
  );
}

export function privateReplaySelectionDeadline(clips: readonly CameraClip[], nowMs: number) {
  if (!clips.length) return null;
  const deadlines = clips.map((clip) => privateReplayDeadline(clip, nowMs));
  if (deadlines.some((deadline) => deadline === null)) return null;
  return Math.min(...deadlines.map((deadline) => deadline ?? 0));
}

/** Never sign a stale selection after its consent, source or timing metadata changes. */
export function currentReplaySource(
  selected: CameraClip,
  current: CameraClip | null,
  nowMs: number,
): current is CameraClip {
  return (
    current !== null &&
    isReviewableClip(selected, nowMs) &&
    isReviewableClip(current, nowMs) &&
    sameReplaySource(selected, current) &&
    selected.started_at === current.started_at &&
    selected.ended_at === current.ended_at
  );
}

/** Client-side requested lifetime, leaving a small buffer for signing latency.
 * Storage authorisation and the server's clock remain authoritative.
 */
export function requestedReplayUrlSeconds(clip: CameraClip, nowMs: number): number | null {
  if (!isReviewableClip(clip, nowMs)) return null;
  const remaining = Math.floor((Date.parse(clip.retention_expires_at) - nowMs - 5000) / 1000);
  return remaining > 0 ? Math.min(300, remaining) : null;
}
