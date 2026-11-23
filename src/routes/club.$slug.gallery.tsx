import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { siteFromMatches, siteHead } from "@/lib/club-site-query";
import { PhotoGrid } from "@/components/site/SiteParts";

const layoutRoute = getRouteApi("/club/$slug");

export const Route = createFileRoute("/club/$slug/gallery")({
  head: ({ matches }) => siteHead(siteFromMatches(matches), { path: "/gallery", title: "Gallery", description: (name) => `Photos from ${name}.` }),
  component: GalleryPage,
});

function GalleryPage() {
  const { slug } = Route.useParams();
  const { site } = layoutRoute.useLoaderData();
  if (!site?.published) return null;
  return (
    <div className="club-shell club-page">
      <div className="club-page-head">
        <h1>Gallery</h1>
      </div>
      <PhotoGrid photos={site.photos ?? []} files={site.files ?? {}} />
    </div>
  );
}
