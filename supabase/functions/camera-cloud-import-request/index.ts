// Authorised reviewer approval ONLY. This endpoint never copies or serves footage.
import { handleOptions, json, requirePost, requireTrustedOrigin } from "../_shared/http.ts";
import { requireOrganisationRole, requireUser } from "../_shared/supabase.ts";
import {
  cloudImportEligible,
  privateImportRetentionDays,
} from "../../../src/lib/camera-import-policy.ts";

const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    requirePost(request);
    requireTrustedOrigin(request);
    if (Number(request.headers.get("content-length") ?? "0") > 4096)
      return json({ error: "Request too large." }, 413, request);
    const { client, user } = await requireUser(request);
    if (Deno.env.get("CRICLUME_PRIVATE_IMPORT_ENABLED") !== "true")
      return json({ error: "Private cloud import has not been enabled." }, 503, request);
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      return json({ error: "Invalid private review request." }, 400, request);
    const body = payload as Record<string, unknown>;
    if (
      Object.keys(body).some(
        (key) =>
          ![
            "recordingId",
            "recordingPermissionAttested",
            "includesJunior",
            "guardianPermissionAttested",
          ].includes(key),
      ) ||
      typeof body.recordingId !== "string" ||
      !uuid.test(body.recordingId) ||
      body.recordingPermissionAttested !== true ||
      typeof body.includesJunior !== "boolean" ||
      typeof body.guardianPermissionAttested !== "boolean" ||
      (body.includesJunior && !body.guardianPermissionAttested)
    )
      return json(
        { error: "Explicit recording and guardian permission declarations are required." },
        422,
        request,
      );

    const { data: recording, error: recordingError } = await client
      .from("camera_cloud_recordings")
      .select(
        "id,room_id,device_id,state,archive_check_status,archive_object_bytes,ended_at,provider_egress_id",
      )
      .eq("id", body.recordingId)
      .maybeSingle();
    if (recordingError || !recording)
      return json({ error: "Private recording unavailable." }, 404, request);

    const { data: room, error: roomError } = await client
      .from("camera_rooms")
      .select("id,matches!inner(owner_organisation_id)")
      .eq("id", recording.room_id)
      .maybeSingle();
    const joined = room?.matches as
      | { owner_organisation_id: string }
      | Array<{ owner_organisation_id: string }>
      | null
      | undefined;
    const organisationId = Array.isArray(joined)
      ? joined[0]?.owner_organisation_id
      : joined?.owner_organisation_id;
    if (roomError || !room || !organisationId)
      return json({ error: "Source organisation could not be verified." }, 404, request);
    await requireOrganisationRole(client, user.id, organisationId, [
      "owner",
      "safeguarding_officer",
    ]);

    const [deviceResult, armResult] = await Promise.all([
      client
        .from("camera_devices")
        .select("id,room_id")
        .eq("id", recording.device_id)
        .eq("room_id", recording.room_id)
        .maybeSingle(),
      client
        .from("camera_recording_arms")
        .select("consent_confirmed")
        .eq("device_id", recording.device_id)
        .eq("room_id", recording.room_id)
        .maybeSingle(),
    ]);
    if (deviceResult.error || armResult.error || !deviceResult.data)
      return json({ error: "Device or recording permission unavailable." }, 409, request);

    if (
      !recording.provider_egress_id ||
      !cloudImportEligible({
        providerStatus: recording.state,
        archiveCheckStatus: recording.archive_check_status,
        fileBytes: recording.archive_object_bytes,
        endedAt: recording.ended_at,
        recordingPermissionStillValid: armResult.data?.consent_confirmed === true,
        reviewerStillAuthorised: true,
        approval: {
          recordingPermissionAttested: body.recordingPermissionAttested as true,
          includesJunior: body.includesJunior,
          guardianPermissionAttested: body.guardianPermissionAttested,
        },
      })
    )
      return json({ error: "A current consented, verified recording is required." }, 409, request);

    const retention = new Date(Date.now() + privateImportRetentionDays * 86_400_000).toISOString();
    const { data, error } = await client
      .from("camera_cloud_import_jobs")
      .insert({
        recording_id: recording.id,
        organisation_id: organisationId,
        room_id: recording.room_id,
        device_id: recording.device_id,
        approved_by: user.id,
        recording_permission_attested: true,
        includes_junior: body.includesJunior,
        guardian_permission_attested: body.guardianPermissionAttested,
        retention_expires_at: retention,
        state: "approved",
      })
      .select("recording_id,state,asset_id")
      .single();
    if (error) {
      if (error.code === "23505")
        return json(
          { error: "This recording already has an import review request." },
          409,
          request,
        );
      throw error;
    }
    return json(
      {
        recordingId: data.recording_id,
        state: data.state,
        // No URLs, credentials, source path or public media approval.
      },
      202,
      request,
    );
  } catch {
    return json({ error: "Private import review was denied or unavailable." }, 403, request);
  }
});
