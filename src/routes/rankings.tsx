import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Medal, Search } from "lucide-react";
import { BrandLogo } from "@/components/theme/BrandLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { playerRankings, type RankingRow } from "@/lib/player-hub-cloud";
import { comparePlayers, economy, rankPlayers, rankingPoints, strikeRate, type RankBy } from "@/lib/rankings";
import { countryFlag, countryName } from "@/lib/live-centre";

export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { title: "Club cricket player rankings by country, region & town — CricLume" },
      { name: "description", content: "Top club cricketers by runs, wickets, strike rate and economy, filtered by country, region and town — and compare any two players." },
      { property: "og:title", content: "Club cricket player rankings — CricLume" },
      { property: "og:description", content: "Who's top in your town? Runs, wickets and all-round points for adult players whose clubs share their stats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://criclume.com/rankings" }],
  }),
  component: RankingsPage,
});

const sorts: { id: RankBy; label: string }[] = [
  { id: "points", label: "All-round" },
  { id: "runs", label: "Runs" },
  { id: "wickets", label: "Wickets" },
  { id: "strikeRate", label: "Strike rate" },
  { id: "economy", label: "Economy" },
];

function RankingsPage() {
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [town, setTown] = useState("");
  const [by, setBy] = useState<RankBy>("points");
  const [rows, setRows] = useState<RankingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setError(null);
      playerRankings({ country: country.trim(), region: region.trim(), town: town.trim() })
        .then(setRows)
        .catch(() => setError("Rankings can't be loaded right now. Please try again shortly."));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [country, region, town]);

  const ranked = useMemo(() => rankPlayers(rows ?? [], by), [rows, by]);
  const countries = useMemo(() => [...new Set((rows ?? []).map((r) => r.country).filter(Boolean))] as string[], [rows]);
  const pair = picked.map((ref) => rows?.find((r) => r.ref === ref)).filter(Boolean) as RankingRow[];
  const toggle = (ref: string) => setPicked((current) => (current.includes(ref) ? current.filter((x) => x !== ref) : [...current.slice(-1), ref]));

  return (
    <div className="scoreboard-stage min-h-screen pb-24">
      <header className="scoreboard-topbar">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Link to="/" aria-label="CricLume home"><BrandLogo className="h-9 w-auto md:h-10" /></Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/live" className="action-secondary">Live scores</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-8">
        <div>
          <p className="panel-kicker flex items-center gap-2"><Medal className="size-4" aria-hidden="true" /> Player rankings</p>
          <h1 className="font-display text-4xl font-bold">Who's top near you?</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Adult players whose clubs share their profile. Strike rate and economy need at least 60 balls. Tick two players to compare them.
          </p>
        </div>
        <div className="broadcast-panel grid gap-2 p-4 sm:grid-cols-4">
          <label className="text-xs">Country
            <select className="scorer-input mt-1" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">All countries</option>
              {countries.map((code) => <option key={code} value={code}>{countryFlag(code)} {countryName(code)}</option>)}
            </select>
          </label>
          <label className="text-xs">Region<input className="scorer-input mt-1" value={region} maxLength={60} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Punjab" /></label>
          <label className="text-xs">Town<input className="scorer-input mt-1" value={town} maxLength={60} onChange={(e) => setTown(e.target.value)} placeholder="e.g. Lahore" /></label>
          <div className="text-xs">Rank by
            <div className="mt-1 flex flex-wrap gap-1">
              {sorts.map((s) => <button key={s.id} type="button" className="app-chip-button" aria-pressed={by === s.id} onClick={() => setBy(s.id)}>{s.label}</button>)}
            </div>
          </div>
        </div>
        {pair.length === 2 && (
          <section className="broadcast-panel p-4" aria-label="Compare players">
            <h2 className="panel-kicker mb-2 flex items-center gap-2"><ArrowLeftRight className="size-4" aria-hidden="true" /> {pair[0]!.name} v {pair[1]!.name}</h2>
            <table className="w-full text-sm tabular-nums">
              <tbody>
                {comparePlayers(pair[0]!, pair[1]!).map((line) => (
                  <tr key={line.label} className="border-t border-border/60">
                    <td className={`py-1.5 text-right ${line.better === "a" ? "font-bold text-gold" : ""}`}>{line.a}</td>
                    <td className="px-3 text-center text-xs text-muted-foreground">{line.label}</td>
                    <td className={`py-1.5 ${line.better === "b" ? "font-bold text-gold" : ""}`}>{line.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
        {rows === null && !error ? (
          <p className="text-sm text-muted-foreground"><Search className="mr-1 inline size-4" /> Loading rankings…</p>
        ) : ranked.length ? (
          <ol className="space-y-2">
            {ranked.slice(0, 100).map((row, index) => (
              <li key={row.ref} className="broadcast-panel flex items-center gap-3 p-3">
                <span className="w-8 text-center font-display text-xl font-bold text-gold tabular-nums">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{row.name}</strong>
                  <small className="block truncate text-xs text-muted-foreground">{row.club}{row.town ? ` · ${row.town}` : ""}{row.country ? ` ${countryFlag(row.country)}` : ""}</small>
                </span>
                <span className="hidden text-right text-xs text-muted-foreground sm:block">
                  {row.runs ?? 0} runs · SR {strikeRate(row) ?? "–"}<br />{row.wickets ?? 0} wkts · Econ {economy(row) ?? "–"}
                </span>
                <span className="w-14 text-right font-display text-lg font-bold tabular-nums">{by === "points" ? rankingPoints(row) : by === "runs" ? row.runs ?? 0 : by === "wickets" ? row.wickets ?? 0 : by === "strikeRate" ? strikeRate(row) : economy(row)}</span>
                <input type="checkbox" className="size-5" aria-label={`Compare ${row.name}`} checked={picked.includes(row.ref)} onChange={() => toggle(row.ref)} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">No ranked players here yet. Clubs choose which adult players have a public profile.</p>
        )}
      </main>
    </div>
  );
}
