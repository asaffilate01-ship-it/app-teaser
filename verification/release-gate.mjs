import {
  evaluateReleaseEvidence,
  releasePhases,
} from "../src/lib/release-readiness.ts";

// Run ONLY against evidence independently collected from the correct live
// CricLume environment. This does not connect to, deploy or alter production.
const phase = process.argv[2];
if (!releasePhases.includes(phase)) {
  console.error("Usage: node --experimental-strip-types verification/release-gate.mjs p0|p1|p2|p3");
  process.exit(2);
}
const expectedSha = process.env.CRICLUME_RELEASE_SHA ?? process.env.GITHUB_SHA ?? "";
const raw = process.env.CRICLUME_RELEASE_EVIDENCE_JSON ?? "";
if (!raw) {
  console.error(
    "Release BLOCKED: provide reviewed CRICLUME_RELEASE_EVIDENCE_JSON using a protected secret.",
  );
  process.exit(2);
}
let bundle;
try {
  bundle = JSON.parse(raw);
  if (
    !bundle ||
    typeof bundle !== "object" ||
    Array.isArray(bundle) ||
    typeof bundle.projectRef !== "string" ||
    typeof bundle.releaseSha !== "string" ||
    !bundle.checks ||
    typeof bundle.checks !== "object" ||
    Array.isArray(bundle.checks)
  ) throw new Error("Invalid evidence bundle");
} catch {
  console.error("Release BLOCKED: invalid structured release evidence.");
  process.exit(2);
}

const report = evaluateReleaseEvidence(bundle, phase, expectedSha, Date.now());
console.log(
  JSON.stringify(
    {
      phase,
      approved: report.approved,
      correctProjectAndCommit: report.environmentMatched,
      results: report.results,
      blockedBy: report.blockers,
      // Deliberately omit evidence references, verifier names and any credentials.
    },
    null,
    2,
  ),
);
if (!report.approved) process.exitCode = 1;
