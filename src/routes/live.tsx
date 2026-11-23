import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CalendarDays, Radio, RotateCw, Search, Star, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/theme/BrandLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LiveMatchCard } from "@/components/live/LiveMatchCard";
import { LiveAlertsPanel } from "@/components/live/LiveAlertsPanel";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLiveCentre } from "@/hooks/use-live-centre";
import { bucketCounts, countryFlag, countryName, filterLiveMatches, liveFilterOptions, type LiveBucket, type LiveMatch } from "@/lib/live-centre";

type LiveView = LiveBucket | "following";
const views: ReadonlyArray<LiveView> = ["live", "results", "upcoming", "following"];

interface LiveSearch {
  view?: LiveView;
  country?: string;
  region?: string;
  competition?: string;
  q?: string;
}
type SearchKey = keyof LiveSearch;

function text(value: unknown, max = 80): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

export const Route = createFileRoute("/live")({
  validateSearch: (search: Record<string, unknown>): LiveSearch => {
    const out: LiveSearch = {};
    const view = text(search["view"]);
    if (view && (views as readonly string[]).includes(view)) out.view = view as LiveView;
    const country = text(search["country"], 2)?.toUpperCase();
    if (country && /^[A-Z]{2}$/.test(country)) out.country = country;
    const region = text(search["region"], 60);
    if (region) out.region = region;
    const competition = text(search["competition"], 40);
    if (competition) out.competition = competition;
    const q = text(search["q"], 60);
    if (q) out.q = q;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Live cricket scores by country & league — CricLume" },
      {
        name: "description",
        content: "Follow every public CricLume match at once: live scores by country, region and competition, with alerts for wickets, fours, sixes, rain delays and results.",
      },
      { property: "og:title", content: "Live cricket scores — CricLume" },
      {
        property: "og:description",
        content: "Club and league cricket live, ball by ball. Filter by country, region and competition and get alerts as wickets fall.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://criclume.com/live" }],
  }),
  component: LiveCentrePage,
});

const viewMeta: Record<LiveView, { label: string; short: string; icon: typeof Radio; empty: string }> = {
  live: { label: "Live now", short: "Live", icon: Radio, empty: "No public matches are being played right now." },
  results: { label: "Results", short: "Results", icon: Trophy, empty: "No results in the last day and a half." },
  upcoming: { label: "Upcoming", short: "Upcoming", icon: CalendarDays, empty: "No public fixtures in the next 7 days." },
  following: { label: "Following", short: "Following", icon: Star, empty: "Tap the star on any match to follow it here." },
};

function groupByCompetition(matches: LiveMatch[]) {
  const groups = new Map<string, { title: string; place: string; items: LiveMatch[] }>();
  for (const match of matches) {
    const id = match.competition?.id ?? "other";
    const group = groups.get(id) ?? {
      title: match.competition?.name ?? "Friendlies & other matches",
      place: match.competition ? [countryFlag(match.country), match.region].filter(Boolean).join(" ") : "",
      items: [],
    };
    group.items.push(match);
    groups.set(id, group);
  }
  return [...groups.entries()].map(([id, group]) => ({ id, ...group }));
}

function LiveCentrePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const openMatch = (slug: string) => void navigate({ to: "/scoreboard/$slug", params: { slug } });
  const centre = useLiveCentre(openMatch);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState(search.q ?? "");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => window.clearInterval(timer);
  }, []);

  const setSearch = (patch: Partial<Record<SearchKey, string | null>>) =>
    void navigate({
      search: (prev) => {
        const next: Record<string, string> = {};
        for (const [key, value] of Object.entries({ ...prev, ...patch })) if (value) next[key] = value;
        return next as LiveSearch;
      },
      replace: true,
      resetScroll: false,
    });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if ((search.q ?? "") !== query.trim()) setSearch({ q: query.trim() || null });
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const view: LiveView = search.view ?? "live";
  const counts = bucketCounts(centre.matches);
  const options = useMemo(
    () => liveFilterOptions(centre.matches, { ...(search.country ? { country: search.country } : {}), ...(search.region ? { region: search.region } : {}) }),
    [centre.matches, search.country, search.region],
  );
  const shown = useMemo(
    () =>
      filterLiveMatches(centre.matches, {
        bucket: view === "following" ? "all" : view,
        ...(search.country ? { country: search.country } : {}),
        ...(search.region ? { region: search.region } : {}),
        ...(search.competition ? { competition: search.competition } : {}),
        ...(search.q ? { query: search.q } : {}),
        following: view === "following" ? centre.following : null,
      }),
    [centre.matches, centre.following, view, search.country, search.region, search.competition, search.q],
  );
  const groups = groupByCompetition(shown);
  const filtered = Boolean(search.country || search.region || search.competition || search.q);
  const tabCount = (item: LiveView) => (item === "following" ? centre.following.size : counts[item]);
  const updated = centre.loadedAt ? Math.max(0, Math.round((now - centre.loadedAt) / 1000)) : null;

  const alerts = (
    <LiveAlertsPanel
      prefs={centre.prefs}
      setPrefs={centre.setPrefs}
      feed={centre.feed}
      onOpen={(slug) => {
        setAlertsOpen(false);
        openMatch(slug);
      }}
      followingCount={centre.following.size}
    />
  );

  return (
    <div className="scoreboard-stage min-h-screen pb-28 md:pb-12">
      <header className="scoreboard-topbar">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Link to="/" aria-label="CricLume home">
            <BrandLogo className="h-9 w-auto md:h-10" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              className="live-icon-button"
              onClick={() => setAlertsOpen(true)}
              aria-label={`Match alerts${centre.feed.length ? ` (${centre.feed.length} new)` : ""}`}
            >
              <Bell className="size-4" aria-hidden="true" />
              {centre.feed.length > 0 && <span className="live-badge">{Math.min(99, centre.feed.length)}</span>}
            </button>
            <Link to="/platform" className="action-secondary">
              Club sign in
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-3 py-5 md:px-8 md:py-8">
        <section className="live-hero">
          <div className="min-w-0">
            <p className="hero-chip hero-chip-live w-fit">
              <span className="live-dot" aria-hidden="true" /> {counts.live} live now
            </p>
            <h1 className="live-title">Live cricket, every ground</h1>
            <p className="mt-2 max-w-2xl text-sm scoreboard-muted md:text-base">
              Club and league matches scored on CricLume, updating ball by ball. Filter by country, region or competition, follow
              the games you care about and get a nudge when a wicket falls, the ball goes for six or rain stops play.
            </p>
          </div>
          <button type="button" className="action-secondary shrink-0" onClick={() => void centre.refresh()}>
            <RotateCw className="size-4" aria-hidden="true" />
            {updated == null ? "Loading…" : updated < 5 ? "Updated just now" : `Updated ${updated}s ago`}
          </button>
        </section>

        <div className="live-filters">
          <div className="live-tabs hidden md:flex" role="tablist" aria-label="Matches">
            {views.map((item) => {
              const Icon = viewMeta[item].icon;
              return (
                <button key={item} type="button" role="tab" aria-selected={view === item} onClick={() => setSearch({ view: item === "live" ? null : item })}>
                  <Icon className="size-4" aria-hidden="true" />
                  {viewMeta[item].label}
                  <span className="live-tab-count">{tabCount(item)}</span>
                </button>
              );
            })}
          </div>
          <div className="live-filter-row">
            <label className="live-field">
              <span className="sr-only">Country</span>
              <select value={search.country ?? ""} onChange={(event) => setSearch({ country: event.target.value || null, region: null, competition: null })}>
                <option value="">All countries</option>
                {options.countries.map((item) => (
                  <option key={item.value} value={item.value}>
                    {countryFlag(item.value)} {item.label} ({item.count})
                  </option>
                ))}
                {search.country && !options.countries.some((item) => item.value === search.country) && (
                  <option value={search.country}>
                    {countryFlag(search.country)} {countryName(search.country)} (0)
                  </option>
                )}
              </select>
            </label>
            <label className="live-field">
              <span className="sr-only">Region</span>
              <select value={search.region ?? ""} onChange={(event) => setSearch({ region: event.target.value || null, competition: null })} disabled={options.regions.length === 0 && !search.region}>
                <option value="">All regions</option>
                {options.regions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} ({item.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="live-field">
              <span className="sr-only">Competition</span>
              <select value={search.competition ?? ""} onChange={(event) => setSearch({ competition: event.target.value || null })} disabled={options.competitions.length === 0 && !search.competition}>
                <option value="">All competitions</option>
                {options.competitions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} ({item.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="live-field live-field-search">
              <Search className="size-4 shrink-0 scoreboard-muted" aria-hidden="true" />
              <span className="sr-only">Search teams, grounds or leagues</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Team, ground or league" maxLength={60} />
            </label>
            {filtered && (
              <button
                type="button"
                className="live-clear"
                onClick={() => {
                  setQuery("");
                  setSearch({ country: null, region: null, competition: null, q: null });
                }}
              >
                <X className="size-3.5" aria-hidden="true" /> Clear
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
          <div className="min-w-0">
            {centre.status === "loading" ? (
              <div className="live-grid" aria-busy="true">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="live-card live-card-skeleton" />
                ))}
              </div>
            ) : centre.status === "unavailable" || centre.status === "error" ? (
              <div className="broadcast-panel text-center">
                <p className="text-lg font-bold">Live scores can't be reached right now</p>
                <p className="mt-1 text-sm scoreboard-muted">Check your connection — we'll keep trying every few seconds.</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="broadcast-panel live-empty">
                <p className="text-lg font-bold">{filtered ? "Nothing matches these filters" : viewMeta[view].empty}</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {filtered && (
                    <button type="button" className="action-secondary" onClick={() => { setQuery(""); setSearch({ country: null, region: null, competition: null, q: null }); }}>
                      Show every country
                    </button>
                  )}
                  {views
                    .filter((item) => item !== view && item !== "following" && tabCount(item) > 0)
                    .map((item) => (
                      <button key={item} type="button" className="action-secondary" onClick={() => setSearch({ view: item === "live" ? null : item })}>
                        {viewMeta[item].label} ({tabCount(item)})
                      </button>
                    ))}
                </div>
                <p className="mt-4 text-xs scoreboard-muted">
                  Run a club or league? Switch on a match's public scoreboard in your{" "}
                  <Link to="/platform" className="font-bold text-gold underline-offset-2 hover:underline">
                    club workspace
                  </Link>{" "}
                  and it appears here.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {groups.map((group) => (
                  <section key={group.id} aria-labelledby={`group-${group.id}`}>
                    <h2 id={`group-${group.id}`} className="live-group-title">
                      <span className="truncate">{group.title}</span>
                      {group.place && <span className="shrink-0 font-normal scoreboard-muted">{group.place}</span>}
                      <span className="live-tab-count">{group.items.length}</span>
                    </h2>
                    <div className="live-grid">
                      {group.items.map((match) => (
                        <LiveMatchCard
                          key={match.slug}
                          match={match}
                          now={now}
                          followed={centre.following.has(match.slug)}
                          flash={centre.flash[match.slug]}
                          onFollow={() => centre.toggleFollow(match.slug)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
          <aside className="hidden lg:sticky lg:top-24 lg:block" aria-label="Match alerts">
            {alerts}
          </aside>
        </div>
      </main>

      <nav className="live-bottom-nav md:hidden" aria-label="Matches">
        {views.map((item) => {
          const Icon = viewMeta[item].icon;
          return (
            <button key={item} type="button" aria-current={view === item ? "page" : undefined} onClick={() => setSearch({ view: item === "live" ? null : item })}>
              <span className="live-bottom-icon">
                <Icon className="size-[18px]" aria-hidden="true" />
                {tabCount(item) > 0 && (
                  <span className={`live-badge ${item === "live" ? "" : "live-badge-muted"}`}>{Math.min(99, tabCount(item))}</span>
                )}
              </span>
              {viewMeta[item].short}
            </button>
          );
        })}
        <button type="button" onClick={() => setAlertsOpen(true)}>
          <span className="live-bottom-icon">
            <Bell className="size-[18px]" aria-hidden="true" />
            {centre.feed.length > 0 && <span className="live-badge">{Math.min(99, centre.feed.length)}</span>}
          </span>
          Alerts
        </button>
      </nav>

      <Sheet open={alertsOpen} onOpenChange={setAlertsOpen}>
        <SheetContent side="bottom" className="live-sheet max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Match alerts</SheetTitle>
            <SheetDescription>Choose what pops up and see the latest moments.</SheetDescription>
          </SheetHeader>
          <div className="mt-4">{alerts}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
