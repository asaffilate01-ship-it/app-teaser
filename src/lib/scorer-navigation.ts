/**
 * Match-day navigation is shared by desktop tabs and the mobile bottom rail.
 * The scoring action stays first and can never be pushed into a More menu.
 */
export const scorerDestinations = [
  { id: "score", label: "Score", mobileLabel: "Score" },
  { id: "timeline", label: "Timeline", mobileLabel: "Balls" },
  { id: "scorecard", label: "Scorecard", mobileLabel: "Card" },
  { id: "analysis", label: "Analysis", mobileLabel: "Analysis" },
  { id: "video", label: "Video lab", mobileLabel: "Video" },
] as const;

export type ScorerDestination = (typeof scorerDestinations)[number]["id"];
export const defaultScorerDestination: ScorerDestination = "score";
