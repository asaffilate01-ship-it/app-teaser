/**
 * CricLume -> Omniqora Intelligence, v1.
 *
 * No client-selected prompt, model, provider, tools, child profiles or video
 * travels across this boundary. Inputs come from CricLume's verified database.
 */
export const cricketIntelligenceTasks = {
  match_insights: {
    label: "Match insights",
    goal: "Review the supplied aggregate cricket score. Explain momentum, scoring patterns, and uncertainty. Cite only provided numbers. Draft insights for a human coach; never amend scores.",
  },
  batting_coach: {
    label: "Batting coach",
    goal: "Draft practical batting and running-between-wickets coaching ideas based only on the supplied aggregate cricket data. Do not fabricate individual-player statistics or identify children.",
  },
  bowling_coach: {
    label: "Bowling coach",
    goal: "Prepare a bowler strategy and extras-reduction coaching draft from aggregate scoring patterns. Distinguish measured facts from hypotheses and request human review.",
  },
  fielding_review: {
    label: "Fielding review",
    goal: "Propose a fielding-practice checklist from the limited aggregate score evidence. State explicitly when catches, individual field positions or video evidence are unavailable.",
  },
  training_plan: {
    label: "Training plan",
    goal: "Draft a flexible team training session for a cricket coach based on supplied match aggregates. Do not diagnose or profile an individual athlete; coaches approve before use.",
  },
  analyst_agent: {
    label: "AI match analyst",
    goal: "Act as a read-only cricket analysis agent: inspect supplied match aggregates, identify missing evidence, draft match insights and practical next steps. Do not call write tools, change scores, message players, publish content or make autonomous decisions.",
  },
} as const;

export type CricketIntelligenceTask = keyof typeof cricketIntelligenceTasks;
export type CricketIntelligenceOperation = "run.start" | "run.get" | "run.list";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && uuidPattern.test(value);

export function isCricketTask(value: unknown): value is CricketIntelligenceTask {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(cricketIntelligenceTasks, value);
}

export function parseCricketIntelligenceRequest(value: unknown):
  | { operation: "run.start"; organisationId: string; matchId: string; task: CricketIntelligenceTask }
  | { operation: "run.get"; organisationId: string; matchId: string; requestId: string }
  | { operation: "run.list"; organisationId: string; matchId: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request.");
  const input = value as Record<string, unknown>;
  if (!isUuid(input.organisationId) || !isUuid(input.matchId)) {
    throw new Error("A valid organisation and match are required.");
  }
  if (input.operation === "run.start" && isCricketTask(input.task)) {
    return { operation: "run.start", organisationId: input.organisationId, matchId: input.matchId, task: input.task };
  }
  if (input.operation === "run.get" && isUuid(input.requestId)) {
    return { operation: "run.get", organisationId: input.organisationId, matchId: input.matchId, requestId: input.requestId };
  }
  if (input.operation === "run.list") {
    return { operation: "run.list", organisationId: input.organisationId, matchId: input.matchId };
  }
  throw new Error("Unsupported intelligence request.");
}

const integerOrNull = (value: unknown, max: number): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max
    ? value
    : null;

export function privacySafeMatchContext(value: unknown, status: unknown) {
  const data = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const overs = typeof data.overs === "string" && /^\d{1,3}\.\d$/.test(data.overs)
    ? data.overs
    : null;
  const recent = Array.isArray(data.recent)
    ? data.recent.slice(-6).map((entry) => {
        const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
        return typeof item.label === "string" &&
          ["0", "1", "2", "3", "4", "5", "6", "W", "Wd", "Nb", "·"].includes(item.label)
          ? item.label
          : "?";
      })
    : [];
  // Intentionally exclude names, IDs, DOB, video, biometrics, consent records,
  // user-entered notes, medical details and the full match snapshot.
  return {
    runs: integerOrNull(data.runs, 2000),
    wickets: integerOrNull(data.wickets, 10),
    overs,
    target: integerOrNull(data.target, 3000),
    recent,
    matchStatus: ["live", "completed", "innings_break", "draft", "scheduled"].includes(String(status))
      ? String(status)
      : "unknown",
    evidencePolicy: "aggregates_only;no_children_or_biometrics;human_review_required",
  };
}

export function omniqoraEndpoint(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/api/platform/intelligence"
  ) throw new Error("Omniqora endpoint must be the approved HTTPS intelligence API.");
  return url.href;
}

export function omniqoraStartPayload(input: {
  tenantId: string;
  task: CricketIntelligenceTask;
  matchId: string;
  status: unknown;
  liveState: unknown;
}) {
  if (!isUuid(input.tenantId) || !isUuid(input.matchId)) throw new Error("Invalid intelligence binding.");
  return {
    operation: "run.start" as const,
    tenantId: input.tenantId,
    productKey: "criclume" as const,
    profile: "operations" as const,
    goal: cricketIntelligenceTasks[input.task].goal,
    maxSteps: input.task === "analyst_agent" ? 5 : 3,
    inputVersion: "criclume.aggregate.v1",
    context: {
      task: input.task,
      match: privacySafeMatchContext(input.liveState, input.status),
      // Cricket source match ID permits traceability; no user/player IDs.
      source: "criclume",
      approval: "advisory_only",
    },
    sourceRefs: [`criclume:match:${input.matchId}`],
  };
}

export type OmniqoraRunView = {
  status: string;
  summary: string | null;
  recommendations: string[];
  provider: string | null;
  model: string | null;
  humanReviewRequired: true;
};

export function safeRunView(value: unknown): OmniqoraRunView {
  const response = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const raw = response.run && typeof response.run === "object"
    ? (response.run as Record<string, unknown>)
    : {};
  const result = raw.result && typeof raw.result === "object"
    ? (raw.result as Record<string, unknown>)
    : {};
  const status = typeof raw.status === "string" && [
    "queued", "running", "waiting_review", "completed", "failed", "cancelled", "stale",
  ].includes(raw.status) ? raw.status : "queued";
  const summaryValue = result.summary ?? result.answer ?? result.text ?? null;
  const summary = typeof summaryValue === "string" ? summaryValue.slice(0, 6000) : null;
  const suggestions = result.recommendations ?? result.suggestions ?? result.findings ?? [];
  const recommendations = Array.isArray(suggestions)
    ? suggestions.slice(0, 8).map((item) => {
        if (typeof item === "string") return item.slice(0, 600);
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const text = record.suggestion ?? record.message ?? record.text;
          return typeof text === "string" ? text.slice(0, 600) : "";
        }
        return "";
      }).filter(Boolean)
    : [];
  return {
    status,
    summary,
    recommendations,
    provider: typeof raw.provider_key === "string" ? raw.provider_key.slice(0, 100) : null,
    model: typeof raw.model === "string" ? raw.model.slice(0, 120) : null,
    humanReviewRequired: true,
  };
}
