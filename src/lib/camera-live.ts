import type { RealtimeChannel } from "@supabase/supabase-js";
import { getCloudClient } from "@/lib/cloud";

// This transport is for private, small-team live review; server-side SFU/egress is
// required before public broadcast or unattended recording can be advertised.
export type LiveConnectionState = "connecting" | "connected" | "disconnected" | "failed";

type SignalKind = "ready" | "watch" | "offer" | "answer" | "ice" | "leave";
interface CameraSignal {
  kind: SignalKind;
  from: string;
  to?: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface LiveCameraSession {
  watch: (deviceId: string) => Promise<void>;
  announce: () => Promise<void>;
  close: () => void;
}

export interface LiveCameraOptions {
  roomId: string;
  identity: string;
  mode: "director" | "camera";
  stream?: MediaStream;
  onStream?: (deviceId: string, stream: MediaStream | null) => void;
  onStatus?: (deviceId: string, state: LiveConnectionState) => void;
  onReady?: (deviceId: string) => void;
  onError?: (message: string) => void;
}

interface Peer {
  connection: RTCPeerConnection;
  candidates: RTCIceCandidateInit[];
}

const supportedKinds = new Set<SignalKind>([
  "ready",
  "watch",
  "offer",
  "answer",
  "ice",
  "leave",
]);

export function isCameraSignal(value: unknown): value is CameraSignal {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    typeof message["kind"] === "string" &&
    supportedKinds.has(message["kind"] as SignalKind) &&
    typeof message["from"] === "string" &&
    message["from"].length > 0 &&
    message["from"].length <= 120 &&
    (message["to"] === undefined ||
      (typeof message["to"] === "string" && message["to"].length <= 120))
  );
}

function getIceServers(): RTCIceServer[] {
  // A club should configure its approved TURN service for mobile network access.
  // Without one, this peer-to-peer pilot may not connect across NATs.
  const server = import.meta.env["VITE_CAMERA_ICE_URL"]?.trim();
  const username = import.meta.env["VITE_CAMERA_ICE_USERNAME"]?.trim();
  const credential = import.meta.env["VITE_CAMERA_ICE_CREDENTIAL"]?.trim();
  return server
    ? [{ urls: server, ...(username && credential ? { username, credential } : {}) }]
    : [];
}

export async function connectLiveCamera(options: LiveCameraOptions): Promise<LiveCameraSession> {
  const { roomId, identity, mode, stream, onStream, onStatus, onReady, onError } = options;
  const client = getCloudClient();
  await client.realtime.setAuth();
  const channel: RealtimeChannel = client.channel("camera-live:" + roomId, {
    config: { private: true, broadcast: { ack: true } },
  });
  const peers = new Map<string, Peer>();
  let closed = false;
  let subscribed = false;

  async function send(message: CameraSignal): Promise<void> {
    if (closed || !subscribed) return;
    const result = await channel.send({ type: "broadcast", event: "rtc", payload: message });
    if (result !== "ok") throw new Error("Live camera signalling is unavailable.");
  }

  function release(remoteId: string): void {
    const peer = peers.get(remoteId);
    if (!peer) return;
    peers.delete(remoteId);
    peer.connection.onicecandidate = null;
    peer.connection.ontrack = null;
    peer.connection.onconnectionstatechange = null;
    peer.connection.close();
    if (mode === "director") onStream?.(remoteId, null);
    onStatus?.(remoteId, "disconnected");
  }

  function createPeer(remoteId: string): Peer {
    release(remoteId);
    const connection = new RTCPeerConnection({ iceServers: getIceServers() });
    const peer: Peer = { connection, candidates: [] };
    peers.set(remoteId, peer);
    if (mode === "camera" && stream) {
      stream.getTracks().forEach((track) => connection.addTrack(track, stream));
    }
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        void send({
          kind: "ice",
          from: identity,
          to: remoteId,
          candidate: event.candidate.toJSON(),
        }).catch((error: unknown) => onError?.(String(error)));
      }
    };
    connection.ontrack = (event) => {
      if (mode === "director") {
        const remote = event.streams[0];
        if (remote) onStream?.(remoteId, remote);
      }
    };
    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      if (state === "connected" || state === "connecting" || state === "disconnected" || state === "failed") {
        onStatus?.(remoteId, state);
      }
      if (state === "failed" || state === "closed") release(remoteId);
    };
    onStatus?.(remoteId, "connecting");
    return peer;
  }

  async function setRemote(peer: Peer, description: RTCSessionDescriptionInit): Promise<void> {
    await peer.connection.setRemoteDescription(description);
    for (const candidate of peer.candidates.splice(0)) {
      await peer.connection.addIceCandidate(candidate);
    }
  }

  async function receive(message: CameraSignal): Promise<void> {
    if (closed || message.from === identity || (message.to && message.to !== identity)) return;
    if (message.kind === "ready" && mode === "director") {
      onReady?.(message.from);
    } else if (message.kind === "watch" && mode === "camera" && stream) {
      const peer = createPeer(message.from);
      const offer = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(offer);
      await send({ kind: "offer", from: identity, to: message.from, description: offer });
    } else if (message.kind === "offer" && mode === "director" && message.description) {
      const peer = createPeer(message.from);
      await setRemote(peer, message.description);
      const answer = await peer.connection.createAnswer();
      await peer.connection.setLocalDescription(answer);
      await send({ kind: "answer", from: identity, to: message.from, description: answer });
    } else if (message.kind === "answer" && mode === "camera" && message.description) {
      const peer = peers.get(message.from);
      if (peer) await setRemote(peer, message.description);
    } else if (message.kind === "ice" && message.candidate) {
      const peer = peers.get(message.from);
      if (!peer) return;
      if (peer.connection.remoteDescription) {
        await peer.connection.addIceCandidate(message.candidate);
      } else {
        peer.candidates.push(message.candidate);
      }
    } else if (message.kind === "leave") {
      release(message.from);
    }
  }

  channel.on("broadcast", { event: "rtc" }, ({ payload }) => {
    if (isCameraSignal(payload)) {
      void receive(payload).catch((error: unknown) =>
        onError?.(error instanceof Error ? error.message : "Live video signalling failed."),
      );
    }
  });

  try {
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          subscribed = true;
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          reject(new Error(error?.message ?? "Private live-video access was denied."));
        }
      });
    });
  } catch (error) {
    void client.removeChannel(channel);
    throw error;
  }

  if (mode === "camera") {
    await send({ kind: "ready", from: identity });
  }

  return {
    watch: async (deviceId) => {
      if (mode !== "director") throw new Error("Only a director can request a live view.");
      await send({ kind: "watch", from: identity, to: deviceId });
    },
    announce: async () => {
      if (mode === "camera") await send({ kind: "ready", from: identity });
    },
    close: () => {
      if (closed) return;
      for (const remoteId of peers.keys()) {
        void send({ kind: "leave", from: identity, to: remoteId }).catch(() => {});
        release(remoteId);
      }
      closed = true;
      subscribed = false;
      void client.removeChannel(channel);
    },
  };
}
