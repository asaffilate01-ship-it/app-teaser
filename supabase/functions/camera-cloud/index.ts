// LiveKit access and S3 recording are only enabled with real server secrets.
import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  RoomServiceClient,
  S3Upload,
} from "npm:livekit-server-sdk@2.20.1";
import { handleOptions, json, requirePost, requireTrustedOrigin } from "../_shared/http.ts";
import { requireUser, requireOrganisationRole } from "../_shared/supabase.ts";

type Action = "token" | "start" | "stop" | "status";
interface CameraRequest {
  action: Action;
  roomId: string;
  deviceId: string;
  role?: "camera" | "director";
}
const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const activeStates = ["starting", "recording", "stopping"] as const;

function parseBody(input: unknown): CameraRequest {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid camera request.");
  const body = input as Record<string, unknown>;
  if (
    !["token", "start", "stop", "status"].includes(String(body.action)) ||
    typeof body.roomId !== "string" ||
    !uuid.test(body.roomId) ||
    typeof body.deviceId !== "string" ||
    !uuid.test(body.deviceId) ||
    (body.role !== undefined && body.role !== "camera" && body.role !== "director")
  )
    throw new Error("Invalid camera request.");
  return body as unknown as CameraRequest;
}

function cloudConfig() {
  if (Deno.env.get("CRICLUME_CLOUD_CAPTURE_ENABLED") !== "true")
    throw new Error("Cloud capture has not been activated.");
  const endpoint = Deno.env.get("LIVEKIT_URL") ?? "";
  const key = Deno.env.get("LIVEKIT_API_KEY") ?? "";
  const secret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("LiveKit URL unavailable.");
  }
  if (
    parsed.protocol !== "wss:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  )
    throw new Error("LiveKit requires an approved WSS URL.");
  if (!key || secret.length < 32) throw new Error("LiveKit server credentials unavailable.");
  return { wsUrl: parsed.toString(), httpsUrl: "https://" + parsed.host, key, secret };
}

function outputStorage() {
  const accessKey = Deno.env.get("CRICLUME_CAPTURE_S3_ACCESS_KEY") ?? "";
  const secret = Deno.env.get("CRICLUME_CAPTURE_S3_SECRET_KEY") ?? "";
  const bucket = Deno.env.get("CRICLUME_CAPTURE_S3_BUCKET") ?? "";
  const region = Deno.env.get("CRICLUME_CAPTURE_S3_REGION") ?? "";
  const endpoint = Deno.env.get("CRICLUME_CAPTURE_S3_ENDPOINT") ?? "";
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Private cloud recording storage unavailable.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !accessKey ||
    !secret ||
    !bucket ||
    !region
  )
    throw new Error("Private cloud recording storage unavailable.");
  return new S3Upload({
    accessKey,
    secret,
    bucket,
    region,
    endpoint: url.toString(),
    forcePathStyle: true,
  });
}

const cameraName = (roomId: string, deviceId: string) => "criclume-" + roomId + "-" + deviceId;
const cameraIdentity = (deviceId: string) => "camera-" + deviceId;

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    requirePost(request);
    requireTrustedOrigin(request);
    if (Number(request.headers.get("content-length") ?? "0") > 4096)
      return json({ error: "Request too large." }, 413, request);
    const { client, user } = await requireUser(request);
    const body = parseBody(await request.json());
    const config = cloudConfig();

    // All identifiers and grants are derived from a verified user, room and device.
    const { data: room, error: roomError } = await client
      .from("camera_rooms")
      .select("id,match_id,status,matches!inner(owner_organisation_id)")
      .eq("id", body.roomId)
      .maybeSingle();
    if (roomError || !room || room.status !== "open")
      return json({ error: "Active camera room unavailable." }, 404, request);
    const match = room.matches as unknown as { owner_organisation_id: string };
    const orgId = match.owner_organisation_id;
    const { data: device, error: deviceError } = await client
      .from("camera_devices")
      .select("id,room_id,user_id")
      .eq("id", body.deviceId)
      .eq("room_id", room.id)
      .maybeSingle();
    if (deviceError || !device) return json({ error: "Paired camera unavailable." }, 404, request);

    const isOperator = device.user_id === user.id;
    let isDirector = false;
    try {
      await requireOrganisationRole(client, user.id, orgId, [
        "owner",
        "league_admin",
        "club_admin",
        "coach",
        "scorer",
      ]);
      isDirector = true;
    } catch {
      const { data: assignment } = await client
        .from("match_assignments")
        .select("user_id")
        .eq("match_id", room.match_id)
        .eq("user_id", user.id)
        .eq("role", "scorer")
        .maybeSingle();
      isDirector = Boolean(assignment);
    }
    if (!isOperator && !isDirector) return json({ error: "Camera access denied." }, 403, request);

    const { data: arm, error: armError } = await client
      .from("camera_recording_arms")
      .select("armed,consent_confirmed")
      .eq("room_id", body.roomId)
      .eq("device_id", body.deviceId)
      .maybeSingle();
    if (armError) throw armError;

    const cloudRoom = cameraName(body.roomId, body.deviceId);
    const participant = cameraIdentity(body.deviceId);
    if (body.action === "token") {
      if (body.role === "camera" && (!isOperator || !arm?.armed || !arm?.consent_confirmed))
        return json(
          { error: "Camera owner and confirmed recording permission required." },
          403,
          request,
        );
      if (body.role !== "camera" && (!isDirector || body.role !== "director"))
        return json({ error: "Director access required." }, 403, request);
      const token = new AccessToken(config.key, config.secret, {
        identity: body.role === "camera" ? participant : "director-" + crypto.randomUUID(),
        ttl: 300,
      });
      token.addGrant({
        roomJoin: true,
        room: cloudRoom,
        canPublish: body.role === "camera",
        canSubscribe: body.role === "director",
        canPublishData: false,
      });
      return json({ url: config.wsUrl, token: await token.toJwt(), expiresIn: 300 }, 200, request);
    }

    if (body.action === "status") {
      const { data, error } = await client
        .from("camera_cloud_recordings")
        .select("id,device_id,state,provider_status,created_at,updated_at,ended_at,start_source")
        .eq("room_id", body.roomId)
        .eq("device_id", body.deviceId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return json({ recordings: data ?? [] }, 200, request);
    }

    if (body.action === "start") {
      if (!isDirector) return json({ error: "Director access required." }, 403, request);
      if (!arm?.armed || !arm?.consent_confirmed)
        return json({ error: "Phone is not armed with recording permission." }, 409, request);
      const { data: ongoing, error: existingError } = await client
        .from("camera_cloud_recordings")
        .select("id,state")
        .eq("device_id", body.deviceId)
        .in("state", [...activeStates])
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;
      if (ongoing)
        return json({ recordingId: ongoing.id, status: ongoing.state, reused: true }, 200, request);

      const participants = await new RoomServiceClient(
        config.httpsUrl,
        config.key,
        config.secret,
      ).listParticipants(cloudRoom);
      if (!participants.some((item) => item.identity === participant))
        return json(
          { error: "Phone has not connected its camera to cloud capture." },
          409,
          request,
        );

      // Reserve an atomic one-active-egress slot before making a chargeable call.
      const recordingId = crypto.randomUUID();
      const path = orgId + "/" + body.roomId + "/" + body.deviceId + "/" + recordingId + ".mp4";
      const { error: insertError } = await client.from("camera_cloud_recordings").insert({
        id: recordingId,
        room_id: body.roomId,
        device_id: body.deviceId,
        requested_by: user.id,
        object_path: path,
        provider_room_name: cloudRoom,
        state: "starting",
      });
      if (insertError) {
        if (insertError.code === "23505")
          return json({ error: "Recording already starting for this camera." }, 409, request);
        throw insertError;
      }
      let egressId: string | null = null;
      try {
        const output = new EncodedFileOutput({
          filepath: path,
          output: { case: "s3", value: outputStorage() },
        });
        const egressClient = new EgressClient(config.httpsUrl, config.key, config.secret);
        const started = await egressClient.startParticipantEgress(cloudRoom, participant, {
          file: output,
        });
        egressId = started.egressId;
        if (!egressId) throw new Error("Provider did not return an egress ID.");
        const providerState = started.status === 1 ? "recording" : "starting";
        const { error: saveError } = await client
          .from("camera_cloud_recordings")
          .update({
            provider_egress_id: egressId,
            state: providerState,
            provider_status: started.status,
            provider_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", recordingId)
          .eq("state", "starting");
        if (saveError) throw saveError;
        return json({ recordingId, status: providerState, reused: false }, 202, request);
      } catch {
        if (egressId) {
          try {
            await new EgressClient(config.httpsUrl, config.key, config.secret).stopEgress(egressId);
          } catch {
            // Operator must reconcile any remote provider job that survived a partial failure.
          }
        }
        await client
          .from("camera_cloud_recordings")
          .update({ state: "failed", updated_at: new Date().toISOString() })
          .eq("id", recordingId);
        return json({ error: "Provider refused recording or private storage." }, 503, request);
      }
    }

    if (body.action === "stop") {
      const { data: session, error: sessionError } = await client
        .from("camera_cloud_recordings")
        .select("id,state,provider_egress_id")
        .eq("device_id", body.deviceId)
        .eq("room_id", body.roomId)
        .in("state", [...activeStates])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sessionError) throw sessionError;
      if (!session) return json({ error: "No provider-side recording is active." }, 404, request);
      if (session.state === "stopping")
        return json({ recordingId: session.id, status: "stopping", reused: true }, 200, request);
      if (!session.provider_egress_id)
        return json({ error: "Provider start has not been confirmed." }, 409, request);
      await new EgressClient(config.httpsUrl, config.key, config.secret).stopEgress(
        session.provider_egress_id,
      );
      const { data: updated, error } = await client
        .from("camera_cloud_recordings")
        .update({ state: "stopping", updated_at: new Date().toISOString() })
        .eq("id", session.id)
        .in("state", ["starting", "recording"])
        .select("state")
        .maybeSingle();
      if (error) throw error;
      if (!updated) {
        const { data: current } = await client
          .from("camera_cloud_recordings")
          .select("state")
          .eq("id", session.id)
          .maybeSingle();
        return json(
          { recordingId: session.id, status: current?.state ?? "stopping" },
          200,
          request,
        );
      }
      return json({ recordingId: session.id, status: updated.state }, 202, request);
    }
    return json({ error: "Unsupported camera action." }, 400, request);
  } catch {
    return json(
      {
        error:
          "Cloud capture unavailable or authorisation failed. Check configuration and permissions.",
      },
      503,
      request,
    );
  }
});
