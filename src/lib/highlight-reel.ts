import { isReviewableClip, type CameraClip, type CameraDelivery } from "./camera-review.ts";
import { clipClockStart, clipDurationSeconds } from "./camera-replay-workbench.ts";

export type ReelKind = "boundaries" | "sixes" | "wickets" | "player";

/** A delivery with the extra details reels need (optional so older rows still load). */
export interface ReelDelivery extends CameraDelivery {
  batter_runs?: number | null;
  striker_id?: string | null;
  bowler_id?: string | null;
}

export interface ReelItem {
  deliveryId: string;
  sequence: number;
  clipId: string;
  deviceId: string;
  startSeconds: number;
  endSeconds: number;
  label: string;
  tone: "four" | "six" | "wicket";
}

export const maxReelItems = 40;

function qualifies(
  delivery: ReelDelivery,
  kind: ReelKind,
  playerId: string | null,
): ReelItem["tone"] | null {
  const runs = delivery.batter_runs ?? null;
  const tone: ReelItem["tone"] | null = delivery.wicket
    ? "wicket"
    : runs === 6
      ? "six"
      : runs === 4
        ? "four"
        : null;
  if (!tone) return null;
  switch (kind) {
    case "boundaries":
      return tone === "four" || tone === "six" ? tone : null;
    case "sixes":
      return tone === "six" ? tone : null;
    case "wickets":
      return tone === "wicket" ? tone : null;
    case "player": {
      if (!playerId) return null;
      if (delivery.striker_id === playerId) return tone; // their boundaries and their dismissal
      if (delivery.bowler_id === playerId && tone === "wicket") return tone; // wickets they took
      return null;
    }
  }
}

/**
 * Builds a highlight reel from recorded camera segments: each qualifying ball becomes a short clip
 * (pre-roll before the ball was recorded, post-roll after), cut from a camera that was recording at that moment.
 * Timing uses each device's clock plus any manual calibration offset, so it is an estimate, not frame-accurate.
 */
export function buildHighlightReel(input: {
  clips: readonly CameraClip[];
  deliveries: readonly ReelDelivery[];
  kind: ReelKind;
  playerId?: string | null;
  /** Manual calibration per clip id, in ms. */
  offsets?: Readonly<Record<string, number>>;
  /** Use this camera when it covers the ball; otherwise any camera that does. */
  preferDeviceId?: string | null;
  preRollMs?: number;
  postRollMs?: number;
  nowMs: number;
}): ReelItem[] {
  const pre = input.preRollMs ?? 5_000;
  const post = input.postRollMs ?? 5_000;
  if (!Number.isFinite(pre) || !Number.isFinite(post) || pre < 0 || post < 0) return [];
  const usable = input.clips
    .flatMap((clip) => {
      if (!isReviewableClip(clip, input.nowMs)) return [];
      const start = clipClockStart(clip, input.offsets?.[clip.id] ?? 0);
      const duration = clipDurationSeconds(clip);
      if (!Number.isFinite(start) || duration === null) return [];
      return [{ clip, start, duration }];
    })
    .sort(
      (a, b) =>
        Number(b.clip.device_id === input.preferDeviceId) -
          Number(a.clip.device_id === input.preferDeviceId) ||
        a.clip.started_at.localeCompare(b.clip.started_at),
    );
  const items: ReelItem[] = [];
  const ordered = [...input.deliveries].sort((a, b) => a.sequence - b.sequence);
  for (const delivery of ordered) {
    const tone = qualifies(delivery, input.kind, input.playerId ?? null);
    if (!tone) continue;
    const at = Date.parse(delivery.occurred_at);
    if (!Number.isFinite(at)) continue;
    for (const { clip, start, duration } of usable) {
      const moment = (at - start) / 1000;
      if (!Number.isFinite(moment) || moment < 0 || moment >= duration) continue;
      const startSeconds = Math.max(0, moment - pre / 1000);
      const endSeconds = Math.min(duration, moment + post / 1000);
      if (endSeconds - startSeconds < 1) continue;
      items.push({
        deliveryId: delivery.id,
        sequence: delivery.sequence,
        clipId: clip.id,
        deviceId: clip.device_id,
        startSeconds,
        endSeconds,
        label: `Over ${delivery.over_number}.${delivery.ball_in_over} · ${tone === "wicket" ? "WICKET" : tone === "six" ? "SIX" : "FOUR"}`,
        tone,
      });
      break;
    }
    if (items.length >= maxReelItems) break;
  }
  return items;
}

/** Total running time of a reel in seconds. */
export const reelLength = (items: readonly ReelItem[]) =>
  Math.round(items.reduce((sum, item) => sum + (item.endSeconds - item.startSeconds), 0));
