/** Check exact-commit push workflows independently of manual release evidence. */
export const releaseRepository = "asaffilate01-ship-it/app-teaser";

export const requiredReleaseWorkflows = [
  ".github/workflows/ci.yml",
  ".github/workflows/security.yml",
  ".github/workflows/camera-edge-check.yml",
  ".github/workflows/camera-long-transfer.yml",
] as const;

type WorkflowStatus = "passed" | "pending" | "failed" | "missing" | "invalid";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function evaluateReleaseCi(payload: unknown, sha: string) {
  const valid =
    /^[a-f0-9]{40}$/i.test(sha) &&
    record(payload) &&
    Array.isArray(payload.workflow_runs) &&
    payload.workflow_runs.length <= 100 &&
    payload.total_count === payload.workflow_runs.length &&
    payload.workflow_runs.every(record);
  const runs: Record<string, unknown>[] = valid ? payload.workflow_runs : [];
  const checks = requiredReleaseWorkflows.map((path) => {
    let status: WorkflowStatus = valid ? "missing" : "invalid";
    const matching = runs.filter(
      (run) =>
        run.path === path &&
        run.head_sha === sha &&
        run.head_branch === "main" &&
        run.event === "push" &&
        record(run.repository) &&
        run.repository.full_name === releaseRepository,
    );
    let latest: { number: number; attempt: number; run: Record<string, unknown> } | null =
      null;
    for (const run of matching) {
      if (!positiveInteger(run.run_number) || !positiveInteger(run.run_attempt)) {
        return { path, status: "invalid" as const };
      }
      const number = run.run_number;
      const attempt = run.run_attempt;
      if (latest && number === latest.number && attempt === latest.attempt) {
        return { path, status: "invalid" as const };
      }
      if (
        !latest ||
        number > latest.number ||
        (number === latest.number && attempt > latest.attempt)
      ) {
        latest = { number, attempt, run };
      }
    }
    if (latest) {
      const run = latest.run;
      if (typeof run.status !== "string") status = "invalid";
      else if (run.status !== "completed") status = "pending";
      else status = run.conclusion === "success" ? "passed" : "failed";
    }
    return { path, status };
  });
  return { approved: checks.every((check) => check.status === "passed"), checks };
}
