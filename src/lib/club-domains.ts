/**
 * Club websites on a club's own domain or a free riverside.criclume.com address (League plan). A visitor to e.g. riversidecc.com sees
 * that club's website at clean addresses (/, /fixtures, /news, /gallery); everything else on
 * that domain is sent to criclume.com. The edge worker (src/server.ts) looks the domain up and
 * remembers it here; the router (src/router.tsx) maps the clean addresses to /club/<slug>/….
 * In the browser the slug comes from a <meta> tag the server writes into the page.
 */
export const CLUB_SITE_META = "criclume-club-site";
export const PLATFORM_ORIGIN = "https://criclume.com";

const platformExact = new Set(["criclume.com", "www.criclume.com", "localhost", "127.0.0.1", "[::1]"]);
const platformSuffixes = [
  ".lovable.app",
  ".lovable.dev",
  ".lovableproject.com",
  ".lovableproject-dev.com",
  ".gpt-eng.com",
  ".gptengineer.run",
];

export function normaliseHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}

/**
 * A free club address like riverside.criclume.com (one name in front of criclume.com), or null.
 * www and deeper names (a.b.criclume.com) stay CricLume's own.
 */
export function criclumeClubLabel(host: string): string | null {
  const h = normaliseHost(host);
  if (!h.endsWith(".criclume.com")) return null;
  const label = h.slice(0, -".criclume.com".length);
  if (!label || label === "www" || label.includes(".")) return null;
  return label;
}

/** CricLume's own addresses (and previews) never need a club lookup. */
export function isPlatformHost(host: string): boolean {
  const h = normaliseHost(host);
  if (platformExact.has(h)) return true;
  if (h.endsWith(".criclume.com")) return criclumeClubLabel(h) === null;
  return platformSuffixes.some((suffix) => h.endsWith(suffix));
}

/** Pages a club website has at its own domain. */
export function isClubSitePath(pathname: string): boolean {
  return /^\/(?:fixtures|gallery|news(?:\/[A-Za-z0-9-]{1,80})?)?\/?$/.test(pathname);
}

/** Files, server calls and dev-server internals pass straight through on any domain. */
export function isInfraPath(pathname: string): boolean {
  if (/^\/(?:_serverFn|_build|assets|api|__l5e|@|src|node_modules|\.well-known|~)(?:\/|$)/.test(pathname)) return true;
  const last = pathname.split("/").pop() ?? "";
  return last.includes(".");
}

/** Clean address on the club's domain → the app's own page address. */
export function toInternalPath(pathname: string, slug: string): string {
  if (pathname.startsWith(`/club/${slug}`) || isInfraPath(pathname) || !isClubSitePath(pathname)) return pathname;
  const rest = pathname.replace(/\/$/, "");
  return `/club/${slug}${rest}`;
}

/** The app's page address → clean address on the club's domain (or unchanged). */
export function toExternalPath(pathname: string, slug: string): string {
  const base = `/club/${slug}`;
  if (pathname === base || pathname === `${base}/`) return "/";
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length);
  return pathname;
}

/**
 * Where a request on a club's own domain should go instead, or null to serve it.
 * - files and server calls: serve
 * - /club/<slug>/news → /news (one address per page)
 * - the club's pages: serve
 * - anything else (sign-in, app, other clubs…): criclume.com
 */
export function clubDomainRedirect(url: URL, slug: string): string | null {
  const { pathname, search } = url;
  if (isInfraPath(pathname)) return null;
  if (pathname === `/club/${slug}` || pathname.startsWith(`/club/${slug}/`)) {
    return `${toExternalPath(pathname, slug)}${search}`;
  }
  if (isClubSitePath(pathname)) return null;
  return `${PLATFORM_ORIGIN}${pathname}${search}`;
}

// ---- Which club lives at which domain (server memory + page meta) ----

type CacheEntry = { slug: string | null; expires: number };
const hostCache = new Map<string, CacheEntry>();
const MAX_HOSTS = 500;

export function rememberClubHost(host: string, slug: string | null, ttlMs: number, now = Date.now()) {
  if (hostCache.size >= MAX_HOSTS) hostCache.delete(hostCache.keys().next().value as string);
  hostCache.set(normaliseHost(host), { slug, expires: now + ttlMs });
}

/** undefined = not looked up recently; null = not a club domain. */
export function cachedClubHost(host: string, now = Date.now()): string | null | undefined {
  const entry = hostCache.get(normaliseHost(host));
  if (!entry || entry.expires < now) return undefined;
  return entry.slug;
}

let metaSlug: string | null | undefined;

/** The club website served at this host, if any. Safe on server and in the browser. */
export function clubSlugForHost(hostname: string): string | null {
  if (isPlatformHost(hostname)) return null;
  if (typeof document === "undefined") return cachedClubHost(hostname) ?? null;
  if (metaSlug === undefined) {
    metaSlug = document.querySelector(`meta[name="${CLUB_SITE_META}"]`)?.getAttribute("content") ?? null;
  }
  return metaSlug;
}
