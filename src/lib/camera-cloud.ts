import { Room, RoomEvent, Track } from "livekit-client";
import { getCloudClient } from "@/lib/cloud";

export type CameraCloudAction = "token" | "start" | "stop" | "status";
import { type CameraCloudState } from "@/lib/camera-cloud-status";
import type { CameraArchiveStatus } from "@/lib/camera-archive-policy";
export { cameraCloudLabel, cameraCloudActive } from "@/lib/camera-cloud-status";

export interface CameraCloudRecording {
  id: string;
  device_id: string;
  state: CameraCloudState;
  provider_status: number | null;
  start_source?: "director" | "match_state";
  archive_check_status: CameraArchiveStatus;
  archive_check_attempts: number;
  archive_object_bytes: number | null;
  archive_checked_at: string | null;
  camera_cloud_import_jobs?:
    | Array<{ state: string; failure_code: string | null }>
    | { state: string; failure_code: string | null }
    | null;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
}

interface TokenResponse {
  url: string;
  token: string;
  expiresIn: number;
}
interface StatusResponse {
  recordings: CameraCloudRecording[];
}
interface ControlResponse {
  recordingId: string;
  status: CameraCloudState;
  reused?: boolean;
}

export async function cameraCloudRequest<T>(
  action: CameraCloudAction,
  roomId: string,
  deviceId: string,
  role?: "camera" | "director",
): Promise<T> {
  const { data, error } = await getCloudClient().functions.invoke("camera-cloud", {
    body: { action, roomId, deviceId, ...(role ? { role } : {}) },
  });
  if (error)
    throw new Error("Cloud camera provider unavailable. Check activation and account access.");
  if (!data || data.error)
    throw new Error(
      typeof data?.error === "string" ? data.error : "Cloud camera request was not accepted.",
    );
  return data as T;
}

export const cameraCloudStatus = (roomId: string, deviceId: string) =>
  cameraCloudRequest<StatusResponse>("status", roomId, deviceId);

export const cameraCloudStart = (roomId: string, deviceId: string) =>
  cameraCloudRequest<ControlResponse>("start", roomId, deviceId);

export const cameraCloudStop = (roomId: string, deviceId: string) =>
  cameraCloudRequest<ControlResponse>("stop", roomId, deviceId);

export interface CameraCloudPublisher {
  close: () => Promise<void>;
}

export async function publishCameraToCloud(
  roomId: string,
  deviceId: string,
  stream: MediaStream,
  onDisconnected: () => void,
): Promise<CameraCloudPublisher> {
  if (!stream.active || stream.getVideoTracks().length === 0)
    throw new Error("Start an active camera preview before publishing.");
  const credentials = await cameraCloudRequest<TokenResponse>("token", roomId, deviceId, "camera");
  if (!credentials.url.startsWith("wss://") || !credentials.token)
    throw new Error("Provider returned an invalid camera connection.");
  const room = new Room({ adaptiveStream: true, dynacast: true });
  let closed = false;
  room.on(RoomEvent.Disconnected, () => {
    if (!closed) onDisconnected();
  });
  try {
    await room.connect(credentials.url, credentials.token);
    for (const track of stream.getTracks()) {
      await room.localParticipant.publishTrack(track, {
        name: track.kind === "video" ? "criclume-camera" : "criclume-audio",
        source: track.kind === "video" ? Track.Source.Camera : Track.Source.Microphone,
      });
    }
  } catch {
    closed = true;
    await room.disconnect(false);
    throw new Error("Cloud camera connection could not publish audio/video.");
  }
  return {
    close: async () => {
      if (closed) return;
      closed = true;
      // The original local preview and recording own the MediaStream tracks.
      await room.disconnect(false);
    },
  };
}
