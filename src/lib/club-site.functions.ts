import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { siteFilePaths, type PublicClubSite } from "./club-site";

/** Public read of a club or league website. Only published sites come back in full; files get one-hour links. */
export const getClubSite = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().regex(/^[a-z0-9-]{3,80}$/) }).parse(data))
  .handler(async ({ data }): Promise<PublicClubSite | null> => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return null;
    const headers = { apikey: key, "Content-Type": "application/json" };
    const response = await fetch(`${url}/rest/v1/rpc/get_club_site`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_slug: data.slug }),
    });
    if (!response.ok) return null;
    const site = (await response.json()) as PublicClubSite | null;
    if (!site || typeof site.name !== "string") return null;
    const paths = site.published ? siteFilePaths(site) : [];
    site.files = {};
    if (paths.length > 0) {
      const signed = await fetch(`${url}/storage/v1/object/sign/club-site`, {
        method: "POST",
        headers,
        body: JSON.stringify({ expiresIn: 3600, paths }),
      });
      if (signed.ok) {
        // Links the visitor's browser opens must use the public backend address, not the server-side one.
        const browserBase = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ?? url;
        const rows = (await signed.json()) as Array<{ path: string; signedURL: string | null }>;
        for (const row of rows) if (row.signedURL) site.files[row.path] = `${browserBase}/storage/v1${row.signedURL}`;
      }
    }
    return site;
  });
