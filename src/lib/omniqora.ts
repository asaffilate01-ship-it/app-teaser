import { getCloudClient } from "@/lib/cloud";

export type IntelligenceTask =
  | "match_insights"
  | "batting_coach"
  | "bowling_coach"
  | "fielding_review"
  | "training_plan"
  | "analyst_agent";

export const intelligenceTaskOptions: { value: IntelligenceTask; label: string }[] = [
  { value: "match_insights", label: "Match insights" },
  { value: "batting_coach", label: "Batting coach" },
  { value: "bowling_coach", label: "Bowling coach" },
  { value: "fielding_review", label: "Fielding review" },
  { value: "training_plan", label: "Training plan" },
  { value: "analyst_agent", label: "AI match analyst" },
];

export interface IntelligenceRequest {
  requestId: string;
  task: IntelligenceTask;
  status: string;
  requestedAt?: string;
  summary?: string | null;
  recommendations?: string[];
  provider?: string | null;
  model?: string | null;
  humanReviewRequired: true;
}

type GatewayRequest =
  | { operation: "run.list"; organisationId: string; matchId: string }
  | { operation: "run.get"; organisationId: string; matchId: string; requestId: string }
  | { operation: "run.start"; organisationId: string; matchId: string; task: IntelligenceTask };

async function invokeIntelligence<T>(body: GatewayRequest): Promise<T> {
  const { data, error } = await getCloudClient().functions.invoke("omniqora-intelligence", {
    body,
  });
  if (error) {
    // Only the Edge Function's curated error field may be shown to the user.
    const response = error.context;
    if (response instanceof Response) {
      const payload: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      if (payload && typeof payload === "object") {
        const message = (payload as Record<string, unknown>)["error"];
        if (typeof message === "string" && message.length <= 200) {
          throw new Error(message);
        }
      }
    }
    throw new Error("CricLume intelligence is not yet available in Lovable Cloud.");
  }
  return data as T;
}

export async function startIntelligence(input: {
  organisationId: string;
  matchId: string;
  task: IntelligenceTask;
}) {
  return invokeIntelligence<IntelligenceRequest>({
    operation: "run.start",
    ...input,
  });
}

export async function readIntelligence(input: {
  organisationId: string;
  matchId: string;
  requestId: string;
}) {
  return invokeIntelligence<IntelligenceRequest>({
    operation: "run.get",
    ...input,
  });
}

export async function listIntelligence(input: { organisationId: string; matchId: string }) {
  return invokeIntelligence<{ requests: IntelligenceRequest[] }>({
    operation: "run.list",
    ...input,
  });
}
