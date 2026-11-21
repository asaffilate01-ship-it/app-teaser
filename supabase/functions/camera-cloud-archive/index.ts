// Cron-only, disabled-by-default private archive inspector.
// A confirmed S3 MP4 object does NOT constitute publication or safeguarding approval.
import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3@3.840.0";
import {
  expectedCameraArchiveKey,
  inspectCameraMp4,
  mayCheckCameraArchive,
  type CameraArchiveStatus,
} from "../../../src/lib/camera-archive-policy.ts";
import { adminClient } from "../_shared/supabase.ts";
import { errorResponse, json, requireEnvironmentSecret, requirePost } from "../_shared/http.ts";

type ArchiveCandidate = {
  id: string;
  room_id: string;
  device_id: string;
  object_path: string;
  provider_egress_id: string | null;
  state: string;
  ended_at: string | null;
  archive_check_status: string;
  archive_check_attempts: number;
};
type MatchOwner = { owner_organisation_id: string };
const retryable = ["uninspected", "object_missing", "storage_error"];
const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function archiveStorage() {
  const endpoint = Deno.env.get("CRICLUME_CAPTURE_S3_ENDPOINT") ?? "";
  const bucket = Deno.env.get("CRICLUME_CAPTURE_S3_BUCKET") ?? "";
  const region = Deno.env.get("CRICLUME_CAPTURE_S3_REGION") ?? "";
  const key = Deno.env.get("CRICLUME_CAPTURE_S3_ACCESS_KEY") ?? "";
  const secret = Deno.env.get("CRICLUME_CAPTURE_S3_SECRET_KEY") ?? "";
  let parsed: URL;
  try { parsed = new URL(endpoint); }
  catch { throw new Error("Cloud archive storage is not configured."); }
  if (
    parsed.protocol !== "https:" || parsed.username || parsed.password ||
    parsed.search || parsed.hash || !bucket || !region || !key || !secret ||
    !/^[a-z0-9][a-z0-9.-]{2,62}$/.test(bucket)
  ) throw new Error("Private archive storage configuration is invalid.");
  return {
    bucket,
    client: new S3Client({
      region,
      endpoint: parsed.toString(),
      forcePathStyle: true,
      credentials: { accessKeyId: key, secretAccessKey: secret },
      maxAttempts: 2,
    }),
  };
}

function missingKey(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { $metadata?: { httpStatusCode?: number }; name?: string };
  return candidate.$metadata?.httpStatusCode === 404 ||
    candidate.name === "NoSuchKey" ||
    candidate.name === "NotFound";
}

Deno.serve(async (request) => {
  try {
    requirePost(request);
    await requireEnvironmentSecret(request, "x-cron-secret", "CRON_SECRET");
    if (Deno.env.get("CRICLUME_CLOUD_ARCHIVE_CHECK_ENABLED") !== "true")
      return json({ status: "disabled", checked: 0 });

    const db = adminClient();
    const { bucket, client: storage } = archiveStorage();
    const { data, error } = await db
      .from("camera_cloud_recordings")
      .select(
        "id,room_id,device_id,object_path,provider_egress_id,state,ended_at," +
        "archive_check_status,archive_check_attempts",
      )
      .eq("state", "provider_completed")
      .in("archive_check_status", retryable)
      .lt("archive_check_attempts", 5)
      .order("created_at", { ascending: true })
      .limit(10);
    if (error) throw error;

    let checked = 0;
    let confirmed = 0;
    let missing = 0;
    let needsReview = 0;
    let retrying = 0;
    let errors = 0;
    try {
      for (const candidate of (data ?? []) as ArchiveCandidate[]) {
        if (!mayCheckCameraArchive(
          candidate.state, candidate.archive_check_status, candidate.archive_check_attempts,
        )) continue;

        let result: CameraArchiveStatus = "review_required";
        let byteSize: number | null = null;
        let etag: string | null = null;
        try {
          if (!candidate.ended_at || !candidate.provider_egress_id ||
              !uuid.test(candidate.id) || !uuid.test(candidate.room_id) ||
              !uuid.test(candidate.device_id)) {
            result = "review_required";
          } else {
            const { data: room, error: roomError } = await db
              .from("camera_rooms")
              .select("id,matches!inner(owner_organisation_id)")
              .eq("id", candidate.room_id)
              .maybeSingle();
            const joined = room?.matches as MatchOwner | MatchOwner[] | null | undefined;
            const organisationId = Array.isArray(joined)
              ? joined[0]?.owner_organisation_id : joined?.owner_organisation_id;
            const { data: device, error: deviceError } = await db
              .from("camera_devices")
              .select("id,room_id")
              .eq("id", candidate.device_id)
              .eq("room_id", candidate.room_id)
              .maybeSingle();
            if (roomError || deviceError || !room || !device || !organisationId) {
              result = "review_required";
            } else {
              const expected = expectedCameraArchiveKey(
                organisationId, candidate.room_id, candidate.device_id, candidate.id,
              );
              if (expected !== candidate.object_path) {
                // Never send an attacker-provided S3 path to a credentialed client.
                result = "review_required";
              } else {
                try {
                  const head = await storage.send(
                    new HeadObjectCommand({ Bucket: bucket, Key: expected }),
                  );
                  byteSize = head.ContentLength ?? null;
                  etag = (head.ETag ?? "").slice(0, 200) || null;
                  if (!Number.isSafeInteger(byteSize) || (byteSize ?? 0) < 1024) {
                    result = "invalid_object";
                  } else {
                    const smallRead = await storage.send(
                      new GetObjectCommand({
                        Bucket: bucket,
                        Key: expected,
                        Range: "bytes=0-63",
                      }),
                    );
                    const bytes = smallRead.Body
                      ? await smallRead.Body.transformToByteArray()
                      : new Uint8Array(0);
                    result = inspectCameraMp4(byteSize ?? undefined, head.ContentType, bytes);
                  }
                } catch (reason) {
                  result = missingKey(reason) ? "object_missing" : "storage_error";
                }
              }
            }
          }
        } catch {
          result = "review_required";
        }

        const attempts = candidate.archive_check_attempts + 1;
        if (attempts >= 5 && (result === "object_missing" || result === "storage_error"))
          result = "review_required";
        const now = new Date().toISOString();
        const { data: changed, error: saveError } = await db
          .from("camera_cloud_recordings")
          .update({
            archive_check_status: result,
            archive_check_attempts: attempts,
            archive_object_bytes: result === "object_confirmed" ? byteSize : null,
            archive_object_etag: result === "object_confirmed" ? etag : null,
            archive_checked_at: now,
            archive_object_confirmed_at: result === "object_confirmed" ? now : null,
          })
          .eq("id", candidate.id)
          .eq("state", "provider_completed")
          .eq("archive_check_attempts", candidate.archive_check_attempts)
          .in("archive_check_status", retryable)
          .select("id")
          .maybeSingle();

        if (saveError) { errors++; continue; }
        if (!changed) continue; // Another worker already processed the same object.
        checked++;
        if (result === "object_confirmed") confirmed++;
        else if (result === "object_missing") missing++;
        else if (result === "review_required" || result === "invalid_object") needsReview++;
        else retrying++;
      }
    } finally {
      storage.destroy();
    }
    return json({
      status: "checked",
      checked,
      objectConfirmed: confirmed,
      missing,
      retrying,
      needsReview,
      errors,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error, 503);
  }
});
