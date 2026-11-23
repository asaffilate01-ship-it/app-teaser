import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { friendly } from "./club-office-cloud";
import type { PlatformRole } from "./platform";

type Tables = Database["public"]["Tables"];
export type SiteRow = Tables["club_sites"]["Row"];
export type SitePostRow = Tables["club_site_posts"]["Row"];
export type SitePhotoRow = Tables["club_site_photos"]["Row"];

export const siteEditorRoles: readonly PlatformRole[] = ["owner", "club_admin", "league_admin"];
export const canEditSite = (role: PlatformRole) => siteEditorRoles.includes(role);

export const siteFileTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const maxSiteFileBytes = 10 * 1024 * 1024;

export interface SiteEditorData {
  site: SiteRow | null;
  orgSlug: string;
  posts: SitePostRow[];
  photos: SitePhotoRow[];
  files: Record<string, string>;
}

function check<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(friendly(result.error.message));
  return result;
}

export async function loadSiteEditor(organisationId: string): Promise<SiteEditorData> {
  const [site, org, posts, photos] = await Promise.all([
    supabase.from("club_sites").select("*").eq("organisation_id", organisationId).maybeSingle(),
    supabase.from("organisations").select("slug").eq("id", organisationId).single(),
    supabase.from("club_site_posts").select("*").eq("organisation_id", organisationId).order("created_at", { ascending: false }),
    supabase.from("club_site_photos").select("*").eq("organisation_id", organisationId).order("created_at", { ascending: false }),
  ]);
  check(site);
  check(org);
  check(posts);
  check(photos);
  const paths = [site.data?.hero_path, ...(photos.data ?? []).map((p) => p.path), ...(posts.data ?? []).map((p) => p.file_path)].filter(
    (path): path is string => Boolean(path),
  );
  const files: Record<string, string> = {};
  if (paths.length) {
    const signed = await supabase.storage.from("club-site").createSignedUrls(paths, 3600);
    for (const row of signed.data ?? []) if (row.path && row.signedUrl) files[row.path] = row.signedUrl;
  }
  return { site: site.data, orgSlug: org.data?.slug ?? "", posts: posts.data ?? [], photos: photos.data ?? [], files };
}

export function checkSiteFile(file: File, imagesOnly = false): string | null {
  const allowed: readonly string[] = imagesOnly ? siteFileTypes.filter((t) => t.startsWith("image/")) : siteFileTypes;
  if (!allowed.includes(file.type)) return imagesOnly ? "Choose a JPG, PNG or WebP photo." : "Choose a photo (JPG, PNG, WebP) or a PDF.";
  if (file.size > maxSiteFileBytes) return "That file is over 10 MB. Please choose a smaller one.";
  return null;
}

export async function uploadSiteFile(organisationId: string, folder: "hero" | "photos" | "docs", file: File): Promise<string> {
  const problem = checkSiteFile(file, folder !== "docs");
  if (problem) throw new Error(problem);
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${organisationId}/${folder}/${crypto.randomUUID()}.${ext}`;
  check(await supabase.storage.from("club-site").upload(path, file, { contentType: file.type, upsert: false }));
  return path;
}

export async function removeSiteFile(path: string | null | undefined) {
  if (path) await supabase.storage.from("club-site").remove([path]);
}

export const siteCloud = {
  async save(organisationId: string, patch: Omit<Tables["club_sites"]["Insert"], "organisation_id">) {
    check(await supabase.from("club_sites").upsert({ organisation_id: organisationId, ...patch }, { onConflict: "organisation_id" }));
  },
  async addPost(input: Tables["club_site_posts"]["Insert"]) {
    check(await supabase.from("club_site_posts").insert(input));
  },
  async updatePost(id: string, patch: Tables["club_site_posts"]["Update"]) {
    check(await supabase.from("club_site_posts").update(patch).eq("id", id));
  },
  async deletePost(post: SitePostRow) {
    check(await supabase.from("club_site_posts").delete().eq("id", post.id));
    await removeSiteFile(post.file_path);
  },
  async addPhoto(organisationId: string, file: File, caption: string) {
    const path = await uploadSiteFile(organisationId, "photos", file);
    const result = await supabase.from("club_site_photos").insert({ organisation_id: organisationId, path, caption, consent_confirmed: true });
    if (result.error) {
      await removeSiteFile(path);
      throw new Error(friendly(result.error.message));
    }
  },
  async deletePhoto(photo: SitePhotoRow) {
    check(await supabase.from("club_site_photos").delete().eq("id", photo.id));
    await removeSiteFile(photo.path);
  },
};
