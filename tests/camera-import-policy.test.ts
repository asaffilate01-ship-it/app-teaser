import assert from "node:assert/strict";
import test from "node:test";
import {
  cloudImportEligible,
  cloudImportRequiresExternalWorker,
  cloudImportReviewLabel,
  cloudImportStoragePath,
  privateImportMaxBytes,
  type CloudImportPrerequisites,
} from "../src/lib/camera-import-policy.ts";

const eligible: CloudImportPrerequisites = {
  providerStatus: "provider_completed",
  archiveCheckStatus: "object_confirmed",
  fileBytes: 6_000_000,
  endedAt: "2026-11-21T13:00:00Z",
  recordingPermissionStillValid: true,
  reviewerStillAuthorised: true,
  approval: {
    recordingPermissionAttested: true,
    includesJunior: true,
    guardianPermissionAttested: true,
  },
};

test("import requires a completed, confirmed private file plus live consent and authorised review", () => {
  assert.equal(cloudImportEligible(eligible), true);
  for (const variant of [
    { providerStatus: "recording" },
    { providerStatus: "failed" },
    { archiveCheckStatus: "object_missing" },
    { archiveCheckStatus: "uninspected" },
    { fileBytes: 0 },
    { fileBytes: null },
    { endedAt: null },
    { endedAt: "invalid" },
    { recordingPermissionStillValid: false },
    { reviewerStillAuthorised: false },
    { approval: { ...eligible.approval, recordingPermissionAttested: false } },
    { approval: { ...eligible.approval, guardianPermissionAttested: false } },
  ])
    assert.equal(cloudImportEligible({ ...eligible, ...variant }), false);
  assert.equal(
    cloudImportEligible({
      ...eligible,
      approval: {
        recordingPermissionAttested: true,
        includesJunior: false,
        guardianPermissionAttested: false,
      },
    }),
    true,
  );
});

test("Edge transfer is strictly capped and large media is not claimed as imported", () => {
  assert.equal(cloudImportRequiresExternalWorker(privateImportMaxBytes), false);
  assert.equal(cloudImportRequiresExternalWorker(privateImportMaxBytes + 1), true);
  assert.equal(cloudImportRequiresExternalWorker(Number.NaN), true);
  assert.equal(cloudImportRequiresExternalWorker(Number.POSITIVE_INFINITY), true);
});

test("private upload paths are derived from canonical IDs, not caller-provided S3 paths", () => {
  const ids = [
    "aa000000-0000-4000-8000-000000000001",
    "bb000000-0000-4000-8000-000000000001",
    "cc000000-0000-4000-8000-000000000001",
  ];
  assert.equal(
    cloudImportStoragePath(...(ids as [string, string, string])),
    ids.join("/") + "/source.mp4",
  );
  assert.throws(() => cloudImportStoragePath(ids[0], "../other", ids[2]));
  assert.throws(() => cloudImportStoragePath(ids[0], ids[1], "bad"));
});

test("imported state never means published or safe to share", () => {
  assert.match(cloudImportReviewLabel("imported"), /privacy processing required/i);
  assert.match(cloudImportReviewLabel("manual_review"), /do not claim/i);
  assert.doesNotMatch(cloudImportReviewLabel("imported"), /publish|share|ready for public/i);
});
