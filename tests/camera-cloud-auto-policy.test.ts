import assert from "node:assert/strict";
import test from "node:test";
import {
  automaticCloudStopCause,
  canAutomaticallyStartCamera,
  cloudAutoDuration,
  cloudAutoQuota,
  type CloudCameraEligibility,
} from "../supabase/functions/_shared/camera-auto-policy.ts";

const ready: CloudCameraEligibility = {
  matchStatus: "live",
  roomStatus: "open",
  localArmed: true,
  consentConfirmed: true,
  autoEnabled: true,
  adultOnlyAttested: true,
};

test("cloud auto recording requires live match, explicit operator opt-in and an actual publisher", () => {
  assert.equal(canAutomaticallyStartCamera({ ...ready, publisherPresent: true }), true);
  assert.equal(canAutomaticallyStartCamera({ ...ready, publisherPresent: false }), false);
  for (const input of [
    { matchStatus: "draft" },
    { matchStatus: "completed" },
    { matchStatus: "abandoned" },
    { roomStatus: "closed" },
    { localArmed: false },
    { consentConfirmed: false },
    { autoEnabled: false },
    { adultOnlyAttested: false },
  ]) {
    assert.equal(canAutomaticallyStartCamera({ ...ready, ...input, publisherPresent: true }), false);
  }
});

test("reconciler stops all cloud recordings when the match ends, room closes or consent is withdrawn", () => {
  const baseline = {
    ...ready, source: "match_state" as const,
    nowMs: Date.parse("2026-11-21T12:30:00Z"),
    startedAt: "2026-11-21T12:00:00Z",
    maxDurationMinutes: 120,
  };
  assert.equal(automaticCloudStopCause(baseline), null);
  assert.equal(automaticCloudStopCause({ ...baseline, matchStatus: "completed" }), "match_not_live");
  assert.equal(automaticCloudStopCause({ ...baseline, roomStatus: "archived" }), "room_closed");
  assert.equal(automaticCloudStopCause({ ...baseline, consentConfirmed: false }), "consent_withdrawn");
  assert.equal(automaticCloudStopCause({ ...baseline, localArmed: false }), "consent_withdrawn");
  assert.equal(automaticCloudStopCause({ ...baseline, autoEnabled: false }), "auto_opt_out");
  assert.equal(automaticCloudStopCause({ ...baseline, adultOnlyAttested: false }), "auto_opt_out");
  // Explicit manual director recording is not cancelled solely by auto opt-out.
  assert.equal(automaticCloudStopCause({ ...baseline, source: "director", autoEnabled: false }), null);
});

test("hard duration cap and malformed timestamps fail closed", () => {
  const base = {
    ...ready,
    source: "match_state" as const,
    nowMs: Date.parse("2026-11-21T14:00:00Z"),
    startedAt: "2026-11-21T12:00:00Z",
    maxDurationMinutes: 120,
  };
  assert.equal(automaticCloudStopCause(base), "duration_limit");
  assert.equal(automaticCloudStopCause({ ...base, nowMs: base.nowMs - 1 }), null);
  assert.equal(automaticCloudStopCause({ ...base, startedAt: "invalid" }), "duration_limit");
  assert.equal(automaticCloudStopCause({ ...base, nowMs: Number.NaN }), "duration_limit");
});

test("limits clamp to a conservative finite range", () => {
  assert.equal(cloudAutoQuota(undefined), 4);
  assert.equal(cloudAutoQuota("0"), 1);
  assert.equal(cloudAutoQuota("999"), 8);
  assert.equal(cloudAutoQuota("NaN"), 4);
  assert.equal(cloudAutoDuration(undefined), 120);
  assert.equal(cloudAutoDuration("1"), 5);
  assert.equal(cloudAutoDuration("999"), 240);
  assert.equal(cloudAutoDuration("bad"), 120);
});
