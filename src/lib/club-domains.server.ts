import { cachedClubHost, isPlatformHost, normaliseHost, rememberClubHost } from "./club-domains";

/** Asks the database which published League-plan club website lives at this domain (cached 5 min). */
export async function resolveClubHost(host: string): Promise<string | null> {
  const h = normaliseHost(host);
  if (isPlatformHost(h)) return null;
  const cached = cachedClubHost(h);
  if (cached !== undefined) return cached;
  const url = process.env["SUPABASE_URL"] ?? (import.meta.env["VITE_SUPABASE_URL"] as string | undefined);
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined);
  if (!url || !key) return null;
  try {
    const response = await fetch(`${url}/rest/v1/rpc/resolve_club_site_domain`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_host: h }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const slug = (await response.json()) as unknown;
    const value = typeof slug === "string" && /^[a-z0-9-]{3,80}$/.test(slug) ? slug : null;
    rememberClubHost(h, value, 5 * 60_000);
    return value;
  } catch {
    // Not cached: the next visit tries again.
    return null;
  }
}
