import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateReleaseCi,
  releaseRepository,
  requiredReleaseWorkflows,
} from "../src/lib/release-ci.ts";

const sha = "a".repeat(40);
const green = () =>
  requiredReleaseWorkflows.map((path) => ({
    path,
    run_number: 10,
    run_attempt: 1,
    head_sha: sha,
    head_branch: "main",
    event: "push",
    repository: { full_name: releaseRepository },
    status: "completed",
    conclusion: "success",
  }));
const payload = (runs: unknown[]) => ({ total_count: runs.length, workflow_runs: runs });

test("all four exact-commit main push workflows must succeed", () => {
  assert.equal(evaluateReleaseCi(payload(green()), sha).approved, true);
  assert.equal(evaluateReleaseCi(payload(green().slice(1)), sha).approved, false);
  assert.equal(evaluateReleaseCi(payload(green()), "b".repeat(40)).approved, false);
  for (const change of [
    { head_branch: "feature" },
    { event: "pull_request" },
    { repository: { full_name: "other/repo" } },
    { conclusion: "skipped" },
  ]) {
    const runs = green();
    runs[0] = { ...runs[0]!, ...change };
    assert.equal(evaluateReleaseCi(payload(runs), sha).approved, false);
  }
});

test("a newer pending or failed run cannot be hidden by an older green run", () => {
  const runs = green();
  const first = runs[0]!;
  const newer = { ...first, run_number: 11, status: "queued" };
  const retry = { ...first, run_attempt: 2, conclusion: "failure" };
  for (const run of [newer, retry]) {
    assert.equal(evaluateReleaseCi(payload([...runs, run]), sha).approved, false);
    assert.equal(evaluateReleaseCi(payload([run, ...runs]), sha).approved, false);
  }
});

test("truncated, malformed and duplicate workflow records fail closed", () => {
  const runs = green();
  for (const data of [
    null,
    { total_count: 1000, workflow_runs: runs },
    payload([...runs, null]),
    payload([...runs, runs[0]]),
    payload([{ ...runs[0], run_attempt: 0 }, ...runs.slice(1)]),
  ]) {
    assert.equal(evaluateReleaseCi(data, sha).approved, false);
  }
});
