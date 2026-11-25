import { getCloudClient } from "@/lib/cloud";
import {
  currentReplaySource,
  isReviewableClip,
  requestedReplayUrlSeconds,
  type CameraClip,
} from "@/lib/camera-review";
import type { ReelDelivery } from "@/lib/highlight-reel";

import {
  boundedReviewRows,
  reviewClipLimit,
  reviewDeliveryLimit,
  validReviewWindow,
  type ReviewWindow,
} from "@/lib/replay-window";

export interface RoomReviewData {
  clips: CameraClip[];
  deliveries: ReelDelivery[];
  truncatedClips: boolean;
  truncatedDeliveries: boolean;
}

export async function loadCameraRoomReview(
  roomId: string,
  matchId: string,
  window: ReviewWindow | null = null,
): Promise<RoomReviewData> {
  if (window && !validReviewWindow(window)) throw new Error("Invalid review time window.");
  const client = getCloudClient();
  const now = new Date().toISOString();
  let assetsQuery = client
    .from("video_assets")
    .select(
      "id,device_id,started_at,ended_at,storage_path,status,recording_consent,retention_expires_at,blur_mode",
    )
    .eq("room_id", roomId)
    .eq("recording_consent", "granted")
    .in("status", ["uploaded", "processing", "ready"])
    .gt("retention_expires_at", now);
  let ballsQuery = client
    .from("deliveries")
    .select(
      "id,sequence,over_number,ball_in_over,occurred_at,total_runs,wicket,batter_runs,striker_id,bowler_id",
    )
    .eq("match_id", matchId)
    .is("superseded_by", null)
    .is("voided_by_event_id", null);
  if (window) {
    // A completed segment can begin before the window but still overlap it.
    assetsQuery = assetsQuery.lt("started_at", window.end).gt("ended_at", window.start);
    ballsQuery = ballsQuery.gte("occurred_at", window.start).lt("occurred_at", window.end);
  }
  const [assets, balls] = await Promise.all([
    assetsQuery
      .order("started_at", { ascending: false })
      .order("id")
      .limit(reviewClipLimit + 1),
    ballsQuery
      .order("sequence", { ascending: false })
      .order("id")
      .limit(reviewDeliveryLimit + 1),
  ]);
  if (assets.error) throw assets.error;
  if (balls.error) throw balls.error;
  const clips = boundedReviewRows((assets.data ?? []) as CameraClip[], reviewClipLimit);
  const deliveries = boundedReviewRows((balls.data ?? []) as ReelDelivery[], reviewDeliveryLimit);
  return {
    clips: clips.rows.filter((clip) => isReviewableClip(clip, Date.now())),
    deliveries: deliveries.rows,
    truncatedClips: clips.truncated,
    truncatedDeliveries: deliveries.truncated,
  };
}

export async function signedRoomClipUrl(clip: CameraClip): Promise<string> {
  if (!isReviewableClip(clip, Date.now())) {
    throw new Error("This recording is no longer available for review.");
  }
  const client = getCloudClient();
  const loadCurrent = async () => {
    const { data, error } = await client
      .from("video_assets")
      .select(
        "id,device_id,started_at,ended_at,storage_path,status,recording_consent,retention_expires_at,blur_mode",
      )
      .eq("id", clip.id)
      .maybeSingle();
    if (error) throw error;
    const current = data as CameraClip | null;
    if (!currentReplaySource(clip, current, Date.now()) || !current.storage_path) {
      throw new Error("Recording access or metadata changed. Refresh the private recording list.");
    }
    return current;
  };
  const current = await loadCurrent();
  // A requested blur is a processing policy, not merely a UI label. Never
  // expose the unblurred source when a blurred version was requested.
  const kind = current.blur_mode === "none" ? "proxy" : "blurred";
  const { data, error } = await client
    .from("video_variants")
    .select("storage_path")
    .eq("asset_id", current.id)
    .eq("kind", kind)
    .eq("status", "ready")
    .maybeSingle();
  if (error) throw error;
  if (kind === "blurred" && !data?.storage_path) {
    throw new Error("Privacy blurring is not complete; recording playback is blocked.");
  }
  const path = data?.storage_path || current.storage_path;
  // Check access and privacy again after the independent variant lookup.
  const latest = await loadCurrent();
  const seconds = requestedReplayUrlSeconds(latest, Date.now());
  if (!path || seconds === null) {
    throw new Error("Recording retention is ending. Playback is unavailable.");
  }
  const signed = await client.storage.from("match-video").createSignedUrl(path, seconds);
  if (signed.error) throw signed.error;
  if (!signed.data.signedUrl) throw new Error("Private recording access was denied.");
  return signed.data.signedUrl;
}

/** Display names for players in a reel list (staff-only screen; RLS decides what is visible). */
export async function loadReelPlayerNames(ids: readonly string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const { data, error } = await getCloudClient()
    .from("players")
    .select("id,display_name")
    .in("id", [...ids]);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((row) => [row.id, row.display_name]));
}

/** Manual timing offsets saved in the replay workbench, by clip id. */
export async function loadClipOffsets(
  roomId: string,
  clipIds: readonly string[],
): Promise<Record<string, number>> {
  if (clipIds.length === 0) return {};
  const { data, error } = await getCloudClient()
    .from("camera_clip_calibrations")
    .select("asset_id,offset_ms")
    .eq("room_id", roomId)
    .in("asset_id", [...clipIds]);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((row) => [row.asset_id, row.offset_ms]));
}
