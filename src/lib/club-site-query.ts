import type { PublicClubSite } from "./club-site";

/** Child pages read the site loaded once by the /club/$slug layout (head tags get it from the route matches). */
export function siteFromMatches(matches: ReadonlyArray<{ routeId: string; loaderData?: unknown }>): PublicClubSite | null {
  const layout = matches.find((match) => match.routeId === "/club/$slug");
  return ((layout?.loaderData as { site?: PublicClubSite } | undefined)?.site) ?? null;
}

export const isSiteSlug = (slug: string) => /^[a-z0-9-]{3,80}$/.test(slug);

/** Head tags shared by every page of a club website. */
export function siteHead(
  site: { name: string; published: boolean; site?: { tagline: string } } | null | undefined,
  page: { title: string; description: (name: string) => string },
) {
  if (!site) {
    return { meta: [{ title: "Club website — CricLume" }, { name: "robots", content: "noindex" }] };
  }
  const title = `${page.title ? `${page.title} · ` : ""}${site.name}`;
  const description = page.description(site.name) + (site.site?.tagline ? ` ${site.site.tagline}` : "");
  return {
    meta: [
      { title },
      { name: "description", content: description.slice(0, 300) },
      { property: "og:title", content: title },
      { property: "og:description", content: description.slice(0, 300) },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      ...(site.published ? [] : [{ name: "robots", content: "noindex" }]),
    ],
  };
}
