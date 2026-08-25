import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";
import type { CricketMatch, Delivery, FieldZone, Innings, MatchFormat, Team } from "@/lib/cricket";
import type { PlatformRole } from "@/lib/platform";

export interface CloudConfiguration {
  url: string;
  publishableKey: string;
  projectRef: string;
}

export interface OrganisationMembership {
  organisationId: string;
  organisationName: string;
  organisationKind: "club" | "league" | "school" | "academy";
  role: PlatformRole;
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

function matchEventEnvelope(row: Record<string, unknown>): MatchEventEnvelope {
  return {
    id: String(row["id"]),
    matchId: String(row["match_id"] ?? row["matchId"]),
    sequence: Number(row["sequence"]),
    clientEventId: String(row["client_event_id"] ?? row["clientEventId"]),
    deviceId: String(row["device_id"] ?? row["deviceId"]),
    eventType: String(row["event_type"] ?? row["eventType"]),
    payload: (row["payload"] ?? {}) as Record<string, unknown>,
    occurredAt: String(row["occurred_at"] ?? row["occurredAt"]),
    recordedAt: String(row["recorded_at"] ?? row["recordedAt"]),
    recordedBy: String(row["recorded_by"] ?? row["recordedBy"]),
  };
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
      role: row.role as PlatformRole,
    };
  });
}

function isCricketMatch(value: unknown, matchId: string): value is CricketMatch {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CricketMatch>;
  return (
    candidate.id === matchId && Array.isArray(candidate.teams) && Array.isArray(candidate.innings)
  );
}

function cloudMatchStatus(value: unknown): CricketMatch["status"] {
  if (value === "completed") return "completed";
  if (value === "innings_break") return "innings-break";
  return "live";
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function formatForSettings(overs: number | null, inningsPerSide: number): MatchFormat {
  if (inningsPerSide === 2) return "Multi-day";
  if (overs === 10) return "T10";
  if (overs === 20) return "T20";
  if (overs === 50) return "ODI";
  return "Club";
}

export async function loadCloudMatchSnapshot(matchId: string): Promise<CricketMatch> {
  const client = getCloudClient();
  const { data: recentEvents, error: eventError } = await client
    .from("match_events")
    .select("payload")
    .eq("match_id", matchId)
    .order("sequence", { ascending: false })
    .limit(50);
  if (eventError) throw eventError;
  for (const row of recentEvents ?? []) {
    const payload = row.payload as Record<string, unknown> | null;
    const snapshot = payload?.["matchSnapshot"];
    if (isCricketMatch(snapshot, matchId)) return snapshot;
  }

  const { data: match, error: matchError } = await client
    .from("matches")
    .select(
      "id,status,created_at,updated_at,scheduled_at,started_at,weather,live_state,home_team_id,away_team_id,ground_id,rule_version_id",
    )
    .eq("id", matchId)
    .single();
  if (matchError) throw matchError;

  const teamIds = [match.home_team_id as string, match.away_team_id as string];
  const [teamsResult, squadsResult, inningsResult, deliveriesResult, groundResult, ruleResult] =
    await Promise.all([
      client.from("teams").select("id,name").in("id", teamIds),
      client
        .from("match_squads")
        .select("team_id,player_id,batting_position")
        .eq("match_id", matchId),
      client
        .from("innings")
        .select("id,innings_number,batting_team_id,bowling_team_id,status")
        .eq("match_id", matchId)
        .order("innings_number"),
      client
        .from("deliveries")
        .select(
          "id,innings_id,sequence,over_number,ball_in_over,striker_id,non_striker_id,bowler_id,end_name,delivery_style,outcome,batter_runs,extras,legal_ball,dismissal,fielding_zone,fielder_id,notes,occurred_at",
        )
        .eq("match_id", matchId)
        .is("superseded_by", null)
        .is("voided_by_event_id", null)
        .order("sequence"),
      match.ground_id
        ? client.from("grounds").select("name").eq("id", match.ground_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      match.rule_version_id
        ? client
            .from("competition_rule_versions")
            .select("rules")
            .eq("id", match.rule_version_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  for (const result of [
    teamsResult,
    squadsResult,
    inningsResult,
    deliveriesResult,
    groundResult,
    ruleResult,
  ]) {
    if (result.error) throw result.error;
  }

  const squadRows = squadsResult.data ?? [];
  const playerIds = squadRows.map((row) => row.player_id as string);
  const { data: playerRows, error: playerError } = playerIds.length
    ? await client.from("players").select("id,display_name").in("id", playerIds)
    : { data: [], error: null };
  if (playerError) throw playerError;
  const playerNames = new Map(
    (playerRows ?? []).map((row) => [row.id as string, row.display_name as string]),
  );

  const teamsById = new Map((teamsResult.data ?? []).map((row) => [row.id as string, row]));
  const teams = teamIds.map<Team>((teamId) => {
    const team = teamsById.get(teamId);
    const players = squadRows
      .filter((row) => row.team_id === teamId)
      .sort(
        (left, right) =>
          Number(left.batting_position ?? 999) - Number(right.batting_position ?? 999),
      )
      .map((row) => ({
        id: row.player_id as string,
        name: playerNames.get(row.player_id as string) ?? "Registered player",
      }));
    return { id: teamId, name: (team?.name as string | undefined) ?? "Team", players };
  }) as [Team, Team];
  if (teams.some((team) => team.players.length < 2)) {
    throw new Error("Both cloud squads need at least two registered players before scoring.");
  }

  const deliveriesByInnings = new Map<string, Delivery[]>();
  for (const row of deliveriesResult.data ?? []) {
    const inningsId = row.innings_id as string;
    const extras = (row.extras ?? {}) as Partial<Delivery["extras"]>;
    const delivery: Delivery = {
      id: row.id as string,
      sequence: Number(row.sequence),
      recordedAt: row.occurred_at as string,
      over: Number(row.over_number),
      ball: Number(row.ball_in_over),
      legal: Boolean(row.legal_ball),
      strikerId: row.striker_id as string,
      nonStrikerId: row.non_striker_id as string,
      bowlerId: row.bowler_id as string,
      end: (row.end_name as Delivery["end"]) ?? "Pavilion",
      deliveryStyle: (row.delivery_style as Delivery["deliveryStyle"]) ?? "Other",
      outcome: (row.outcome as Delivery["outcome"]) ?? "missed",
      batterRuns: Number(row.batter_runs),
      extras: {
        wide: Number(extras.wide ?? 0),
        noBall: Number(extras.noBall ?? 0),
        bye: Number(extras.bye ?? 0),
        legBye: Number(extras.legBye ?? 0),
        penalty: Number(extras.penalty ?? 0),
      },
      fieldZone: (row.fielding_zone as FieldZone | null) ?? "Not recorded",
      fielderId: (row.fielder_id as string | null) || undefined,
      dismissal: (row.dismissal as Delivery["dismissal"] | null) || undefined,
      note: (row.notes as string | null) || undefined,
    };
    deliveriesByInnings.set(inningsId, [...(deliveriesByInnings.get(inningsId) ?? []), delivery]);
  }

  const liveState = (match.live_state ?? {}) as Record<string, unknown>;
  const liveSettings = (liveState["settings"] ?? {}) as Record<string, unknown>;
  const ruleSettings = ((ruleResult.data?.rules ?? {}) as Record<string, unknown>) ?? {};
  const rawOvers = liveSettings["oversPerInnings"] ?? ruleSettings["oversPerInnings"];
  const oversPerInnings = rawOvers == null ? null : positiveInteger(rawOvers, 20);
  const inningsPerSide =
    positiveInteger(liveSettings["inningsPerSide"] ?? ruleSettings["inningsPerSide"], 1) === 2
      ? 2
      : 1;
  const ballsPerOver = positiveInteger(
    liveSettings["ballsPerOver"] ?? ruleSettings["ballsPerOver"],
    6,
  );
  const innings = (inningsResult.data ?? []).map<Innings>((row) => {
    const battingTeam = teams.find((team) => team.id === row.batting_team_id)!;
    const bowlingTeam = teams.find((team) => team.id === row.bowling_team_id)!;
    const inningsDeliveries = deliveriesByInnings.get(row.id as string) ?? [];
    const latest = inningsDeliveries.at(-1);
    return {
      id: row.id as string,
      number: Number(row.innings_number),
      battingTeamId: row.batting_team_id as string,
      bowlingTeamId: row.bowling_team_id as string,
      strikerId: latest?.strikerId ?? battingTeam.players[0]!.id,
      nonStrikerId: latest?.nonStrikerId ?? battingTeam.players[1]!.id,
      bowlerId: latest?.bowlerId ?? bowlingTeam.players[0]!.id,
      end: latest?.end ?? "Pavilion",
      status: row.status === "completed" ? "completed" : "live",
      deliveries: inningsDeliveries,
    };
  });
  if (innings.length === 0) throw new Error("The cloud match has no innings workspace.");

  const weather = (match.weather ?? {}) as Record<string, unknown>;
  return {
    id: matchId,
    createdAt: match.created_at as string,
    updatedAt: match.updated_at as string,
    status: cloudMatchStatus(match.status),
    settings: {
      format: formatForSettings(oversPerInnings, inningsPerSide),
      oversPerInnings,
      inningsPerSide,
      ballsPerOver,
      ground: (groundResult.data?.name as string | undefined) ?? "Ground not selected",
      weather: (weather["summary"] as string | undefined) ?? "Not recorded",
      startTime:
        (match.started_at as string | null) ??
        (match.scheduled_at as string | null) ??
        (match.created_at as string),
    },
    teams,
    innings,
  };
}

export async function startCloudInnings(input: {
  matchId: string;
  inningsNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
}): Promise<string> {
  const { data, error } = await getCloudClient().rpc("start_match_innings", {
    p_match_id: input.matchId,
    p_innings_number: input.inningsNumber,
    p_batting_team_id: input.battingTeamId,
    p_bowling_team_id: input.bowlingTeamId,
  });
  if (error) throw error;
  return data as string;
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
  matchSnapshot: Record<string, unknown>;
  liveState: Record<string, unknown>;
  occurredAt: string;
}): Promise<MatchEventEnvelope> {
  const { data, error } = await getCloudClient().rpc("record_delivery_v2", {
    p_match_id: input.matchId,
    p_innings_id: input.inningsId,
    p_client_event_id: input.clientEventId,
    p_device_id: input.deviceId,
    p_delivery: input.delivery,
    p_match_snapshot: input.matchSnapshot,
    p_live_state: input.liveState,
    p_occurred_at: input.occurredAt,
  });
  if (error) throw error;
  return matchEventEnvelope(data as Record<string, unknown>);
}

export async function voidLastCanonicalDelivery(input: {
  matchId: string;
  inningsId: string;
  clientEventId: string;
  deviceId: string;
  matchSnapshot: Record<string, unknown>;
  liveState: Record<string, unknown>;
  occurredAt: string;
}): Promise<MatchEventEnvelope> {
  const { data, error } = await getCloudClient().rpc("void_last_delivery_v1", {
    p_match_id: input.matchId,
    p_innings_id: input.inningsId,
    p_client_event_id: input.clientEventId,
    p_device_id: input.deviceId,
    p_match_snapshot: input.matchSnapshot,
    p_live_state: input.liveState,
    p_occurred_at: input.occurredAt,
  });
  if (error) throw error;
  return matchEventEnvelope(data as Record<string, unknown>);
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
  try {
    if (event.eventType === "delivery.recorded") {
      const inningsId = event.payload["inningsId"];
      const delivery = event.payload["delivery"];
      const matchSnapshot = event.payload["matchSnapshot"];
      const liveState = event.payload["liveState"];
      if (
        typeof inningsId !== "string" ||
        !delivery ||
        typeof delivery !== "object" ||
        !matchSnapshot ||
        typeof matchSnapshot !== "object" ||
        !liveState ||
        typeof liveState !== "object"
      ) {
        throw new Error("Canonical delivery event is incomplete.");
      }
      return await recordCanonicalDelivery({
        matchId: event.matchId,
        inningsId,
        clientEventId: event.clientEventId,
        deviceId: event.deviceId,
        delivery: delivery as Record<string, unknown>,
        matchSnapshot: matchSnapshot as Record<string, unknown>,
        liveState: liveState as Record<string, unknown>,
        occurredAt: event.occurredAt,
      });
    }
    if (event.eventType === "delivery.voided") {
      const inningsId = event.payload["inningsId"];
      const matchSnapshot = event.payload["matchSnapshot"];
      const liveState = event.payload["liveState"];
      if (
        typeof inningsId !== "string" ||
        !matchSnapshot ||
        typeof matchSnapshot !== "object" ||
        !liveState ||
        typeof liveState !== "object"
      ) {
        throw new Error("Delivery correction event is incomplete.");
      }
      return await voidLastCanonicalDelivery({
        matchId: event.matchId,
        inningsId,
        clientEventId: event.clientEventId,
        deviceId: event.deviceId,
        matchSnapshot: matchSnapshot as Record<string, unknown>,
        liveState: liveState as Record<string, unknown>,
        occurredAt: event.occurredAt,
      });
    }
    const { data, error } = await getCloudClient().rpc("append_match_event", {
      p_match_id: event.matchId,
      p_client_event_id: event.clientEventId,
      p_device_id: event.deviceId,
      p_event_type: event.eventType,
      p_payload: event.payload,
      p_occurred_at: event.occurredAt,
    });
    if (error) throw error;
    return matchEventEnvelope(data as Record<string, unknown>);
  } catch (error) {
    queuePendingEvent(event);
    throw error;
  }
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
      (message) => onEvent(matchEventEnvelope(message.new as Record<string, unknown>)),
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
