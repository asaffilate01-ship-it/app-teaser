import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";

export interface CloudConfiguration {
  url: string;
  publishableKey: string;
  projectRef: string;
}

export interface OrganisationMembership {
  organisationId: string;
  organisationName: string;
  organisationKind: "club" | "league" | "school" | "academy";
  role: string;
}

export interface MatchEventEnvelope {
  id: string;
  matchId: string;
  sequence: number;
  clientEventId: string;
  deviceId: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  recordedAt: string;
  recordedBy: string;
}

export interface CameraPresence {
  deviceId: string;
  label: string;
  angle: string;
  batteryPercent?: number;
  signal?: "good" | "fair" | "poor";
  recording: boolean;
  clockOffsetMs: number;
  lastSeenAt: string;
}

const cloudUrl = import.meta.env["VITE_SUPABASE_URL"]?.trim() ?? "";
const cloudKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ?? "";
let browserClient: SupabaseClient | undefined;

export function cloudConfiguration(): CloudConfiguration | null {
  if (!cloudUrl || !cloudKey) return null;
  try {
    const host = new URL(cloudUrl).hostname;
    return {
      url: cloudUrl,
      publishableKey: cloudKey,
      projectRef: host.split(".")[0] ?? host,
    };
  } catch {
    return null;
  }
}

export function isCloudConfigured(): boolean {
  return cloudConfiguration() !== null;
}

export function getCloudClient(): SupabaseClient {
  const configuration = cloudConfiguration();
  if (!configuration) {
    throw new Error(
      "CricLume Cloud is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  if (!browserClient) {
    browserClient = createClient(configuration.url, configuration.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return browserClient;
}

export async function currentCloudSession(): Promise<Session | null> {
  if (!isCloudConfigured()) return null;
  const { data, error } = await getCloudClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function requestSignInLink(email: string, redirectTo: string): Promise<void> {
  const { error } = await getCloudClient().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function signOutCloud(): Promise<void> {
  const { error } = await getCloudClient().auth.signOut();
  if (error) throw error;
}

export async function listOrganisationMemberships(): Promise<OrganisationMembership[]> {
  const { data, error } = await getCloudClient()
    .from("organisation_members")
    .select("organisation_id, role, organisations!inner(name, kind)")
    .eq("status", "active");
  if (error) throw error;
  return (data ?? []).map((row) => {
    const organisation = row.organisations as unknown as {
      name: string;
      kind: OrganisationMembership["organisationKind"];
    };
    return {
      organisationId: row.organisation_id as string,
      organisationName: organisation.name,
      organisationKind: organisation.kind,
      role: row.role as string,
    };
  });
}

function storageQueueKey(matchId: string): string {
  return `criclume:cloud-queue:${matchId}`;
}

export interface PendingMatchEvent {
  matchId: string;
  clientEventId: string;
  deviceId: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export async function recordCanonicalDelivery(input: {
  matchId: string;
  inningsId: string;
  clientEventId: string;
  deviceId: string;
  delivery: Record<string, unknown>;
  liveState: Record<string, unknown>;
  occurredAt: string;
}): Promise<Record<string, unknown>> {
  const { data, error } = await getCloudClient().rpc("record_delivery_v1", {
    p_match_id: input.matchId,
    p_innings_id: input.inningsId,
    p_client_event_id: input.clientEventId,
    p_device_id: input.deviceId,
    p_delivery: input.delivery,
    p_live_state: input.liveState,
    p_occurred_at: input.occurredAt,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export function readPendingEvents(matchId: string): PendingMatchEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(
      localStorage.getItem(storageQueueKey(matchId)) ?? "[]",
    ) as PendingMatchEvent[];
  } catch {
    return [];
  }
}

export function queuePendingEvent(event: PendingMatchEvent): void {
  if (typeof window === "undefined") return;
  const pending = readPendingEvents(event.matchId);
  if (!pending.some((item) => item.clientEventId === event.clientEventId)) pending.push(event);
  localStorage.setItem(storageQueueKey(event.matchId), JSON.stringify(pending));
}

function persistPendingEvents(matchId: string, events: PendingMatchEvent[]): void {
  if (typeof window === "undefined") return;
  if (events.length === 0) localStorage.removeItem(storageQueueKey(matchId));
  else localStorage.setItem(storageQueueKey(matchId), JSON.stringify(events));
}

export async function appendMatchEvent(event: PendingMatchEvent): Promise<MatchEventEnvelope> {
  const { data, error } = await getCloudClient().rpc("append_match_event", {
    p_match_id: event.matchId,
    p_client_event_id: event.clientEventId,
    p_device_id: event.deviceId,
    p_event_type: event.eventType,
    p_payload: event.payload,
    p_occurred_at: event.occurredAt,
  });
  if (error) {
    queuePendingEvent(event);
    throw error;
  }
  return data as MatchEventEnvelope;
}

export async function flushPendingEvents(matchId: string): Promise<{
  sent: number;
  remaining: number;
}> {
  const pending = readPendingEvents(matchId);
  const remaining: PendingMatchEvent[] = [];
  let sent = 0;
  for (const event of pending) {
    try {
      await appendMatchEvent(event);
      sent += 1;
    } catch {
      remaining.push(event);
    }
  }
  persistPendingEvents(matchId, remaining);
  return { sent, remaining: remaining.length };
}

export function subscribeToMatchEvents(
  matchId: string,
  onEvent: (event: MatchEventEnvelope) => void,
  onStatus?: (status: string) => void,
): () => void {
  const client = getCloudClient();
  const channel = client
    .channel(`match:${matchId}:events`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "match_events",
        filter: `match_id=eq.${matchId}`,
      },
      (message) => onEvent(message.new as MatchEventEnvelope),
    )
    .subscribe((status) => onStatus?.(status));
  return () => {
    void client.removeChannel(channel);
  };
}

export async function joinCameraPresence(
  roomId: string,
  presence: CameraPresence,
  onPresence: (devices: CameraPresence[]) => void,
  onCommand: (command: Record<string, unknown>) => void,
): Promise<{ leave: () => void; update: (next: CameraPresence) => Promise<void> }> {
  const client = getCloudClient();
  await client.realtime.setAuth();
  const channel = client.channel(`camera:${roomId}`, {
    config: { private: true, presence: { key: presence.deviceId } },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const states = Object.values(channel.presenceState()).flat() as unknown as CameraPresence[];
      onPresence(states);
    })
    .on("broadcast", { event: "director-command" }, ({ payload }) => onCommand(payload))
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") await channel.track(presence);
    });

  return {
    leave: () => {
      void client.removeChannel(channel);
    },
    update: async (next) => {
      await channel.track(next);
    },
  };
}

export async function uploadVideoResumably(input: {
  roomId: string;
  organisationId: string;
  assetId: string;
  file: File | Blob;
  contentType: string;
  onProgress?: (uploaded: number, total: number) => void;
}): Promise<string> {
  const configuration = cloudConfiguration();
  if (!configuration) throw new Error("CricLume Cloud is not configured.");
  const { data } = await getCloudClient().auth.getSession();
  if (!data.session) throw new Error("Sign in before uploading video.");
  const objectName = `${input.organisationId}/${input.roomId}/${input.assetId}/source.webm`;

  return await new Promise((resolve, reject) => {
    const upload = new tus.Upload(input.file, {
      endpoint: `https://${configuration.projectRef}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3_000, 5_000, 10_000, 20_000],
      headers: { authorization: `Bearer ${data.session.access_token}` },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: "match-video",
        objectName,
        contentType: input.contentType,
        cacheControl: "3600",
      },
      onError: reject,
      onProgress: (uploaded, total) => input.onProgress?.(uploaded, total),
      onSuccess: () => resolve(objectName),
    });
    void upload.findPreviousUploads().then((previous) => {
      if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });
}

export async function invokePlatformFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await getCloudClient().functions.invoke(name, { body });
  if (error) throw error;
  return data as T;
}
