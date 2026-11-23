import { createFileRoute, getRouteApi, Outlet, useChildMatches } from "@tanstack/react-router";
import { useState } from "react";
import { siteFromMatches, siteHead } from "@/lib/club-site-query";
import { postKindLabels, type PostKind } from "@/lib/club-site";
import { PostCard } from "@/components/site/SiteParts";

const layoutRoute = getRouteApi("/club/$slug");

export const Route = createFileRoute("/club/$slug/news")({
  head: ({ matches }) =>
    siteHead(siteFromMatches(matches), { title: "News and notices", description: (name) => `News, notices and documents from ${name}.` }),
  component: NewsPage,
});

const filters: Array<"all" | PostKind> = ["all", "news", "notice", "document"];

function NewsPage() {
  const { slug } = Route.useParams();
  const { site } = layoutRoute.useLoaderData();
  const [kind, setKind] = useState<"all" | PostKind>("all");
  const child = useChildMatches();
  if (child.length > 0) return <Outlet />;
  if (!site?.published) return null;
  const posts = (site.posts ?? []).filter((post) => kind === "all" || post.kind === kind);
  return (
    <div className="club-shell club-page">
      <div className="club-page-head">
        <h1>News and notices</h1>
        <div className="club-segment" role="group" aria-label="Show">
          {filters.map((value) => (
            <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>
              {value === "all" ? "All" : postKindLabels[value]}
            </button>
          ))}
        </div>
      </div>
      {posts.length ? (
        <div className="club-post-grid">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} slug={slug} files={site.files ?? {}} />
          ))}
        </div>
      ) : (
        <p className="club-meta">Nothing here yet.</p>
      )}
    </div>
  );
}
