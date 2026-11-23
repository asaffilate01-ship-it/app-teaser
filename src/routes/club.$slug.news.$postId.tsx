import { siteUrl } from "@/lib/club-site-query";
import { createFileRoute, getRouteApi, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, FileText } from "lucide-react";
import { getClubSite } from "@/lib/club-site.functions";
import { postExcerpt, postKindLabels } from "@/lib/club-site";
import { useDateLabel } from "@/components/site/SiteParts";

const layoutRoute = getRouteApi("/club/$slug");

export const Route = createFileRoute("/club/$slug/news/$postId")({
  loader: async ({ params }) => {
    const site = await getClubSite({ data: { slug: params.slug } });
    const post = site?.posts?.find((item) => item.id === params.postId);
    if (!site || !post) throw notFound();
    return { club: site.name, title: post.title, excerpt: postExcerpt(post.body, 200), domain: site.domain ?? null, id: post.id };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Club news — CricLume" }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.title} · ${loaderData.club}`;
    const description = loaderData.excerpt || `News from ${loaderData.club}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
      links: loaderData.domain ? [{ rel: "canonical", href: siteUrl(loaderData.domain, `/news/${loaderData.id}`) }] : [],
    };
  },
  component: PostPage,
  notFoundComponent: PostMissing,
});

function PostPage() {
  const { slug, postId } = Route.useParams();
  const { site } = layoutRoute.useLoaderData();
  const label = useDateLabel();
  const post = site?.posts?.find((item) => item.id === postId);
  if (!post) return <PostMissing />;
  const file = post.filePath ? site?.files?.[post.filePath] : null;
  const isPdf = post.filePath?.toLowerCase().endsWith(".pdf");
  return (
    <article className="club-shell club-page club-article">
      <Link to="/club/$slug/news" params={{ slug }} className="club-more">
        <ArrowLeft aria-hidden="true" /> All news
      </Link>
      <p className="club-post-kind">
        {postKindLabels[post.kind]} · {label(post.publishedAt, false)}
      </p>
      <h1>{post.title}</h1>
      {file && !isPdf && <img src={file} alt="" className="club-article-image" />}
      {post.body.split(/\n{2,}/).map((paragraph, index) => (
        <p key={index} className="club-prose">
          {paragraph}
        </p>
      ))}
      {(post.linkUrl || (isPdf && file)) && (
        <a href={(isPdf && file) || post.linkUrl || "#"} target="_blank" rel="noopener noreferrer" className="club-button">
          <FileText aria-hidden="true" /> Open document
        </a>
      )}
    </article>
  );
}

function PostMissing() {
  return (
    <div className="club-shell club-page">
      <h1>Post not found</h1>
      <p className="club-meta">It may have been removed by the club.</p>
    </div>
  );
}
