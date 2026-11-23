import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { siteFromMatches, siteHead } from "@/lib/club-site-query";
import { readSponsors, siteSchedule, siteTables } from "@/lib/club-site";
import { JoinClubForm } from "@/components/site/JoinClubForm";
import { LeagueTableView, LiveCard, PhotoGrid, PostCard, ResultRow, SectionHead, UpcomingRow } from "@/components/site/SiteParts";

const layoutRoute = getRouteApi("/club/$slug");

export const Route = createFileRoute("/club/$slug/")({
  head: ({ matches }) =>
    siteHead(siteFromMatches(matches), { path: "/", title: "", description: (name) => `${name}: live scores, fixtures, results, news and photos.` }),
  component: ClubHome,
});

function ClubHome() {
  const { slug } = Route.useParams();
  const { site } = layoutRoute.useLoaderData();
  if (!site?.published || !site.site) return null;
  const files = site.files ?? {};
  const { live, upcoming, results } = siteSchedule(site, Date.now());
  const tables = siteTables(site);
  const sponsors = readSponsors(site.site.sponsors);
  const hero = site.site.heroPath ? files[site.site.heroPath] : null;
  const posts = site.posts ?? [];
  const teams = site.teams ?? [];
  const { contactEmail, contactPhone, address, mapUrl } = site.site;

  return (
    <>
      <section className={hero ? "club-hero club-hero-photo" : "club-hero"}>
        {hero && <img src={hero} alt="" className="club-hero-img" />}
        <div className="club-shell club-hero-inner">
          <p className="club-kicker">{site.kind === "league" ? "Cricket league" : site.kind === "academy" ? "Cricket academy" : site.kind === "school" ? "School cricket" : "Cricket club"}</p>
          <h1>{site.name}</h1>
          {site.site.tagline && <p className="club-hero-tagline">{site.site.tagline}</p>}
          <div className="club-hero-actions">
            <Link to="/club/$slug/fixtures" params={{ slug }} className="club-button">
              Fixtures and results
            </Link>
            {site.kind !== "league" && (
              <a href="#join" className="club-button club-button-light">
                Join us
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="club-shell club-home">
        {live.length > 0 && (
          <section aria-label="Live now">
            <SectionHead title="Live now" />
            <div className="club-live-grid">
              {live.map((match) => (
                <LiveCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        )}

        <div className="club-two-col">
          <section className="club-card">
            <SectionHead
              title="Coming up"
              action={
                <Link to="/club/$slug/fixtures" params={{ slug }} className="club-more">
                  All fixtures
                </Link>
              }
            />
            {upcoming.length ? (
              <ul className="club-list">
                {upcoming.slice(0, 4).map((item) => (
                  <UpcomingRow key={item.id} item={item} />
                ))}
              </ul>
            ) : (
              <p className="club-meta">No fixtures announced yet.</p>
            )}
          </section>
          <section className="club-card">
            <SectionHead
              title="Latest results"
              action={
                <Link to="/club/$slug/fixtures" params={{ slug }} hash="results" className="club-more">
                  All results
                </Link>
              }
            />
            {results.length ? (
              <ul className="club-list">
                {results.slice(0, 4).map((match) => (
                  <ResultRow key={match.id} match={match} />
                ))}
              </ul>
            ) : (
              <p className="club-meta">Results appear here after each public match.</p>
            )}
          </section>
        </div>

        {posts.length > 0 && (
          <section>
            <SectionHead
              title="News and notices"
              action={
                <Link to="/club/$slug/news" params={{ slug }} className="club-more">
                  All news
                </Link>
              }
            />
            <div className="club-post-grid">
              {posts.slice(0, 3).map((post) => (
                <PostCard key={post.id} post={post} slug={slug} files={files} />
              ))}
            </div>
          </section>
        )}

        {tables[0] && <LeagueTableView table={tables[0]} />}

        {(site.photos?.length ?? 0) > 0 && (
          <section>
            <SectionHead
              title="Gallery"
              action={
                <Link to="/club/$slug/gallery" params={{ slug }} className="club-more">
                  All photos
                </Link>
              }
            />
            <PhotoGrid photos={site.photos ?? []} files={files} limit={6} />
          </section>
        )}

        <div className="club-two-col">
          {(site.site.about || teams.length > 0) && (
            <section className="club-card">
              <SectionHead title={site.kind === "league" ? "About the league" : "About the club"} />
              {site.site.about && <p className="club-prose">{site.site.about}</p>}
              {teams.length > 0 && (
                <>
                  <h3 className="club-subhead">{site.kind === "league" ? "Member teams" : "Our teams"}</h3>
                  <ul className="club-chips">
                    {teams.map((team) => (
                      <li key={team.id}>
                        {team.name}
                        {team.ageGroup ? <span> · {team.ageGroup}</span> : null}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
          {site.kind !== "league" && <JoinClubForm slug={slug} clubName={site.name} />}
          {(contactEmail || contactPhone || address) && (
            <section className="club-card" id="contact">
              <SectionHead title="Find us and get in touch" />
              <ul className="club-contact">
                {address && (
                  <li>
                    <MapPin aria-hidden="true" />
                    <span>
                      {address}
                      {mapUrl && (
                        <>
                          {" "}
                          <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                            Open map
                          </a>
                        </>
                      )}
                    </span>
                  </li>
                )}
                {contactEmail && (
                  <li>
                    <Mail aria-hidden="true" />
                    <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                  </li>
                )}
                {contactPhone && (
                  <li>
                    <Phone aria-hidden="true" />
                    <a href={`tel:${contactPhone.replace(/[^+\d]/g, "")}`}>{contactPhone}</a>
                  </li>
                )}
              </ul>
            </section>
          )}
        </div>

        {sponsors.length > 0 && (
          <section aria-label="Our sponsors" className="club-sponsors">
            <p className="club-kicker">Thank you to our sponsors</p>
            <ul>
              {sponsors.map((sponsor) => (
                <li key={sponsor.name}>
                  {sponsor.url ? (
                    <a href={sponsor.url} target="_blank" rel="noopener noreferrer sponsored">
                      {sponsor.name}
                    </a>
                  ) : (
                    sponsor.name
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
