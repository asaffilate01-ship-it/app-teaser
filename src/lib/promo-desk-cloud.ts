import { getCloudClient } from "@/lib/cloud";
import type { PromoSlot, PromoSurface } from "@/lib/promo-targeting";

/** Data for CricLume's ads desk. Every read and write is limited to CricLume staff by the database. */
export interface PromoCampaign {
  id: string;
  advertiser: string;
  name: string;
  status: "draft" | "live" | "paused" | "ended";
  starts_on: string;
  ends_on: string | null;
  price_amount: number;
  currency: string;
  click_url: string | null;
  countries: string[];
  regions: string[];
  cities: string[];
  surfaces: PromoSurface[];
  weight: number;
}

export interface PromoCreative {
  id: string;
  campaign_id: string;
  slot: PromoSlot;
  media_path: string;
  media_kind: "image" | "video";
  duration_seconds: number;
  alt_text: string;
  active: boolean;
}

export type CampaignDraft = Omit<PromoCampaign, "id">;

export async function isPromoStaff(userId: string): Promise<boolean> {
  const { data, error } = await getCloudClient().rpc("has_role", { _user_id: userId, _role: "admin" });
  return !error && data === true;
}

export async function loadDesk(): Promise<{ campaigns: PromoCampaign[]; creatives: PromoCreative[]; plays: Record<string, number> }> {
  const client = getCloudClient();
  const [campaigns, creatives, counts] = await Promise.all([
    client.from("promo_campaigns").select("*").order("created_at", { ascending: false }),
    client.from("promo_creatives").select("*").order("created_at"),
    client.from("promo_play_counts").select("campaign_id, plays").limit(10000),
  ]);
  if (campaigns.error) throw campaigns.error;
  if (creatives.error) throw creatives.error;
  const plays: Record<string, number> = {};
  for (const row of counts.data ?? []) plays[row.campaign_id] = (plays[row.campaign_id] ?? 0) + row.plays;
  return { campaigns: (campaigns.data ?? []) as PromoCampaign[], creatives: (creatives.data ?? []) as PromoCreative[], plays };
}

export async function saveCampaign(id: string | null, draft: CampaignDraft): Promise<string> {
  const client = getCloudClient();
  const row = { ...draft, updated_at: new Date().toISOString() };
  if (id) {
    const { error } = await client.from("promo_campaigns").update(row).eq("id", id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await client.from("promo_campaigns").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function setCampaignStatus(id: string, status: PromoCampaign["status"]): Promise<void> {
  const { error } = await getCloudClient().from("promo_campaigns").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteCampaign(id: string, paths: string[]): Promise<void> {
  const client = getCloudClient();
  const { error } = await client.from("promo_campaigns").delete().eq("id", id);
  if (error) throw error;
  if (paths.length) await client.storage.from("promo-media").remove(paths);
}

const allowedTypes: Record<string, "image" | "video"> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/gif": "image",
  "image/webp": "image",
  "video/mp4": "video",
};

/** Upload an image, GIF or MP4 for one banner of a campaign. */
export async function uploadCreative(
  campaignId: string,
  slot: PromoSlot,
  file: File,
  options: { durationSeconds: number; altText: string },
): Promise<void> {
  const kind = allowedTypes[file.type];
  if (!kind) throw new Error("Use a PNG, JPG, GIF, WebP image or an MP4 video.");
  if (file.size > 50 * 1024 * 1024) throw new Error("Files can be up to 50 MB.");
  const client = getCloudClient();
  const extension = (file.name.split(".").pop() ?? (kind === "video" ? "mp4" : "png")).toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${campaignId}/${slot}-${crypto.randomUUID().slice(0, 8)}.${extension || "bin"}`;
  const upload = await client.storage.from("promo-media").upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) throw upload.error;
  const { error } = await client.from("promo_creatives").insert({
    campaign_id: campaignId,
    slot,
    media_path: path,
    media_kind: kind,
    duration_seconds: Math.max(3, Math.min(60, Math.round(options.durationSeconds))),
    alt_text: options.altText.slice(0, 200),
  });
  if (error) {
    await client.storage.from("promo-media").remove([path]);
    throw error;
  }
}

export async function setCreativeActive(id: string, active: boolean): Promise<void> {
  const { error } = await getCloudClient().from("promo_creatives").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function deleteCreative(creative: PromoCreative): Promise<void> {
  const client = getCloudClient();
  const { error } = await client.from("promo_creatives").delete().eq("id", creative.id);
  if (error) throw error;
  await client.storage.from("promo-media").remove([creative.media_path]);
}

export async function previewLinks(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await getCloudClient().storage.from("promo-media").createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  return out;
}

export interface PayoutRow {
  organisation_id: string;
  organisation_name: string;
  currency: string;
  plays: number;
  estimated_earnings: number;
}

export async function loadPayouts(from: string, to: string): Promise<PayoutRow[]> {
  const { data, error } = await getCloudClient().rpc("admin_promo_payouts", { p_from: from, p_to: to });
  if (error) throw error;
  return (data ?? []) as PayoutRow[];
}

export interface ClubPlanRow {
  organisation_id: string;
  organisation_name: string;
  kind: string;
  plan: "starter" | "club" | "league";
  status: string;
  video_addon: boolean;
}

export async function loadClubPlans(): Promise<ClubPlanRow[]> {
  const { data, error } = await getCloudClient().rpc("admin_club_plans");
  if (error) throw error;
  return (data ?? []) as ClubPlanRow[];
}

export async function setClubPlan(organisationId: string, plan: ClubPlanRow["plan"], videoAddon: boolean): Promise<void> {
  const { error } = await getCloudClient().rpc("admin_set_club_plan", { p_organisation_id: organisationId, p_plan: plan, p_video_addon: videoAddon });
  if (error) throw error;
}
