import type { MatchRecord } from "@/lib/platform-cloud";
import type { IntelligenceTask } from "@/lib/omniqora";

type MatchSnapshot = Pick<MatchRecord, "liveState" | "status" | "updatedAt">;
export type CricketPreview = {
  mode: "deterministic";
  headline: string;
  facts: string[];
  coachingPrompts: string[];
  limitations: string[];
  sourceUpdatedAt: string;
};

function integer(value: unknown, max: number): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max
    ? value
    : null;
}

function recentBalls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(["0", "1", "2", "3", "4", "5", "6", "W", "Wd", "Nb", "·"]);
  return value.slice(-6).flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const label = (entry as Record<string, unknown>)["label"];
    return typeof label === "string" && allowed.has(label) ? [label] : [];
  });
}

/**
 * Useful even before GenAI is activated. These are deterministic scoreboard
 * observations and prompts, NOT AI predictions, technique assessments or
 * recommendations derived from player profiles or video.
 */
export function buildCricketPreview(match: MatchSnapshot, task: IntelligenceTask): CricketPreview {
  const data = match.liveState ?? {};
  const runs = integer(data["runs"], 2000);
  const wickets = integer(data["wickets"], 10);
  const target = integer(data["target"], 3000);
  const overs =
    typeof data["overs"] === "string" && /^\d{1,3}\.[0-5]$/.test(data["overs"])
      ? data["overs"]
      : null;
  const balls = recentBalls(data["recent"]);
  const facts: string[] = [];
  const coachingPrompts: string[] = [];
  const limitations = [
    "Based on available aggregate scoring only; no player identities or video were analysed.",
    "These are rules-based prompts, not GenAI output or validated coaching decisions.",
  ];

  if (runs !== null && wickets !== null) {
    facts.push(`Score: ${runs}/${wickets}${overs ? ` after ${overs} overs` : ""}.`);
  } else {
    facts.push("A complete score is not available yet; add confirmed deliveries first.");
  }

  if (runs !== null && target !== null && target > 0) {
    const needed = Math.max(0, target - runs);
    facts.push(
      needed > 0
        ? `The batting side needs ${needed} more run${needed === 1 ? "" : "s"} to reach the target.`
        : "The recorded target has been reached.",
    );
  }

  if (overs && runs !== null) {
    const [completedOvers, ballsInOver] = overs.split(".").map(Number);
    const legalBalls = (completedOvers ?? 0) * 6 + (ballsInOver ?? 0);
    if (legalBalls > 0) {
      const rr = (runs * 6) / legalBalls;
      facts.push(`Run rate: ${rr.toFixed(2)} (assuming six-ball overs).`);
    }
  }

  if (balls.length > 0) {
    const extras = balls.filter((ball) => ball === "Wd" || ball === "Nb").length;
    const boundaries = balls.filter((ball) => ball === "4" || ball === "6").length;
    facts.push(
      `Last ${balls.length} scored events: ${boundaries} boundaries and ${extras} recorded wide/no-ball markers.`,
    );
    if (extras > 0)
      coachingPrompts.push(
        `Review bowling control: ${extras} wide/no-ball marker${extras === 1 ? "" : "s"} among the recent entries.`,
      );
    if (boundaries > 0)
      coachingPrompts.push(
        `Discuss the ${boundaries} recent boundary ${boundaries === 1 ? "event" : "events"} and how field positioning could be reviewed.`,
      );
  } else {
    limitations.push("Recent delivery details are unavailable for this match.");
  }

  if (wickets !== null && wickets >= 6) {
    coachingPrompts.push(
      `With ${wickets} wickets recorded, discuss batting partnerships and risk management.`,
    );
  }

  switch (task) {
    case "batting_coach":
      coachingPrompts.push(
        "Discuss strike rotation and running between wickets; individual shot technique is not available from the aggregate score.",
      );
      break;
    case "bowling_coach":
      coachingPrompts.push(
        "Plan a line-and-length practice drill; use delivery-level evidence before evaluating individual bowlers.",
      );
      break;
    case "fielding_review":
      coachingPrompts.push(
        "Collect fielding positions and consented footage for coach review; the scoreboard alone cannot show dropped catches.",
      );
      break;
    case "training_plan":
      coachingPrompts.push(
        "Propose a short warm-up, a skills block on batting/bowling control, and a coach-led review of the match.",
      );
      break;
    case "analyst_agent":
      coachingPrompts.push(
        "Check for incomplete or contradictory match evidence before drafting an intelligence report; no tools or external actions are executed.",
      );
      break;
    case "match_insights":
      coachingPrompts.push(
        "Review the scoring trend with the match scorer and note that a single snapshot cannot establish a change in momentum.",
      );
      break;
  }

  return {
    mode: "deterministic",
    headline:
      task === "training_plan" ? "Coach-led training preview" : "Evidence-based cricket preview",
    facts,
    coachingPrompts: [...new Set(coachingPrompts)],
    limitations,
    sourceUpdatedAt: match.updatedAt,
  };
}
