import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { approvedProjectRef } from "../src/lib/release-readiness.ts";

const script = "verification/release-gate.mjs";
const sha = "a".repeat(40);

test("release workflow refuses to claim success without production evidence", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", script, "p0"], {
    encoding: "utf8",
    env: {
      ...process.env,
      CRICLUME_RELEASE_EVIDENCE_JSON: "",
      CRICLUME_RELEASE_SHA: sha,
    },
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /release blocked/i);
});

test("wrong-project evidence cannot unlock even the P0 release gate", () => {
  const result = spawnSync(process.execPath, ["--experimental-strip-types", script, "p0"], {
    encoding: "utf8",
    env: {
      ...process.env,
      CRICLUME_RELEASE_EVIDENCE_JSON: JSON.stringify({
        projectRef: "ebzinvoxundsdubczqfg",
        releaseSha: sha,
        checks: {},
      }),
      CRICLUME_RELEASE_SHA: sha,
    },
  });
  assert.equal(result.status, 1);
  const output = JSON.parse(result.stdout) as {
    approved: boolean;
    correctProjectAndCommit: boolean;
    blockedBy: string[];
  };
  assert.equal(output.approved, false);
  assert.equal(output.correctProjectAndCommit, false);
  assert.ok(output.blockedBy.length > 0);
  assert.notEqual(approvedProjectRef, "ebzinvoxundsdubczqfg");
});
