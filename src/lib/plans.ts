/**
 * What each CricLume plan includes. Kept as one pure table so the pricing page
 * and any future in-app checks read the same rules.
 */
export type PlanId = "starter" | "club" | "league";
export type PlanFeature = "basicScoring" | "scoringAnalytics" | "video" | "customDomain";
export type FeatureAccess = "included" | "addon" | "none";

export const planOrder: PlanId[] = ["starter", "club", "league"];
export const featureOrder: PlanFeature[] = ["basicScoring", "scoringAnalytics", "video", "customDomain"];

export const planFeatures: Record<PlanId, Record<PlanFeature, FeatureAccess>> = {
  // Free: basic scoring only, supported by ads. No analytics, no cameras.
  starter: { basicScoring: "included", scoringAnalytics: "none", video: "none", customDomain: "none" },
  // Paid plans: full scoring analytics. Video & video analytics cost extra.
  club: { basicScoring: "included", scoringAnalytics: "included", video: "addon", customDomain: "none" },
  // League: co-branded club website on the club's own domain (database: club_custom_domain_allowed).
  league: { basicScoring: "included", scoringAnalytics: "included", video: "addon", customDomain: "included" },
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

/** Every plan shows CricLume ad banners: they pay for the free plan and earn paid clubs a share. */
export function showsAds(_plan: PlanId): boolean {
  return true;
}

/**
 * Share of ad money from a club's own screens that goes to the club.
 * Free: 0% (ads cover CricLume's costs). Paid plan: 30%. Paid plan with the video add-on ("full system"): 50%.
 * Must match the database function `promo_share_percent`, which is what payouts use.
 */
export function adRevenueSharePercent(plan: PlanId, options: { videoAddon?: boolean } = {}): number {
  if (plan === "starter") return 0;
  return options.videoAddon === true ? 50 : 30;
}

/**
 * Teams a club may run on each plan (null = as many as it likes). Free clubs get one team;
 * paid clubs add 2nd XIs, age groups, ladies and more. Must match `club_team_limit` in the database.
 */
export function teamLimit(plan: PlanId): number | null {
  return plan === "starter" ? 1 : null;
}
