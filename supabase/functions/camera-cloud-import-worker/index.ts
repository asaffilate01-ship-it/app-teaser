// Disabled-by-default cron worker for small private cloud recordings.
// Streaming/long-form footage requires a separately approved external transfer worker.
import { GetObjectCommand, HeadObjectCommand, S3Client } from "npm:@aws-sdk/client-s3@3.840.0";
import {
  cloudImportEligible,
  cloudImportRequiresExternalWorker,
  cloudImportStoragePath,
  privateImportMaxBytes,
} from "../../../src/lib/camera-import-policy.ts";
import {
  expectedCameraArchiveKey,
  inspectCameraMp4,
} from "../../../src/lib/camera-archive-policy.ts";
import { adminClient } from "../_shared/supabase.ts";
import { errorResponse, json, requireEnvironmentSecret, requirePost } from "../_shared/http.ts";

type ImportRow = {
  recording_id: string;
  asset_id: string;
  organisation_id: string;
  room_id: string;
  device_id: string;
  approved_by: string;
  recording_permission_attested: boolean;
  includes_junior: boolean;
  guardian_permission_attested: boolean;
  retention_expires_at: string;
  state: string;
};
type RecordingRow = {
  id: string;
  room_id: string;
  device_id: string;
  object_path: string;
  provider_egress_id: string | null;
  state: string;
  archive_check_status: string;
  archive_object_bytes: number | null;
  archive_object_etag: string | null;
  created_at: string;
  ended_at: string | null;
};
type MatchOrg = { owner_organisation_id: string };
type FailureCode =
  | "large_file_requires_external_worker"
  | "permission_expired"
  | "role_revoked"
  | "tenant_mismatch"
  | "source_changed"
  | "transfer_failed"
  | "asset_write_failed"
  | "storage_configuration"
  | "recording_unavailable";

class ImportFailure extends Error {
  constructor(readonly reason: FailureCode) {
    super(reason);
  }
}

function storageClient() {
  const endpoint = Deno.env.get("CRICLUME_CAPTURE_S3_ENDPOINT") ?? "";
  const bucket = Deno.env.get("CRICLUME_CAPTURE_S3_BUCKET") ?? "";
  const region = Deno.env.get("CRICLUME_CAPTURE_S3_REGION") ?? "";
  const accessKeyId = Deno.env.get("CRICLUME_CAPTURE_S3_ACCESS_KEY") ?? "";
  const secretAccessKey = Deno.env.get("CRICLUME_CAPTURE_S3_SECRET_KEY") ?? "";
  let address: URL;
  try {
    address = new URL(endpoint);
  } catch {
    throw new ImportFailure("storage_configuration");
  }
  if (
    address.protocol !== "https:" ||
    address.username ||
    address.password ||
    address.search ||
    address.hash ||
    !region ||
    !bucket ||
    !accessKeyId ||
    !secretAccessKey
  )
    throw new ImportFailure("storage_configuration");
  return {
    bucket,
    s3: new S3Client({
      endpoint: address.toString(),
      region,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 2,
    }),
  };
}

const isoNow = () => new Date().toISOString();
const idPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  try {
    requirePost(request);
    await requireEnvironmentSecret(request, "x-cron-secret", "CRON_SECRET");
    if (Deno.env.get("CRICLUME_PRIVATE_IMPORT_ENABLED") !== "true")
      return json({ status: "disabled", inspected: 0, imported: 0 });

    const db = adminClient();
    const { data: pending, error } = await db
      .from("camera_cloud_import_jobs")
      .select(
        "recording_id,asset_id,organisation_id,room_id,device_id,approved_by,recording_permission_attested,includes_junior,guardian_permission_attested,retention_expires_at,state",
      )
      .eq("state", "approved")
      .order("approved_at", { ascending: true })
      .limit(1);
    if (error) throw error;

    let imported = 0;
    let requiresReview = 0;
    for (const row of (pending ?? []) as ImportRow[]) {
      const { data: claim, error: claimError } = await db
        .from("camera_cloud_import_jobs")
        .update({ state: "importing", claimed_at: isoNow(), updated_at: isoNow() })
        .eq("recording_id", row.recording_id)
        .eq("state", "approved")
        .select("recording_id")
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claim) continue; // Another invocation already claimed this recording.

      let reason: FailureCode = "transfer_failed";
      try {
        if (
          ![row.recording_id, row.room_id, row.device_id, row.asset_id, row.organisation_id].every(
            (value) => idPattern.test(value),
          )
        ) {
          throw new ImportFailure("tenant_mismatch");
        }
        if (Date.parse(row.retention_expires_at) <= Date.now())
          throw new ImportFailure("permission_expired");
        const [sourceResult, roomResult, deviceResult, armResult, memberResult] = await Promise.all(
          [
            db
              .from("camera_cloud_recordings")
              .select(
                "id,room_id,device_id,object_path,provider_egress_id,state,archive_check_status,archive_object_bytes,archive_object_etag,created_at,ended_at",
              )
              .eq("id", row.recording_id)
              .maybeSingle(),
            db
              .from("camera_rooms")
              .select("id,matches!inner(owner_organisation_id)")
              .eq("id", row.room_id)
              .maybeSingle(),
            db
              .from("camera_devices")
              .select("id,room_id")
              .eq("id", row.device_id)
              .eq("room_id", row.room_id)
              .maybeSingle(),
            db
              .from("camera_recording_arms")
              .select("consent_confirmed")
              .eq("device_id", row.device_id)
              .eq("room_id", row.room_id)
              .maybeSingle(),
            db
              .from("organisation_members")
              .select("role")
              .eq("organisation_id", row.organisation_id)
              .eq("user_id", row.approved_by)
              .eq("status", "active")
              .in("role", ["owner", "safeguarding_officer"])
              .maybeSingle(),
          ],
        );
        if (
          sourceResult.error ||
          roomResult.error ||
          deviceResult.error ||
          armResult.error ||
          memberResult.error
        )
          throw new ImportFailure("recording_unavailable");
        const recording = sourceResult.data as RecordingRow | null;
        const joined = roomResult.data?.matches as MatchOrg | MatchOrg[] | null | undefined;
        const owner = Array.isArray(joined)
          ? joined[0]?.owner_organisation_id
          : joined?.owner_organisation_id;
        if (
          !recording ||
          !roomResult.data ||
          !deviceResult.data ||
          recording.room_id !== row.room_id ||
          recording.device_id !== row.device_id ||
          owner !== row.organisation_id
        )
          throw new ImportFailure("tenant_mismatch");
        if (!memberResult.data) throw new ImportFailure("role_revoked");
        if (
          !cloudImportEligible({
            providerStatus: recording.state,
            archiveCheckStatus: recording.archive_check_status,
            fileBytes: recording.archive_object_bytes,
            endedAt: recording.ended_at,
            recordingPermissionStillValid: armResult.data?.consent_confirmed === true,
            reviewerStillAuthorised: true,
            approval: {
              recordingPermissionAttested: row.recording_permission_attested,
              includesJunior: row.includes_junior,
              guardianPermissionAttested: row.guardian_permission_attested,
            },
          }) ||
          !recording.provider_egress_id
        ) {
          throw new ImportFailure("permission_expired");
        }

        if (cloudImportRequiresExternalWorker(recording.archive_object_bytes!))
          throw new ImportFailure("large_file_requires_external_worker");
        const sourcePath = expectedCameraArchiveKey(
          row.organisation_id,
          row.room_id,
          row.device_id,
          row.recording_id,
        );
        if (sourcePath !== recording.object_path) throw new ImportFailure("tenant_mismatch");
        const targetPath = cloudImportStoragePath(row.organisation_id, row.room_id, row.asset_id);
        const { bucket, s3 } = storageClient();
        let bytes: Uint8Array;
        try {
          const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: sourcePath }));
          if (
            head.ContentLength !== recording.archive_object_bytes ||
            (recording.archive_object_etag && head.ETag !== recording.archive_object_etag)
          )
            throw new ImportFailure("source_changed");
          const object = await s3.send(
            new GetObjectCommand({
              Bucket: bucket,
              Key: sourcePath,
              ...(head.ETag ? { IfMatch: head.ETag } : {}),
            }),
          );
          bytes = object.Body ? await object.Body.transformToByteArray() : new Uint8Array(0);
          if (
            bytes.length !== recording.archive_object_bytes ||
            inspectCameraMp4(
              bytes.length,
              object.ContentType ?? head.ContentType,
              bytes.subarray(0, 64),
            ) !== "object_confirmed"
          )
            throw new ImportFailure("source_changed");
        } finally {
          s3.destroy();
        }

        // A real SHA-256 over the copied bytes, not an S3 ETag approximation.
        const shaBuffer = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
        const sha256 = Array.from(new Uint8Array(shaBuffer), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");

        // Permission and reviewer authorisation can change during a 32 MiB transfer.
        // Recheck immediately before creating any private video asset.
        const [freshArm, freshMember, freshSource] = await Promise.all([
          db
            .from("camera_recording_arms")
            .select("consent_confirmed")
            .eq("device_id", row.device_id)
            .eq("room_id", row.room_id)
            .maybeSingle(),
          db
            .from("organisation_members")
            .select("role")
            .eq("organisation_id", row.organisation_id)
            .eq("user_id", row.approved_by)
            .eq("status", "active")
            .in("role", ["owner", "safeguarding_officer"])
            .maybeSingle(),
          db
            .from("camera_cloud_recordings")
            .select("state,archive_check_status")
            .eq("id", row.recording_id)
            .maybeSingle(),
        ]);
        if (
          freshArm.error ||
          freshMember.error ||
          freshSource.error ||
          !freshArm.data?.consent_confirmed ||
          !freshMember.data ||
          freshSource.data?.state !== "provider_completed" ||
          freshSource.data?.archive_check_status !== "object_confirmed" ||
          Date.parse(row.retention_expires_at) <= Date.now()
        )
          throw new ImportFailure("permission_expired");

        // A status=uploading record with no storage_path is NOT reviewable.
        const { error: assetError } = await db.from("video_assets").insert({
          id: row.asset_id,
          organisation_id: row.organisation_id,
          room_id: row.room_id,
          device_id: row.device_id,
          content_type: "video/mp4",
          size_bytes: bytes.length,
          source_sha256: sha256,
          started_at: recording.created_at,
          ended_at: recording.ended_at,
          status: "uploading",
          recording_consent: "granted",
          publication_consent: "pending",
          includes_junior: row.includes_junior,
          blur_mode: "people",
          retention_expires_at: row.retention_expires_at,
          created_by: row.approved_by,
        });
        if (assetError) throw new ImportFailure("asset_write_failed");

        // Bounded pilot copy into CricLume's existing PRIVATE match-video bucket.
        // Long-form files are never buffered in this Edge Function.
        const blob = new Blob([Uint8Array.from(bytes)], { type: "video/mp4" });
        const upload = await db.storage.from("match-video").upload(targetPath, blob, {
          contentType: "video/mp4",
          upsert: false,
          cacheControl: "3600",
        });
        if (upload.error) throw new ImportFailure("transfer_failed");
        const { data: saved, error: saveError } = await db
          .from("video_assets")
          .update({ storage_path: targetPath, status: "uploaded" })
          .eq("id", row.asset_id)
          .eq("status", "uploading")
          .select("id")
          .maybeSingle();
        if (saveError || !saved) throw new ImportFailure("asset_write_failed");
        const { error: doneError } = await db
          .from("camera_cloud_import_jobs")
          .update({ state: "imported", imported_at: isoNow(), updated_at: isoNow() })
          .eq("recording_id", row.recording_id)
          .eq("state", "importing");
        if (doneError) throw new ImportFailure("asset_write_failed");
        imported++;
      } catch (error) {
        if (error instanceof ImportFailure) reason = error.reason;
        await db
          .from("camera_cloud_import_jobs")
          .update({
            state: "manual_review",
            failure_code: reason,
            updated_at: isoNow(),
          })
          .eq("recording_id", row.recording_id)
          .eq("state", "importing");
        requiresReview++;
      }
    }
    return json({
      status: "checked",
      imported,
      requiresReview,
      // No S3 source URLs, stored path, signed private URLs or video contents.
      checkedAt: isoNow(),
    });
  } catch (error) {
    return errorResponse(error, 503);
  }
});
