/**
 * What each CricLume plan includes. Kept as one pure table so the pricing page
 * and any future in-app checks read the same rules.
 */
export type PlanId = "starter" | "club" | "league";
export type PlanFeature = "basicScoring" | "scoringAnalytics" | "video" | "customDomain";
export type FeatureAccess = "included" | "addon" | "none";

export const planOrder: PlanId[] = ["starter", "club", "league"];
export const featureOrder: PlanFeature[] = [
  "basicScoring",
  "scoringAnalytics",
  "video",
  "customDomain",
];

export const planFeatures: Record<PlanId, Record<PlanFeature, FeatureAccess>> = {
  // Free: basic scoring only, supported by ads. No analytics, no cameras.
  starter: {
    basicScoring: "included",
    scoringAnalytics: "none",
    video: "none",
    customDomain: "none",
  },
  // Paid plans: full scoring analytics. Video & video analytics cost extra.
  club: {
    basicScoring: "included",
    scoringAnalytics: "included",
    video: "addon",
    customDomain: "none",
  },
  // League: co-branded club website on the club's own domain (database: club_custom_domain_allowed).
  league: {
    basicScoring: "included",
    scoringAnalytics: "included",
    video: "addon",
    customDomain: "included",
  },
};

/** Whether a plan can use a feature, given whether the video add-on was bought. */
export function canUseFeature(
  plan: PlanId,
  feature: PlanFeature,
  options: { videoAddon?: boolean } = {},
): boolean {
  const access = planFeatures[readPlanId(plan)][feature];
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
export function adRevenueSharePercent(
  plan: PlanId,
  options: { videoAddon?: boolean } = {},
): number {
  if (readPlanId(plan) === "starter") return 0;
  return options.videoAddon === true ? 50 : 30;
}

/**
 * Teams a club may run on each plan (null = as many as it likes). Free clubs get one team;
 * paid clubs add 2nd XIs, age groups, ladies and more. Must match `club_team_limit` in the database.
 */
export function teamLimit(plan: PlanId): number | null {
  return readPlanId(plan) === "starter" ? 1 : null;
}

/**
 * Whether free clubs are actually blocked from paid screens. Off until live payments are switched on:
 * until then every club is on the free plan, so paid screens show a "Paid plan" badge instead.
 * Turn on at go-live (and add matching database checks for camera rooms at the same time).
 */
export const planLocksEnforced = false;

/** Club workspace sections that belong to a paid feature. Anything not listed is on every plan. */
export const sectionFeature: Partial<Record<string, PlanFeature>> = {
  analysis: "scoringAnalytics",
  intelligence: "scoringAnalytics",
  capture: "video",
};

export type PlanGate = "open" | "badge" | "locked";

/** If the club entitlement RPC fails, NEVER grant an unverified paid feature
 * once paid locks are enabled. The backend must separately enforce entitlements. */
export function gateWhenPlanUnknown(
  feature: PlanFeature | undefined,
  enforced = planLocksEnforced,
): PlanGate {
  if (!feature || feature === "basicScoring") return "open";
  return enforced ? "locked" : "badge";
}

/** What a club sees on a section: open, open with a "Paid plan" badge (before go-live), or locked. */
export function planGate(
  plan: PlanId,
  feature: PlanFeature | undefined,
  options: { videoAddon?: boolean; enforced?: boolean } = {},
): PlanGate {
  if (!feature || canUseFeature(plan, feature, options)) return "open";
  return (options.enforced ?? planLocksEnforced) ? "locked" : "badge";
}

export function readPlanId(value: unknown): PlanId {
  return value === "club" || value === "league" ? value : "starter";
}

export interface PlanAccess {
  plan: PlanId;
  videoAddon: boolean;
}

/** Malformed entitlement responses are unknown, not confirmed free or paid plans. */
export function parsePlanAccess(value: unknown): PlanAccess | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const plan = row["plan"];
  const videoAddon = row["videoAddon"];
  if (
    (plan !== "starter" && plan !== "club" && plan !== "league") ||
    typeof videoAddon !== "boolean"
  )
    return null;
  return { plan, videoAddon: plan !== "starter" && videoAddon };
}
