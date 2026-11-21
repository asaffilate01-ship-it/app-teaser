/**
 * CricLume large-media transfer worker.
 *
 * Run on a private Node 24 host with a single scheduled invocation at a time.
 * This service NEVER runs in a browser or a short-lived Supabase Edge Function.
 * AWS multipart uploads retry failed parts; a killed process requires manual
 * reconciliation rather than silently re-running an ambiguous operation.
 */
import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createClient } from "@supabase/supabase-js";
import {
  cloudImportEligible,
  cloudImportStoragePath,
} from "../../src/lib/camera-import-policy.ts";
import { expectedCameraArchiveKey } from "../../src/lib/camera-archive-policy.ts";
import {
  LONG_TRANSFER_PART_BYTES,
  LONG_TRANSFER_WORKER_REF,
  allowedLongTransferSize,
  isExpectedSupabaseS3Endpoint,
  longTransferEligible,
  monitorMp4Header,
} from "../../src/lib/camera-long-transfer-policy.ts";

const LIMIT = 1;
const APPROVERS = ["owner", "safeguarding_officer"];
const uuidPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

class TransferFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new TransferFailure("storage_configuration");
  return value;
}

function httpsEndpoint(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new TransferFailure("storage_configuration");
  }
  if (
    url.protocol !== "https:" || url.username || url.password || url.hash ||
    url.search
  ) throw new TransferFailure("storage_configuration");
  return url;
}

function setup() {
  if (process.env.CRICLUME_LONG_TRANSFER_ENABLED !== "true") return null;
  const projectRef = required("CRICLUME_SUPABASE_PROJECT_REF");
  if (projectRef !== LONG_TRANSFER_WORKER_REF)
    throw new TransferFailure("storage_configuration");
  const projectUrl = httpsEndpoint(required("SUPABASE_URL"));
  if (projectUrl.hostname !== projectRef + ".supabase.co" ||
      projectUrl.pathname !== "/" || projectUrl.port)
    throw new TransferFailure("storage_configuration");
  const destinationUrl = required("CRICLUME_DESTINATION_S3_ENDPOINT");
  if (!isExpectedSupabaseS3Endpoint(destinationUrl, projectRef))
    throw new TransferFailure("storage_configuration");
  const originUrl = httpsEndpoint(required("CRICLUME_CAPTURE_S3_ENDPOINT"));
  if (originUrl.hostname === projectRef + ".supabase.co")
    throw new TransferFailure("storage_configuration");

  const db = createClient(projectUrl.toString(), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const source = new S3Client({
    region: required("CRICLUME_CAPTURE_S3_REGION"),
    endpoint: originUrl.toString(),
    forcePathStyle: true,
    maxAttempts: 3,
    credentials: {
      accessKeyId: required("CRICLUME_CAPTURE_S3_ACCESS_KEY"),
      secretAccessKey: required("CRICLUME_CAPTURE_S3_SECRET_KEY"),
    },
  });
  const target = new S3Client({
    region: required("CRICLUME_DESTINATION_S3_REGION"),
    endpoint: destinationUrl,
    forcePathStyle: true,
    maxAttempts: 3,
    credentials: {
      accessKeyId: required("CRICLUME_DESTINATION_S3_ACCESS_KEY"),
      secretAccessKey: required("CRICLUME_DESTINATION_S3_SECRET_KEY"),
    },
  });
  return {
    db, source, target,
    sourceBucket: required("CRICLUME_CAPTURE_S3_BUCKET"),
    targetBucket: "match-video",
  };
}

function getOwner(record) {
  const match = record?.matches;
  return Array.isArray(match) ? match[0]?.owner_organisation_id
    : match?.owner_organisation_id;
}

async function getFacts(db, job) {
  const [recording, room, device, arm, member] = await Promise.all([
    db.from("camera_cloud_recordings")
      .select(
        "id,room_id,device_id,object_path,provider_egress_id,state,archive_check_status,archive_object_bytes,archive_object_etag,created_at,ended_at",
      ).eq("id", job.recording_id).maybeSingle(),
    db.from("camera_rooms")
      .select("id,matches!inner(owner_organisation_id)")
      .eq("id", job.room_id).maybeSingle(),
    db.from("camera_devices")
      .select("id,room_id").eq("id", job.device_id)
      .eq("room_id", job.room_id).maybeSingle(),
    db.from("camera_recording_arms")
      .select("consent_confirmed").eq("device_id", job.device_id)
      .eq("room_id", job.room_id).maybeSingle(),
    db.from("organisation_members")
      .select("role").eq("organisation_id", job.organisation_id)
      .eq("user_id", job.approved_by).eq("status", "active")
      .in("role", APPROVERS).maybeSingle(),
  ]);
  if ([recording, room, device, arm, member].some((result) => result.error))
    throw new TransferFailure("recording_unavailable");
  const entry = recording.data;
  if (
    !entry || !device.data || !room.data || !entry.provider_egress_id ||
    entry.room_id !== job.room_id || entry.device_id !== job.device_id ||
    getOwner(room.data) !== job.organisation_id
  ) throw new TransferFailure("tenant_mismatch");
  const eligible = cloudImportEligible({
    providerStatus: entry.state,
    archiveCheckStatus: entry.archive_check_status,
    fileBytes: entry.archive_object_bytes,
    endedAt: entry.ended_at,
    recordingPermissionStillValid: arm.data?.consent_confirmed === true,
    reviewerStillAuthorised: Boolean(member.data),
    approval: {
      recordingPermissionAttested: job.recording_permission_attested,
      includesJunior: job.includes_junior,
      guardianPermissionAttested: job.guardian_permission_attested,
    },
  });
  if (!eligible || Date.parse(job.retention_expires_at) <= Date.now())
    throw new TransferFailure("permission_expired");
  if (!allowedLongTransferSize(entry.archive_object_bytes))
    throw new TransferFailure("large_file_requires_external_worker");
  const key = expectedCameraArchiveKey(
    job.organisation_id, job.room_id, job.device_id, job.recording_id,
  );
  if (key !== entry.object_path || !entry.archive_object_etag)
    throw new TransferFailure("source_changed");
  return { entry, sourceKey: key };
}

async function objectMissing(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return false;
  } catch (error) {
    if (
      error?.name === "NotFound" || error?.name === "NoSuchKey" ||
      error?.$metadata?.httpStatusCode === 404
    ) return true;
    throw new TransferFailure("storage_configuration");
  }
}

async function streamPrivateMp4(config, sourceKey, targetKey, expectedSize, etag) {
  if (!(await objectMissing(config.target, config.targetBucket, targetKey)))
    throw new TransferFailure("asset_write_failed");
  const head = await config.source.send(
    new HeadObjectCommand({ Bucket: config.sourceBucket, Key: sourceKey }),
  );
  if (head.ContentLength !== expectedSize || head.ETag !== etag)
    throw new TransferFailure("source_changed");

  const original = await config.source.send(new GetObjectCommand({
    Bucket: config.sourceBucket,
    Key: sourceKey,
    IfMatch: etag,
  }));
  if (!original.Body) throw new TransferFailure("source_changed");
  const hash = createHash("sha256");
  let byteCount = 0;
  let header = Buffer.alloc(0);
  const monitor = new Transform({
    transform(chunk, _encoding, done) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      byteCount += bytes.length;
      if (byteCount > expectedSize) {
        done(new TransferFailure("source_changed"));
        return;
      }
      if (header.length < 16) {
        header = Buffer.concat([header, bytes.subarray(0, 16 - header.length)]);
      }
      hash.update(bytes);
      done(null, bytes);
    },
  });
  const reader = Readable.from(original.Body);
  const feeding = pipeline(reader, monitor);
  try {
    const upload = new Upload({
      client: config.target,
      params: {
        Bucket: config.targetBucket,
        Key: targetKey,
        Body: monitor,
        ContentType: "video/mp4",
      },
      queueSize: 2,
      partSize: LONG_TRANSFER_PART_BYTES,
      leavePartsOnError: false,
    });
    await Promise.all([feeding, upload.done()]);
  } catch (error) {
    reader.destroy();
    monitor.destroy();
    await feeding.catch(() => {});
    if (error?.code === "source_changed") throw error;
    throw new TransferFailure("transfer_failed");
  }

  if (byteCount !== expectedSize || !monitorMp4Header(header))
    throw new TransferFailure("source_changed");
  const [afterSource, afterTarget] = await Promise.all([
    config.source.send(new HeadObjectCommand({
      Bucket: config.sourceBucket, Key: sourceKey,
    })),
    config.target.send(new HeadObjectCommand({
      Bucket: config.targetBucket, Key: targetKey,
    })),
  ]);
  if (
    afterSource.ContentLength !== expectedSize || afterSource.ETag !== etag ||
    afterTarget.ContentLength !== expectedSize
  ) throw new TransferFailure("source_changed");
  // Hash covers the entire streamed source; target size confirms multipart assembly,
  // not independently a target-side SHA-256.
  return { size: byteCount, sha256: hash.digest("hex") };
}

async function claimJob(db, job) {
  const { data, error } = await db.from("camera_cloud_import_jobs")
    .update({
      state: "importing",
      failure_code: null,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("recording_id", job.recording_id)
    .eq("state", "manual_review")
    .eq("failure_code", "large_file_requires_external_worker")
    .select("recording_id")
    .maybeSingle();
  if (error) throw new TransferFailure("asset_write_failed");
  return Boolean(data);
}

async function setManualReview(db, job, reason) {
  const { error } = await db.from("camera_cloud_import_jobs")
    .update({ state: "manual_review", failure_code: reason, updated_at: new Date().toISOString() })
    .eq("recording_id", job.recording_id).eq("state", "importing");
  if (error) throw new TransferFailure("asset_write_failed");
}

async function runOnce(config) {
  const { data, error } = await config.db.from("camera_cloud_import_jobs")
    .select(
      "recording_id,asset_id,organisation_id,room_id,device_id,approved_by,recording_permission_attested,includes_junior,guardian_permission_attested,retention_expires_at,state,failure_code",
    )
    .eq("state", "manual_review")
    .eq("failure_code", "large_file_requires_external_worker")
    .order("approved_at", { ascending: true })
    .limit(LIMIT);
  if (error) throw new TransferFailure("recording_unavailable");

  for (const job of data ?? []) {
    const keys = [job.recording_id, job.asset_id, job.organisation_id,
      job.room_id, job.device_id, job.approved_by];
    if (!keys.every((id) => uuidPattern.test(id))) continue;
    if (!(await claimJob(config.db, job))) continue;

    let reason = "transfer_failed";
    let createdTarget = false;
    const targetKey = cloudImportStoragePath(
      job.organisation_id, job.room_id, job.asset_id,
    );
    try {
      const { entry, sourceKey } = await getFacts(config.db, job);
      if (!longTransferEligible({
        jobState: job.state,
        failureCode: job.failure_code,
        recordingState: entry.state,
        archiveState: entry.archive_check_status,
        sizeBytes: entry.archive_object_bytes,
        retainsUntil: job.retention_expires_at,
        consentConfirmed: true, // verified in getFacts against current camera arm
        reviewerActive: true, // verified in getFacts against active org role
        recordingPermissionAttested: job.recording_permission_attested,
        includesJunior: job.includes_junior,
        guardianPermissionAttested: job.guardian_permission_attested,
      }, Date.now())) throw new TransferFailure("permission_expired");

      const result = await streamPrivateMp4(
        config, sourceKey, targetKey, entry.archive_object_bytes,
        entry.archive_object_etag,
      );
      createdTarget = true;
      // Even a correct multipart transfer must fail closed on permission loss.
      await getFacts(config.db, job);
      const { error: assetError } = await config.db.from("video_assets").insert({
        id: job.asset_id,
        organisation_id: job.organisation_id,
        room_id: job.room_id,
        device_id: job.device_id,
        content_type: "video/mp4",
        size_bytes: result.size,
        source_sha256: result.sha256,
        started_at: entry.created_at,
        ended_at: entry.ended_at,
        status: "uploading",
        recording_consent: "granted",
        publication_consent: "pending",
        includes_junior: job.includes_junior,
        blur_mode: "people",
        retention_expires_at: job.retention_expires_at,
        created_by: job.approved_by,
      });
      if (assetError) throw new TransferFailure("asset_write_failed");

      const [freshArm, freshMember] = await Promise.all([
        config.db.from("camera_recording_arms").select("consent_confirmed")
          .eq("device_id", job.device_id).eq("room_id", job.room_id).maybeSingle(),
        config.db.from("organisation_members").select("role")
          .eq("organisation_id", job.organisation_id)
          .eq("user_id", job.approved_by).eq("status", "active")
          .in("role", APPROVERS).maybeSingle(),
      ]);
      if (
        freshArm.error || freshMember.error ||
        freshArm.data?.consent_confirmed !== true || !freshMember.data ||
        Date.parse(job.retention_expires_at) <= Date.now()
      ) throw new TransferFailure("permission_expired");

      const { data: saved, error: savedError } = await config.db.from("video_assets")
        .update({ storage_path: targetKey, status: "uploaded" })
        .eq("id", job.asset_id).eq("status", "uploading").select("id").maybeSingle();
      if (savedError || !saved) throw new TransferFailure("asset_write_failed");
      const { data: finished, error: finishedError } = await config.db
        .from("camera_cloud_import_jobs")
        .update({ state: "imported", imported_at: new Date().toISOString(),
          updated_at: new Date().toISOString() })
        .eq("recording_id", job.recording_id).eq("state", "importing")
        .select("recording_id").maybeSingle();
      if (finishedError || !finished) throw new TransferFailure("asset_write_failed");
      return { scanned: 1, imported: 1, bytesTransferred: result.size, manualReview: 0 };
    } catch (error) {
      if (
        error instanceof TransferFailure &&
        ["source_changed", "tenant_mismatch", "role_revoked", "permission_expired",
          "storage_configuration", "recording_unavailable", "asset_write_failed",
          "large_file_requires_external_worker"].includes(error.code)
      ) reason = error.code;
      // Where possible remove any newly copied but unapproved object. If cleanup
      // fails it remains in a PRIVATE bucket; manual reconciliation is required.
      if (createdTarget && reason === "permission_expired") {
        await config.target.send(new DeleteObjectCommand({
          Bucket: config.targetBucket, Key: targetKey,
        })).catch(() => {});
      }
      await setManualReview(config.db, job, reason);
      return { scanned: 1, imported: 0, bytesTransferred: 0, manualReview: 1 };
    }
  }
  return { scanned: 0, imported: 0, bytesTransferred: 0, manualReview: 0 };
}

async function main() {
  const config = setup();
  if (!config) {
    console.log(JSON.stringify({ status: "disabled", imported: 0 }));
    return;
  }
  try {
    const result = await runOnce(config);
    console.log(JSON.stringify({ status: "checked", ...result }));
  } catch {
    console.error("Private large-media transfer check failed. Review service logs securely.");
    process.exitCode = 1;
  } finally {
    config.source.destroy();
    config.target.destroy();
  }
}

await main();
