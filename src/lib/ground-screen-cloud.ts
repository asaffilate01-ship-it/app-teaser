import { getCloudClient } from "@/lib/cloud";
import { loadCameraRoomReview, loadClipOffsets } from "@/lib/camera-review-cloud";
import type { CameraClip } from "@/lib/camera-review";
import { readGroundSettings, type GroundScreenSettings, type PublicBoardInput } from "@/lib/ground-board";

/** Published scoreboard (name-free) for a ground screen; null when the club has not made it public. */
export async function fetchPublicBoard(slug: string): Promise<(PublicBoardInput & { matchId: string }) | null> {
  const { data, error } = await getCloudClient().rpc("get_public_scoreboard", { p_slug: slug });
  if (error || !data) return null;
  return data as PublicBoardInput & { matchId: string };
}

/** Page settings for a published board (anyone can read them once the board is public). */
export async function fetchGroundSettings(slug: string): Promise<GroundScreenSettings> {
  const { data } = await getCloudClient().rpc("get_ground_screen", { p_slug: slug });
  return readGroundSettings(data);
}

/** Names the database allows on this public board (empty unless the club switched names on). */
export async function fetchGroundNames(slug: string): Promise<Record<string, string>> {
  const { data, error } = await getCloudClient().rpc("get_ground_screen_names", { p_slug: slug });
  if (error || !data || typeof data !== "object") return {};
  return data as Record<string, string>;
}

export interface GroundControlRow extends GroundScreenSettings {
  replayDeliveryId: string | null;
  replayRequestedAt: string | null;
}

/** Saved settings plus the latest replay request (club members and people on the match only). */
export async function loadGroundControl(matchId: string): Promise<GroundControlRow | null> {
  const { data, error } = await getCloudClient()
    .from("ground_screens")
    .select("mode,pages,interval_seconds,manual_page,replays,show_names,replay_delivery_id,replay_requested_at")
    .eq("match_id", matchId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...readGroundSettings(row),
    replayDeliveryId: (row["replay_delivery_id"] as string | null) ?? null,
    replayRequestedAt: (row["replay_requested_at"] as string | null) ?? null,
  };
}

export async function saveGroundScreen(matchId: string, settings: GroundScreenSettings): Promise<void> {
  const { error } = await getCloudClient().rpc("set_ground_screen", {
    p_match_id: matchId,
    p_mode: settings.mode,
    p_pages: settings.pages,
    p_interval_seconds: settings.intervalSeconds,
    p_manual_page: settings.manualPage,
    p_replays: settings.replays,
    p_show_names: settings.showNames,
  });
  if (error) throw error;
}

export interface ReplayCandidate {
  id: string;
  sequence: number;
  over_number: number;
  ball_in_over: number;
  occurred_at: string;
  wicket: boolean;
  batter_runs: number;
}

/** Recent wickets and boundaries whose batter and bowler both allow public highlights. */
export async function loadReplayCandidates(matchId: string): Promise<ReplayCandidate[]> {
  const { data, error } = await getCloudClient().rpc("ground_replay_candidates", { p_match_id: matchId });
  if (error) throw error;
  return (data ?? []) as ReplayCandidate[];
}

export async function requestGroundReplay(matchId: string, deliveryId: string): Promise<void> {
  const { error } = await getCloudClient().rpc("request_ground_replay", { p_match_id: matchId, p_delivery_id: deliveryId });
  if (error) throw error;
}

export interface MatchReplayFootage {
  clips: CameraClip[];
  offsets: Record<string, number>;
}

/** Every consented, still-kept recording from this match's camera rooms (private-recording access rules apply). */
export async function loadMatchFootage(matchId: string): Promise<MatchReplayFootage> {
  const { data: rooms, error } = await getCloudClient()
    .from("camera_rooms")
    .select("id")
    .eq("match_id", matchId)
    .order("opened_at", { ascending: false })
    .limit(4);
  if (error) throw error;
  const clips: CameraClip[] = [];
  const offsets: Record<string, number> = {};
  for (const room of (rooms ?? []) as Array<{ id: string }>) {
    const review = await loadCameraRoomReview(room.id, matchId);
    clips.push(...review.clips);
    Object.assign(offsets, await loadClipOffsets(room.id, review.clips.map((clip) => clip.id)));
  }
  return { clips, offsets };
}
