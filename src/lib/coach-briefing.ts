import type { CricketPreview } from "./cricket-insights";

const singleLine = (value: string) =>
  value.replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 300);

/**
 * Export the free deterministic coach briefing only.
 * No model, media or player profile is used to produce this document.
 */
export function coachBriefingMarkdown(preview: CricketPreview): string {
  const items = (values: string[]) =>
    values.length ? values.map((item) => `- ${singleLine(item)}`).join("\n") : "- None recorded";
  return [
    "# CricLume — Coach discussion briefing",
    "",
    "**Source:** Selected match's stored aggregate scoreboard",
    "**Analysis type:** Deterministic, rules-based preview; not AI inference",
    `**Score revision updated:** ${singleLine(preview.sourceUpdatedAt)}`,
    "**Human review:** Required before sharing recommendations",
    "",
    "## Recorded score facts",
    items(preview.facts),
    "",
    "## Discussion prompts (not verified technical assessments)",
    items(preview.coachingPrompts),
    "",
    "## Important limitations",
    items(preview.limitations),
    "",
    "This briefing is advisory. It does not update or certify official match records.",
    "",
  ].join("\n");
}
