import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { clubSlugForHost, toExternalPath, toInternalPath } from "./lib/club-domains";

/** On a club's own domain, clean addresses (/news) map to the club website pages (/club/<slug>/news). */
function mapClubPath(url: URL, map: (pathname: string, slug: string) => string): URL | undefined {
  const slug = clubSlugForHost(url.hostname);
  if (!slug) return undefined;
  const pathname = map(url.pathname, slug);
  if (pathname === url.pathname) return undefined;
  const next = new URL(url.href);
  next.pathname = pathname;
  return next;
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    rewrite: {
      input: ({ url }) => mapClubPath(url, toInternalPath),
      output: ({ url }) => mapClubPath(url, toExternalPath),
    },
  });

  return router;
};
