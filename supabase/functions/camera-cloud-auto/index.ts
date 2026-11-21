// Internal, secret-authenticated reconciliation of CricLume consented automatic
// cloud recording. This is a bounded cron job, not a browser endpoint.
import {
  EgressClient,
  EncodedFileOutput,
  RoomServiceClient,
  S3Upload,
} from "npm:livekit-server-sdk@2.20.1";
import { adminClient } from "../_shared/supabase.ts";
import { errorResponse, json, requireEnvironmentSecret, requirePost } from "../_shared/http.ts";
import {
  automaticCloudStopCause,
  canAutomaticallyStartCamera,
  cloudAutoDuration,
  cloudAutoQuota,
} from "../_shared/camera-auto-policy.ts";

type MatchInfo = { status: string; owner_organisation_id: string };
type RoomRow = { id: string; status: string; match_id: string; matches: MatchInfo };
type ArmRow = { device_id: string; room_id: string; armed: boolean; consent_confirmed: boolean };
type OptInRow = {
  device_id: string;
  room_id: string;
  enabled: boolean;
  adult_only_attested: boolean;
  operator_id: string;
};
type SessionRow = {
  id: string;
  room_id: string;
  device_id: string;
  state: string;
  created_at: string;
  provider_egress_id: string | null;
  provider_room_name: string;
  start_source: "director" | "match_state";
};
const activeStates = ["starting", "recording", "stopping"];

// Supabase's untyped relation payload can be a nested array or a single record;
// normalize both shapes and fail closed when the match is missing.
function normalizeRoom(value: {
  id: string; status: string; match_id: string;
  matches: MatchInfo | MatchInfo[] | null;
}): RoomRow {
  const joined = Array.isArray(value.matches) ? value.matches[0] : value.matches;
  return {
    id: value.id,
    status: value.status,
    match_id: value.match_id,
    matches: joined ?? { status: "unavailable", owner_organisation_id: "" },
  };
}


function provider() {
  const ws = Deno.env.get("LIVEKIT_URL") ?? "";
  const key = Deno.env.get("LIVEKIT_API_KEY") ?? "";
  const secret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
  let parsed: URL;
  try {
    parsed = new URL(ws);
  } catch {
    throw new Error("LiveKit endpoint missing.");
  }
  if (
    parsed.protocol !== "wss:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !key ||
    secret.length < 32
  )
    throw new Error("LiveKit provider is not configured securely.");
  return { httpsUrl: "https://" + parsed.host, key, secret };
}

function privateOutput() {
  const endpoint = Deno.env.get("CRICLUME_CAPTURE_S3_ENDPOINT") ?? "";
  const bucket = Deno.env.get("CRICLUME_CAPTURE_S3_BUCKET") ?? "";
  const region = Deno.env.get("CRICLUME_CAPTURE_S3_REGION") ?? "";
  const accessKey = Deno.env.get("CRICLUME_CAPTURE_S3_ACCESS_KEY") ?? "";
  const secret = Deno.env.get("CRICLUME_CAPTURE_S3_SECRET_KEY") ?? "";
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Private S3 storage missing.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    !bucket ||
    !region ||
    !accessKey ||
    !secret
  )
    throw new Error("Private S3 storage is not configured securely.");
  return new S3Upload({
    endpoint: url.toString(),
    bucket,
    region,
    accessKey,
    secret,
    forcePathStyle: true,
  });
}

const cloudRoom = (roomId: string, deviceId: string) => "criclume-" + roomId + "-" + deviceId;
const cameraIdentity = (deviceId: string) => "camera-" + deviceId;

Deno.serve(async (request) => {
  try {
    requirePost(request);
    await requireEnvironmentSecret(request, "x-cron-secret", "CRON_SECRET");
    if (Deno.env.get("CRICLUME_CLOUD_CAPTURE_ENABLED") !== "true")
      return json({ status: "disabled", detail: "Cloud capture is not enabled." });

    const autoEnabled = Deno.env.get("CRICLUME_CLOUD_AUTO_ENABLED") === "true";
    const maxActive = cloudAutoQuota(Deno.env.get("CRICLUME_CLOUD_AUTO_MAX_ACTIVE"));
    const maxMinutes = cloudAutoDuration(Deno.env.get("CRICLUME_CLOUD_MAX_MINUTES"));
    const nowMs = Date.now();
    const db = adminClient();
    const settings = provider();
    const egress = new EgressClient(settings.httpsUrl, settings.key, settings.secret);
    const roomsClient = new RoomServiceClient(settings.httpsUrl, settings.key, settings.secret);
    let stopped = 0;
    let started = 0;
    let blocked = 0;
    let errors = 0;
    let pendingProviderIds = 0;

    // STOP FIRST, even when auto-start was disabled after an incident.
    const { data: active, error: activeError } = await db
      .from("camera_cloud_recordings")
      .select(
        "id,room_id,device_id,state,created_at,provider_egress_id,provider_room_name,start_source",
      )
      .in("state", activeStates)
      .order("created_at", { ascending: true })
      .limit(120);
    if (activeError) throw activeError;

    const sessions = (active ?? []) as SessionRow[];
    const roomIds = [...new Set(sessions.map((s) => s.room_id))];
    const deviceIds = [...new Set(sessions.map((s) => s.device_id))];

    const [roomResult, armResult, optResult] = await Promise.all([
      roomIds.length
        ? db
            .from("camera_rooms")
            .select("id,status,match_id,matches!inner(status,owner_organisation_id)")
            .in("id", roomIds)
        : Promise.resolve({ data: [], error: null }),
      deviceIds.length
        ? db
            .from("camera_recording_arms")
            .select("device_id,room_id,armed,consent_confirmed")
            .in("device_id", deviceIds)
        : Promise.resolve({ data: [], error: null }),
      deviceIds.length
        ? db
            .from("camera_cloud_auto_opt_ins")
            .select("device_id,room_id,enabled,adult_only_attested,operator_id")
            .in("device_id", deviceIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (roomResult.error || armResult.error || optResult.error)
      throw new Error("Active camera eligibility could not be verified.");
    const byRoom = new Map((roomResult.data ?? []).map((r) => [r.id, normalizeRoom(r)]));
    const byArm = new Map((armResult.data ?? []).map((a) => [a.device_id, a as ArmRow]));
    const byOpt = new Map((optResult.data ?? []).map((o) => [o.device_id, o as OptInRow]));

    for (const session of sessions) {
      const room = byRoom.get(session.room_id);
      const arm = byArm.get(session.device_id);
      const opt = byOpt.get(session.device_id);
      const reason = automaticCloudStopCause({
        matchStatus: room?.matches?.status ?? "unavailable",
        roomStatus: room?.status ?? "unavailable",
        localArmed: Boolean(arm?.armed && arm.room_id === session.room_id),
        consentConfirmed: Boolean(arm?.consent_confirmed && arm.room_id === session.room_id),
        autoEnabled: autoEnabled && Boolean(opt?.enabled && opt.room_id === session.room_id),
        adultOnlyAttested: Boolean(opt?.adult_only_attested && opt.room_id === session.room_id),
        source: session.start_source,
        nowMs,
        startedAt: session.created_at,
        maxDurationMinutes: maxMinutes,
      });
      if (!reason || session.state === "stopping") continue;
      if (!session.provider_egress_id) {
        pendingProviderIds++;
        // Never declare a remote job stopped when its provider ID is unknown.
        continue;
      }
      try {
        await egress.stopEgress(session.provider_egress_id);
        const { error } = await db
          .from("camera_cloud_recordings")
          .update({ state: "stopping", updated_at: new Date().toISOString() })
          .eq("id", session.id)
          .in("state", ["starting", "recording"]);
        if (error) throw error;
        stopped++;
      } catch {
        // Leave it active so the next run retries, without falsely claiming stop.
        errors++;
      }
    }

    // Never begin new paid jobs unless BOTH operator and platform opt in.
    if (autoEnabled && pendingProviderIds === 0) {
      const { data: opted, error: optedError } = await db
        .from("camera_cloud_auto_opt_ins")
        .select("device_id,room_id,enabled,adult_only_attested,operator_id")
        .eq("enabled", true)
        .eq("adult_only_attested", true)
        .order("updated_at", { ascending: true })
        .limit(100);
      if (optedError) throw optedError;
      const candidates = (opted ?? []) as OptInRow[];
      const candidateRoomIds = [...new Set(candidates.map((o) => o.room_id))];
      const candidateDeviceIds = [...new Set(candidates.map((o) => o.device_id))];
      if (candidateRoomIds.length && candidateDeviceIds.length) {
        const [candidateRooms, candidateArms, candidateDevices, activeCount] = await Promise.all([
          db
            .from("camera_rooms")
            .select("id,status,match_id,matches!inner(status,owner_organisation_id)")
            .in("id", candidateRoomIds),
          db
            .from("camera_recording_arms")
            .select("device_id,room_id,armed,consent_confirmed")
            .in("device_id", candidateDeviceIds),
          db.from("camera_devices").select("id,room_id,user_id").in("id", candidateDeviceIds),
          db
            .from("camera_cloud_recordings")
            .select("id", { count: "exact", head: true })
            .in("state", activeStates),
        ]);
        if (
          candidateRooms.error ||
          candidateArms.error ||
          candidateDevices.error ||
          activeCount.error
        )
          throw new Error("Cloud candidate verification unavailable.");
        const rooms = new Map((candidateRooms.data ?? []).map((r) => [r.id, normalizeRoom(r)]));
        const arms = new Map((candidateArms.data ?? []).map((a) => [a.device_id, a as ArmRow]));
        const devices = new Map((candidateDevices.data ?? []).map((d) => [d.id, d]));
        let available = Math.max(0, maxActive - (activeCount.count ?? maxActive));
        // A small cap bounds both provider spend and external requests per cron tick.
        available = Math.min(available, 4);
        for (const candidate of candidates) {
          if (available <= 0) break;
          const room = rooms.get(candidate.room_id);
          const arm = arms.get(candidate.device_id);
          const device = devices.get(candidate.device_id);
          if (
            !room ||
            !device ||
            device.room_id !== candidate.room_id ||
            device.user_id !== candidate.operator_id
          ) {
            blocked++;
            continue;
          }
          if (
            !canAutomaticallyStartCamera({
              matchStatus: room.matches?.status ?? "unavailable",
              roomStatus: room.status,
              localArmed: Boolean(arm?.armed && arm.room_id === room.id),
              consentConfirmed: Boolean(arm?.consent_confirmed && arm.room_id === room.id),
              autoEnabled: candidate.enabled,
              adultOnlyAttested: candidate.adult_only_attested,
              publisherPresent: true, // checked against actual provider below
            })
          ) {
            blocked++;
            continue;
          }

          // Enforce one automatic attempt for this match room, even after failure.
          const { data: previous, error: previousError } = await db
            .from("camera_cloud_recordings")
            .select("id")
            .eq("room_id", room.id)
            .eq("device_id", candidate.device_id)
            .eq("start_source", "match_state")
            .limit(1);
          if (previousError) {
            errors++;
            continue;
          }
          if (previous?.length) continue;
          const { data: activeJob, error: ongoingError } = await db
            .from("camera_cloud_recordings")
            .select("id")
            .eq("device_id", candidate.device_id)
            .in("state", activeStates)
            .limit(1);
          if (ongoingError) {
            errors++;
            continue;
          }
          if (activeJob?.length) continue;

          const providerRoom = cloudRoom(room.id, candidate.device_id);
          const identity = cameraIdentity(candidate.device_id);
          try {
            const participants = await roomsClient.listParticipants(providerRoom);
            if (!participants.some((p) => p.identity === identity)) continue; // Never create a billed recording for an offline phone.

            // Recheck operator opt-in immediately before reserving a paid job.
            const [freshArm, freshOpt] = await Promise.all([
              db
                .from("camera_recording_arms")
                .select("armed,consent_confirmed")
                .eq("device_id", candidate.device_id)
                .eq("room_id", room.id)
                .maybeSingle(),
              db
                .from("camera_cloud_auto_opt_ins")
                .select("enabled,adult_only_attested")
                .eq("device_id", candidate.device_id)
                .eq("room_id", room.id)
                .maybeSingle(),
            ]);
            if (
              freshArm.error ||
              freshOpt.error ||
              !freshArm.data?.armed ||
              !freshArm.data?.consent_confirmed ||
              !freshOpt.data?.enabled ||
              !freshOpt.data?.adult_only_attested
            ) {
              blocked++;
              continue;
            }

            const id = crypto.randomUUID();
            const path =
              room.matches.owner_organisation_id +
              "/" +
              room.id +
              "/" +
              candidate.device_id +
              "/" +
              id +
              ".mp4";
            const { error: reserveError } = await db.from("camera_cloud_recordings").insert({
              id,
              room_id: room.id,
              device_id: candidate.device_id,
              requested_by: candidate.operator_id,
              provider_room_name: providerRoom,
              object_path: path,
              state: "starting",
              start_source: "match_state",
            });
            if (reserveError) {
              if (reserveError.code !== "23505") errors++;
              continue;
            }

            let providerEgressId: string | null = null;
            try {
              const output = new EncodedFileOutput({
                filepath: path,
                output: { case: "s3", value: privateOutput() },
              });
              const startedInfo = await egress.startParticipantEgress(providerRoom, identity, {
                file: output,
              });
              providerEgressId = startedInfo.egressId;
              if (!providerEgressId) throw new Error("Provider egress ID missing.");
              const { error: savedError } = await db
                .from("camera_cloud_recordings")
                .update({
                  provider_egress_id: providerEgressId,
                  state: startedInfo.status === 1 ? "recording" : "starting",
                  provider_status: startedInfo.status,
                  provider_updated_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", id)
                .eq("state", "starting");
              if (savedError) throw savedError;
              started++;
              available--;
            } catch {
              // Retain reservations for remote jobs with unknown outcome. If an
              // egress ID exists keep the active slot until provider stop/review.
              if (providerEgressId) {
                try {
                  await egress.stopEgress(providerEgressId);
                } catch {
                  // Keep this provider job reserved for a later stop attempt.
                }
                await db
                  .from("camera_cloud_recordings")
                  .update({
                    state: "stopping",
                    provider_egress_id: providerEgressId,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", id);
              } else {
                await db
                  .from("camera_cloud_recordings")
                  .update({ state: "failed", updated_at: new Date().toISOString() })
                  .eq("id", id);
              }
              errors++;
            }
          } catch {
            errors++;
          }
        }
      }
    }
    return json({
      status: "checked",
      autoStartEnabled: autoEnabled,
      started,
      stopped,
      blocked,
      errors,
      pendingProviderIds,
      checkedAt: new Date().toISOString(),
      // Deliberately never return provider credentials, participant identities or storage URLs.
    });
  } catch (error) {
    return errorResponse(error, 503);
  }
});
