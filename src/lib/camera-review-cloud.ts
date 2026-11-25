import { getCloudClient } from "@/lib/cloud";
import {
  currentReplaySource,
  isReviewableClip,
  requestedReplayUrlSeconds,
  type CameraClip,
} from "@/lib/camera-review";
import type { ReelDelivery } from "@/lib/highlight-reel";

export interface RoomReviewData {
  clips: CameraClip[];
  deliveries: ReelDelivery[];
}

export async function loadCameraRoomReview(
  roomId: string,
  matchId: string,
): Promise<RoomReviewData> {
  const client = getCloudClient();
  const [assets, balls] = await Promise.all([
    client
      .from("video_assets")
      .select(
        "id,device_id,started_at,ended_at,storage_path,status,recording_consent,retention_expires_at,blur_mode",
      )
      .eq("room_id", roomId)
      .eq("recording_consent", "granted")
      .in("status", ["uploaded", "processing", "ready"])
      .gt("retention_expires_at", new Date().toISOString())
      .order("started_at", { ascending: false })
      .limit(120),
    client
      .from("deliveries")
      .select(
        "id,sequence,over_number,ball_in_over,occurred_at,total_runs,wicket,batter_runs,striker_id,bowler_id",
      )
      .eq("match_id", matchId)
      .is("superseded_by", null)
      .is("voided_by_event_id", null)
      .order("sequence", { ascending: false })
      .limit(250),
  ]);
  if (assets.error) throw assets.error;
  if (balls.error) throw balls.error;
  return {
    clips: ((assets.data ?? []) as CameraClip[]).filter((clip) =>
      isReviewableClip(clip, Date.now()),
    ),
    deliveries: (balls.data ?? []) as ReelDelivery[],
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
