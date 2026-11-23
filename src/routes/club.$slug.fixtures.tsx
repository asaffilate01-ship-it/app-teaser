import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { siteFromMatches, siteHead } from "@/lib/club-site-query";
import { siteSchedule, siteTables } from "@/lib/club-site";
import { LeagueTableView, LiveCard, ResultRow, SectionHead, UpcomingRow } from "@/components/site/SiteParts";

const layoutRoute = getRouteApi("/club/$slug");

export const Route = createFileRoute("/club/$slug/fixtures")({
  head: ({ matches }) =>
    siteHead(siteFromMatches(matches), { title: "Fixtures and results", description: (name) => `Upcoming fixtures, live scores, results and league tables for ${name}.` }),
  component: FixturesPage,
});

function FixturesPage() {
  const { slug } = Route.useParams();
  const { site } = layoutRoute.useLoaderData();
  const [team, setTeam] = useState("all");
  if (!site?.published) return null;
  const { live, upcoming, results } = siteSchedule(site, Date.now());
  const tables = siteTables(site);
  const teamNames = (site.teams ?? []).map((t) => t.name);
  const match = (home: string, away: string) => team === "all" || home === team || away === team;
  const shownUpcoming = upcoming.filter((item) => match(item.home, item.away));
  const shownResults = results.filter((item) => match(item.home, item.away));

  return (
    <div className="club-shell club-page">
      <div className="club-page-head">
        <h1>Fixtures and results</h1>
        {teamNames.length > 1 && (
          <label className="club-filter">
            <span>Team</span>
            <select value={team} onChange={(event) => setTeam(event.target.value)}>
              <option value="all">All teams</option>
              {teamNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {live.length > 0 && (
        <section aria-label="Live now">
          <SectionHead title="Live now" />
          <div className="club-live-grid">
            {live.map((m) => (
              <LiveCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}
      <div className="club-two-col">
        <section className="club-card">
          <SectionHead title="Coming up" />
          {shownUpcoming.length ? (
            <ul className="club-list">
              {shownUpcoming.map((item) => (
                <UpcomingRow key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            <p className="club-meta">No fixtures announced yet.</p>
          )}
        </section>
        <section className="club-card" id="results">
          <SectionHead title="Results" />
          {shownResults.length ? (
            <ul className="club-list">
              {shownResults.map((m) => (
                <ResultRow key={m.id} match={m} />
              ))}
            </ul>
          ) : (
            <p className="club-meta">No results yet.</p>
          )}
        </section>
      </div>
      {tables.map((table) => (
        <LeagueTableView key={table.competition.id} table={table} />
      ))}
    </div>
  );
}
