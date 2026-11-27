import { evaluateReleaseCi, releaseRepository } from "../src/lib/release-ci.ts";

// Read-only: never dispatch workflows, change production, or disclose the token.
const sha = process.env.GITHUB_SHA ?? "";
const token = process.env.GITHUB_TOKEN ?? "";
if (
  process.env.GITHUB_REPOSITORY !== releaseRepository ||
  process.env.GITHUB_REF !== "refs/heads/main" ||
  !/^[a-f0-9]{40}$/.test(sha) ||
  !token
) {
  console.error("Release BLOCKED: missing or incorrect GitHub release context.");
  process.exit(2);
}

try {
  const url = new URL(`https://api.github.com/repos/${releaseRepository}/actions/runs`);
  url.search = new URLSearchParams({
    branch: "main",
    event: "push",
    head_sha: sha,
    per_page: "100",
  }).toString();
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Workflow query failed");
  const result = evaluateReleaseCi(await response.json(), sha);
  console.log(JSON.stringify(result, null, 2));
  if (!result.approved) process.exitCode = 1;
} catch {
  console.error("Release BLOCKED: required workflow results could not be verified.");
  process.exitCode = 2;
}
