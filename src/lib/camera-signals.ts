export type CameraSignalKind = "ready" | "watch" | "offer" | "answer" | "ice" | "leave";

export interface CameraSignal {
  kind: CameraSignalKind;
  from: string;
  to?: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

const kinds = new Set<CameraSignalKind>([
  "ready",
  "watch",
  "offer",
  "answer",
  "ice",
  "leave",
]);

export function isCameraSignal(value: unknown): value is CameraSignal {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  const kind = message["kind"];
  if (typeof kind !== "string" || !kinds.has(kind as CameraSignalKind)) return false;
  if (
    typeof message["from"] !== "string" ||
    message["from"].length === 0 ||
    message["from"].length > 120
  ) return false;
  if (
    message["to"] !== undefined &&
    (typeof message["to"] !== "string" ||
      message["to"].length === 0 ||
      message["to"].length > 120)
  ) return false;
  if (kind === "offer" || kind === "answer") {
    const description = message["description"];
    if (!description || typeof description !== "object" || Array.isArray(description)) return false;
    const data = description as Record<string, unknown>;
    return data["type"] === kind &&
      typeof data["sdp"] === "string" &&
      data["sdp"].length > 0 &&
      data["sdp"].length <= 65_536;
  }
  if (kind === "ice") {
    const candidate = message["candidate"];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    const data = candidate as Record<string, unknown>;
    return typeof data["candidate"] === "string" && data["candidate"].length <= 4_096;
  }
  return true;
}
