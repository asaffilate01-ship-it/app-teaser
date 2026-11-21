import assert from "node:assert/strict";
import test from "node:test";
import {
  LONG_TRANSFER_MAX_BYTES,
  LONG_TRANSFER_MIN_BYTES,
  LONG_TRANSFER_WORKER_REF,
  allowedLongTransferSize,
  isExpectedSupabaseS3Endpoint,
  longTransferEligible,
  monitorMp4Header,
} from "../src/lib/camera-long-transfer-policy.ts";

const baseline = {
  jobState: "manual_review",
  failureCode: "large_file_requires_external_worker",
  recordingState: "provider_completed",
  archiveState: "object_confirmed",
  sizeBytes: 200_000_000,
  retainsUntil: "2026-12-21T18:00:00Z",
  consentConfirmed: true,
  reviewerActive: true,
  recordingPermissionAttested: true,
  includesJunior: true,
  guardianPermissionAttested: true,
};
const nowMs = Date.parse("2026-11-21T18:00:00Z");

test("only verified long recordings with current permissions are transfer eligible", () => {
  assert.equal(longTransferEligible(baseline, nowMs), true);
  for (const patch of [
    { jobState: "importing" },
    { jobState: "imported" },
    { failureCode: "transfer_failed" },
    { failureCode: null },
    { recordingState: "recording" },
    { archiveState: "object_missing" },
    { sizeBytes: null },
    { sizeBytes: LONG_TRANSFER_MIN_BYTES - 1 },
    { sizeBytes: LONG_TRANSFER_MAX_BYTES + 1 },
    { retainsUntil: "invalid" },
    { retainsUntil: "2026-11-21T17:00:00Z" },
    { consentConfirmed: false },
    { reviewerActive: false },
    { recordingPermissionAttested: false },
    { guardianPermissionAttested: false },
  ]) assert.equal(longTransferEligible({ ...baseline, ...patch }, nowMs), false);
  assert.equal(
    longTransferEligible({ ...baseline, includesJunior: false, guardianPermissionAttested: false }, nowMs),
    true,
  );
});

test("multipart transfer is bounded at 5 GiB and starts above the 32 MiB Edge cap", () => {
  assert.equal(allowedLongTransferSize(LONG_TRANSFER_MIN_BYTES), true);
  assert.equal(allowedLongTransferSize(LONG_TRANSFER_MAX_BYTES), true);
  assert.equal(allowedLongTransferSize(0), false);
  assert.equal(allowedLongTransferSize(Number.POSITIVE_INFINITY), false);
  assert.equal(allowedLongTransferSize(Number.MAX_SAFE_INTEGER), false);
  assert.equal(allowedLongTransferSize(50.5), false);
});

test("worker refuses Dishbee and arbitrary S3 destination project endpoints", () => {
  const correct = "https://" + LONG_TRANSFER_WORKER_REF + ".storage.supabase.co/storage/v1/s3";
  assert.equal(isExpectedSupabaseS3Endpoint(correct, LONG_TRANSFER_WORKER_REF), true);
  assert.equal(
    isExpectedSupabaseS3Endpoint(
      "https://" + LONG_TRANSFER_WORKER_REF + ".supabase.co/storage/v1/s3",
      LONG_TRANSFER_WORKER_REF,
    ),
    true,
  );
  for (const bad of [
    "https://ebzinvoxundsdubczqfg.supabase.co/storage/v1/s3",
    "https://attacker.example/storage/v1/s3",
    "http://" + LONG_TRANSFER_WORKER_REF + ".supabase.co/storage/v1/s3",
    correct + "?tenant=bad",
    correct.replace("/storage/v1/s3", "/other"),
  ]) assert.equal(isExpectedSupabaseS3Endpoint(bad, LONG_TRANSFER_WORKER_REF), false);
  assert.equal(isExpectedSupabaseS3Endpoint(correct, "ebzinvoxundsdubczqfg"), false);
});

test("rejects malformed MP4 headers without claiming validation of whole video", () => {
  assert.equal(monitorMp4Header(new Uint8Array([0,0,0,20,102,116,121,112,105,115,111,109])), true);
  assert.equal(monitorMp4Header(new Uint8Array([0,0,0,20,0,0,0,0,105,115,111,109])), false);
  assert.equal(monitorMp4Header(new Uint8Array(0)), false);
});
