import { createFileRoute, Link, notFound, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { CalendarDays, Home, Images, Newspaper } from "lucide-react";
import { isSiteSlug } from "@/lib/club-site-query";
import { getClubSite } from "@/lib/club-site.functions";
import { readAccent, readSocials, socialLabels, type PublicClubSite } from "@/lib/club-site";
import { SiteCrest } from "@/components/site/SiteParts";

export const Route = createFileRoute("/club/$slug")({
  loader: async ({ params }) => {
    if (!isSiteSlug(params.slug)) throw notFound();
    const site = await getClubSite({ data: { slug: params.slug } });
    if (!site) throw notFound();
    return { site };
  },
  // Live scores move on; file links last an hour. Reload the site data each minute in the background.
  staleTime: 60_000,
  component: ClubSiteLayout,
  notFoundComponent: SiteMissing,
  errorComponent: SiteMissing,
});

const nav = [
  { to: "/club/$slug", label: "Home", icon: Home, exact: true },
  { to: "/club/$slug/fixtures", label: "Fixtures", icon: CalendarDays, exact: false },
  { to: "/club/$slug/news", label: "News", icon: Newspaper, exact: false },
  { to: "/club/$slug/gallery", label: "Gallery", icon: Images, exact: false },
] as const;

function ClubSiteLayout() {
  const { slug } = Route.useParams();
  const { site } = Route.useLoaderData();
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => void router.invalidate(), 60_000);
    return () => window.clearInterval(timer);
  }, [router]);
  if (!site.published) return <SiteUnpublished site={site} />;
  const accent = readAccent(site.site?.accent);
  const socials = readSocials(site.site?.socials);
  return (
    <div className="club-site" data-accent={accent}>
      <a href="#site-main" className="club-skip">Skip to content</a>
      <header className="club-header">
        <div className="club-shell club-header-row">
          <Link to="/club/$slug" params={{ slug }} className="club-brand">
            <SiteCrest name={site.name} />
            <span className="club-brand-name">{site.name}</span>
          </Link>
          <nav aria-label={`${site.name} website`} className="club-nav">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                params={{ slug }}
                activeOptions={{ exact: item.exact }}
                activeProps={{ "aria-current": "page" }}
                className="club-nav-link"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="site-main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="club-footer">
        <div className="club-shell club-footer-grid">
          <div>
            <p className="club-footer-name">{site.name}</p>
            {site.site?.address && <p>{site.site.address}</p>}
            {site.site?.contactEmail && (
              <p>
                <a href={`mailto:${site.site.contactEmail}`}>{site.site.contactEmail}</a>
              </p>
            )}
            {site.site?.contactPhone && (
              <p>
                <a href={`tel:${site.site.contactPhone.replace(/[^+\d]/g, "")}`}>{site.site.contactPhone}</a>
              </p>
            )}
          </div>
          {Object.keys(socials).length > 0 && (
            <ul className="club-footer-social" aria-label="Follow us">
              {Object.entries(socials).map(([key, url]) => (
                <li key={key}>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    {socialLabels[key as keyof typeof socialLabels]}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="club-powered">
            Live scores and website by{" "}
            <Link to="/" className="club-powered-link">
              CricLume
            </Link>
          </p>
        </div>
      </footer>
      <nav aria-label={`${site.name} menu`} className="club-tabbar">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            params={{ slug }}
            activeOptions={{ exact: item.exact }}
            activeProps={{ "aria-current": "page" }}
            className="club-tab"
          >
            <item.icon aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function SiteUnpublished({ site }: { site: PublicClubSite }) {
  return (
    <div className="club-site" data-accent="crimson">
      <main className="club-shell club-empty-page">
        <SiteCrest name={site.name} large />
        <h1>{site.name}</h1>
        <p>This club hasn’t published its website yet. Please check back soon.</p>
        <Link to="/" className="club-button club-button-ghost">
          About CricLume
        </Link>
      </main>
    </div>
  );
}

function SiteMissing() {
  return (
    <div className="club-site" data-accent="crimson">
      <main className="club-shell club-empty-page">
        <h1>Club not found</h1>
        <p>We couldn’t find a club website at this address. Check the link and try again.</p>
        <Link to="/" className="club-button club-button-ghost">
          Go to CricLume
        </Link>
      </main>
    </div>
  );
}
