/**
 * What each CricLume plan includes. Kept as one pure table so the pricing page
 * and any future in-app checks read the same rules.
 */
export type PlanId = "starter" | "club" | "league";
export type PlanFeature = "basicScoring" | "scoringAnalytics" | "video";
export type FeatureAccess = "included" | "addon" | "none";

export const planOrder: PlanId[] = ["starter", "club", "league"];
export const featureOrder: PlanFeature[] = ["basicScoring", "scoringAnalytics", "video"];

export const planFeatures: Record<PlanId, Record<PlanFeature, FeatureAccess>> = {
  // Free: basic scoring only, supported by ads. No analytics, no cameras.
  starter: { basicScoring: "included", scoringAnalytics: "none", video: "none" },
  // Paid plans: full scoring analytics. Video & video analytics cost extra.
  club: { basicScoring: "included", scoringAnalytics: "included", video: "addon" },
  league: { basicScoring: "included", scoringAnalytics: "included", video: "addon" },
};

/** Whether a plan can use a feature, given whether the video add-on was bought. */
export function canUseFeature(
  plan: PlanId,
  feature: PlanFeature,
  options: { videoAddon?: boolean } = {},
): boolean {
  const access = planFeatures[plan][feature];
  if (access === "included") return true;
  if (access === "addon") return options.videoAddon === true;
  return false;
}

/** Only the free plan carries advertising. */
export function showsAds(plan: PlanId): boolean {
  return plan === "starter";
}
