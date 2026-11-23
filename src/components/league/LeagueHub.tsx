import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, Radio, RefreshCw, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TeamCrest } from "@/components/scorer/Broadcast";
import { ScorecardView } from "@/components/scorer/ScorecardView";
import { CommentaryFeed } from "@/components/scorer/CommentaryFeed";
import { WinPredictor } from "@/components/scorer/WinPredictor";
import { loadCloudMatchSnapshot } from "@/lib/cloud";
import { commentaryFeed } from "@/lib/commentary";
import { currentInnings, findPlayer, findTeam, type CricketMatch } from "@/lib/cricket";
import { buildLeagueStandings } from "@/lib/league-standings";
import { projectLiveTable, readLiveSituation, type LiveMatchSituation } from "@/lib/live-table";
import type { MatchRecord, PlatformDashboardData } from "@/lib/platform-cloud";
import { figures, seasonStats, type SeasonStats } from "@/lib/season-stats";
import { currentPrediction, winTimeline } from "@/lib/win-timeline";

type HubView = "live" | "table" | "results" | "stats";
const liveStatuses = new Set(["live", "innings_break"]);

function useTeamName(data: PlatformDashboardData) {
  const names = useMemo(() => new Map(data.teams.map((team) => [team.id, team.name])), [data.teams]);
  return (id: string | null | undefined) => (id ? (names.get(id) ?? "Team") : "Team");
}

function MiniWin({ homeWin, home, away }: { homeWin: number | null; home: string; away: string }) {
  if (homeWin == null) return null;
  return (
    <div className="mt-3" aria-label={`Win chance: ${home} ${homeWin}%, ${away} ${100 - homeWin}%`}>
      <div className="flex justify-between text-[11px] font-bold tabular-nums">
        <span className="text-gold">{homeWin}%</span>
        <span className="win-pct-b">{100 - homeWin}%</span>
      </div>
      <div className="win-bar mt-1 h-1.5">
        <span className="win-bar-a" style={{ width: `${homeWin}%` }} />
        <span className="win-bar-b" style={{ width: `${100 - homeWin}%` }} />
      </div>
    </div>
  );
}

function MatchTile({
  match,
  situation,
  teamName,
  onOpen,
}: {
  match: MatchRecord;
  situation: LiveMatchSituation;
  teamName: (id: string | null) => string;
  onOpen: () => void;
}) {
  const home = teamName(match.homeTeamId);
  const away = teamName(match.awayTeamId);
  const live = liveStatuses.has(match.status);
  const batting = situation.battingTeamId;
  const needs =
    situation.target != null && live
      ? `${teamName(batting)} need ${Math.max(0, situation.target - situation.runs)}${
          situation.oversPerInnings
            ? ` from ${Math.max(0, situation.oversPerInnings * situation.ballsPerOver - situation.legalBalls)} balls`
            : ""
        }`
      : null;
  const row = (teamId: string, name: string) => (
    <div className="flex min-w-0 items-center gap-3">
      <TeamCrest name={name} size="sm" />
      <span className={`min-w-0 flex-1 truncate text-sm font-bold ${batting === teamId ? "text-foreground" : "text-slate-400"}`}>{name}</span>
      {batting === teamId ? (
        <span className="font-display text-xl font-bold tabular-nums text-gold">
          {situation.runs}/{situation.wickets}
          <small className="ml-1 text-[11px] text-slate-400">({situation.overs})</small>
        </span>
      ) : (
        <span className="text-xs text-slate-500">{situation.target != null && batting !== teamId ? `${situation.target - 1}` : "Yet to bat"}</span>
      )}
    </div>
  );
  return (
    <button type="button" onClick={onOpen} className="broadcast-panel hub-tile text-left" aria-label={`Open ${home} v ${away}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        {live ? (
          <span className="hero-chip hero-chip-live">
            <span className="live-dot" aria-hidden="true" /> {match.status === "innings_break" ? "Innings break" : "Live"}
          </span>
        ) : (
          <span className="hero-chip">{match.status.replaceAll("_", " ")}</span>
        )}
        <ChevronRight className="size-4 text-slate-500" aria-hidden="true" />
      </div>
      <div className="grid gap-2">
        {row(match.homeTeamId, home)}
        {row(match.awayTeamId, away)}
      </div>
      {needs && <p className="mt-3 text-xs font-bold text-amber-200">{needs}</p>}
      {live && <MiniWin homeWin={situation.homeWin} home={home} away={away} />}
    </button>
  );
}

function MatchDetail({ record, title, onBack }: { record: MatchRecord; title: string; onBack: () => void }) {
  const [match, setMatch] = useState<CricketMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"card" | "balls">("card");
  const live = liveStatuses.has(record.status);

  useEffect(() => {
    let active = true;
    const load = () =>
      loadCloudMatchSnapshot(record.id)
        .then((next) => {
          if (active) {
            setMatch(next);
            setError(null);
          }
        })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason.message : "This match could not be loaded.");
        });
    void load();
    const timer = live ? window.setInterval(() => void load(), 15_000) : undefined;
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, [record.id, live]);

  return (
    <section className="space-y-4" aria-label="Match detail">
      <button type="button" onClick={onBack} className="workspace-nav-item inline-flex min-h-10 items-center gap-2">
        <ArrowLeft className="size-4" aria-hidden="true" /> All matches
      </button>
      {error && <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
      {!match && !error && <p className="text-sm text-slate-400">Loading scorecard…</p>}
      <div className="flex flex-wrap items-center gap-3">
        {live ? (
          <span className="hero-chip hero-chip-live">
            <span className="live-dot" aria-hidden="true" /> Live
          </span>
        ) : (
          <span className="hero-chip">Result</span>
        )}
        <h2 className="font-display text-2xl font-bold md:text-3xl">{title}</h2>
      </div>
      {match && <MatchDetailBody match={match} live={live} view={view} setView={setView} />}
    </section>
  );
}

function MatchDetailBody({
  match,
  live,
  view,
  setView,
}: {
  match: CricketMatch;
  live: boolean;
  view: "card" | "balls";
  setView: (view: "card" | "balls") => void;
}) {
  const innings = currentInnings(match);
  const [home, away] = match.teams;
  const prediction = currentPrediction(match);
  const battingIsHome = innings.battingTeamId === home.id;
  const lines = commentaryFeed(innings, match.settings.ballsPerOver, {
    player: (id) => (id ? findPlayer(match, id)?.name : undefined),
    battingTeam: findTeam(match, innings.battingTeamId).name,
  });
  return (
    <>
      <div className="card-tabs max-w-sm" role="tablist" aria-label="Match view" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <button type="button" role="tab" aria-selected={view === "card"} onClick={() => setView("card")}>
          Scorecard
        </button>
        <button type="button" role="tab" aria-selected={view === "balls"} onClick={() => setView("balls")}>
          Ball by ball
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        {view === "card" ? (
          <ScorecardView key={match.innings.length} match={match} />
        ) : (
          <div className="broadcast-panel p-4">
            <CommentaryFeed lines={lines} />
          </div>
        )}
        <WinPredictor
          firstName={home.name}
          secondName={away.name}
          firstWin={live && prediction ? (battingIsHome ? prediction.battingWin : prediction.bowlingWin) : null}
          prediction={live ? prediction : null}
          battingName={findTeam(match, innings.battingTeamId).name}
          timeline={winTimeline(match)}
          unavailableReason={live ? undefined : `This match has finished. The line shows how ${home.name}'s chances swung.`}
        />
      </div>
    </>
  );
}

function LiveTable({
  data,
  competitionId,
  situations,
  teamName,
}: {
  data: PlatformDashboardData;
  competitionId: string;
  situations: LiveMatchSituation[];
  teamName: (id: string | null) => string;
}) {
  const competition = data.competitions.find((item) => item.id === competitionId);
  const [mode, setMode] = useState<"live" | "official">("live");
  if (!competition) return <p className="text-sm text-slate-400">Choose a competition to see its table.</p>;
  const preview = buildLeagueStandings({ competition, fixtures: data.fixtures, teams: data.teams });
  if (preview.blockedReason || !competition.rules) {
    return <p className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-4 text-sm text-amber-100">{preview.blockedReason ?? "This competition needs rules before a table can be shown."}</p>;
  }
  const participants = new Set([
    ...data.fixtures.filter((fixture) => fixture.competitionId === competitionId).flatMap((fixture) => [fixture.homeTeamId, fixture.awayTeamId]),
    ...situations.flatMap((item) => [item.homeTeamId, item.awayTeamId]),
  ]);
  const base = [...participants].map(
    (teamId) =>
      preview.rows.find((row) => row.teamId === teamId) ?? {
        teamId, played: 0, won: 0, tied: 0, lost: 0, noResult: 0, points: 0, runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0, netRunRate: 0,
      },
  );
  const rows = projectLiveTable(base, mode === "live" ? situations : [], competition.rules);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="card-tabs" role="tablist" aria-label="Table type" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", position: "static" }}>
          <button type="button" role="tab" aria-selected={mode === "live"} onClick={() => setMode("live")}>
            Live
          </button>
          <button type="button" role="tab" aria-selected={mode === "official"} onClick={() => setMode("official")}>
            Signed off
          </button>
        </div>
        <p className="text-xs text-slate-400">
          {mode === "live"
            ? `If every live match finished now (${situations.filter((item) => item.homeWin != null).length} live).`
            : `${preview.counted} signed-off results.`}
        </p>
      </div>
      <div className="card-table" role="table" aria-label={`${competition.name} table`}>
        <div className="card-row card-head hub-table" role="row">
          <span role="columnheader">Team</span>
          <span role="columnheader">P</span>
          <span role="columnheader">W</span>
          <span role="columnheader">L</span>
          <span role="columnheader" className="hidden sm:block">T/NR</span>
          <span role="columnheader" className="hidden sm:block">NRR</span>
          <span role="columnheader">Pts</span>
        </div>
        {rows.map((row) => (
          <div key={row.teamId} role="row" className={`card-row hub-table ${row.liveOutcome ? "card-live" : ""}`}>
            <span role="cell" className="card-name">
              <strong className="flex min-w-0 items-center gap-2">
                <span className="w-5 shrink-0 tabular-nums text-slate-400">{row.position}</span>
                <span className="truncate">{teamName(row.teamId)}</span>
                {mode === "live" && row.movement !== 0 && (
                  <span className={`inline-flex shrink-0 items-center text-[10px] ${row.movement > 0 ? "text-emerald-300" : "text-rose-300"}`} aria-label={row.movement > 0 ? `up ${row.movement}` : `down ${-row.movement}`}>
                    {row.movement > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    {Math.abs(row.movement)}
                  </span>
                )}
                {mode === "live" && row.liveOutcome && (
                  <span className={`hub-live-dot sm:hidden ${row.liveOutcome === "W" ? "is-win" : row.liveOutcome === "L" ? "is-loss" : ""}`} aria-label={row.liveOutcome === "W" ? "winning now" : row.liveOutcome === "L" ? "losing now" : "level now"} />
                )}
                {mode === "live" && row.liveOutcome && <span className="hub-live-badge hidden sm:inline">{row.liveOutcome === "W" ? "winning" : row.liveOutcome === "L" ? "losing" : "level"}</span>}
              </strong>
            </span>
            <span role="cell">{row.played}</span>
            <span role="cell">{row.won}</span>
            <span role="cell">{row.lost}</span>
            <span role="cell" className="hidden sm:block">{row.tied + row.noResult}</span>
            <span role="cell" className="hidden sm:block">{row.netRunRate.toFixed(2)}</span>
            <span role="cell" className="card-big">{row.points}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="card-empty">No teams in this competition yet.</p>}
      </div>
      <p className="text-[11px] text-slate-500">Live placings use the win predictor and are not official until results are signed off. Net run rate only changes when results are signed off.</p>
    </div>
  );
}

type StatsTab = "batting" | "bowling" | "fielding";

function StatsBoard({ matches }: { matches: MatchRecord[] }) {
  const [stats, setStats] = useState<SeasonStats | null>(null);
  const [failed, setFailed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<StatsTab>("batting");
  const ids = matches.filter((match) => liveStatuses.has(match.status) || match.status === "completed").slice(0, 40).map((match) => match.id);
  const key = ids.join(",");

  useEffect(() => {
    let active = true;
    if (!ids.length) {
      setStats(seasonStats([]));
      return;
    }
    setLoading(true);
    void Promise.allSettled(ids.map((id) => loadCloudMatchSnapshot(id))).then((results) => {
      if (!active) return;
      const loaded = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
      setFailed(results.length - loaded.length);
      setStats(seasonStats(loaded));
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!stats) return <p className="text-sm text-slate-400">{loading ? "Adding up every scorecard…" : "No stats yet."}</p>;
  const topRuns = stats.batting[0];
  const topScore = [...stats.batting].sort((a, b) => b.highScore - a.highScore)[0];
  const topWickets = stats.bowling[0];
  const topBest = [...stats.bowling].sort((a, b) => (b.best?.wickets ?? 0) - (a.best?.wickets ?? 0) || (a.best?.runs ?? 0) - (b.best?.runs ?? 0))[0];
  const topSixes = [...stats.batting].sort((a, b) => b.sixes - a.sixes)[0];
  const topCatches = [...stats.fielding].sort((a, b) => b.catches - a.catches)[0];
  const highlights = [
    ["Most runs", topRuns?.name, topRuns ? `${topRuns.runs}` : null],
    ["Highest score", topScore?.name, topScore ? `${topScore.highScore}${topScore.highScoreNotOut ? "*" : ""}` : null],
    ["Most wickets", topWickets?.name, topWickets ? `${topWickets.wickets}` : null],
    ["Best bowling", topBest?.name, topBest ? figures(topBest.best) : null],
    ["Most sixes", topSixes?.name, topSixes && topSixes.sixes ? `${topSixes.sixes}` : null],
    ["Most catches", topCatches?.name, topCatches && topCatches.catches ? `${topCatches.catches}` : null],
  ] as const;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        From {stats.matches} scorecard{stats.matches === 1 ? "" : "s"}
        {failed ? ` · ${failed} could not be loaded` : ""}.
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {highlights.map(([label, name, value]) => (
          <div key={label} className="broadcast-panel p-3">
            <p className="panel-kicker">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-gold">{value ?? "–"}</p>
            <p className="truncate text-xs text-slate-300">{value ? name : "Nobody yet"}</p>
          </div>
        ))}
      </div>
      <div className="card-tabs max-w-md" role="tablist" aria-label="Stats type" style={{ position: "static" }}>
        {(["batting", "bowling", "fielding"] as StatsTab[]).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className="capitalize">
            {item}
          </button>
        ))}
      </div>
      {tab === "batting" && (
        <StatsTable
          label="Batting averages"
          headings={["Batter", "M", "Inn", "NO", "Runs", "HS", "Avg", "SR", "50s", "100s", "4s", "6s"]}
          mobile={[4, 5, 6, 7]}
          rows={stats.batting.map((row) => [
            [row.name, row.team],
            row.matches, row.innings, row.notOuts, row.runs, `${row.highScore}${row.highScoreNotOut ? "*" : ""}`,
            row.average ?? "–", row.balls ? row.strikeRate.toFixed(1) : "–", row.fifties, row.hundreds, row.fours, row.sixes,
          ])}
        />
      )}
      {tab === "bowling" && (
        <StatsTable
          label="Bowling averages"
          headings={["Bowler", "M", "O", "Mdn", "R", "W", "BBI", "BBM", "Avg", "Econ", "SR", "4w", "5w", "10m"]}
          mobile={[5, 6, 8, 9]}
          rows={stats.bowling.map((row) => [
            [row.name, row.team],
            row.matches, row.overs, row.maidens, row.runs, row.wickets, figures(row.best), figures(row.bestMatch),
            row.average ?? "–", row.economy ?? "–", row.strikeRate ?? "–", row.fourWickets, row.fiveWickets, row.tenWicketMatches,
          ])}
        />
      )}
      {tab === "fielding" && (
        <StatsTable
          label="Fielding"
          headings={["Fielder", "Ct", "St", "RO", "Total"]}
          mobile={[1, 2, 3, 4]}
          rows={stats.fielding.map((row) => [[row.name, row.team], row.catches, row.stumpings, row.runOuts, row.catches + row.stumpings + row.runOuts])}
        />
      )}
    </div>
  );
}

function StatsTable({
  label,
  headings,
  rows,
  mobile,
}: {
  label: string;
  headings: string[];
  rows: Array<[[string, string], ...(string | number)[]]>;
  /** Column indexes shown on phones; the rest appear from tablet width. */
  mobile: number[];
}) {
  const [sort, setSort] = useState<number | null>(null);
  const sorted = sort == null
    ? rows
    : [...rows].sort((a, b) => {
        const x = Number.parseFloat(String(a[sort]));
        const y = Number.parseFloat(String(b[sort]));
        return (Number.isNaN(y) ? -1 : y) - (Number.isNaN(x) ? -1 : x);
      });
  if (!rows.length) return <p className="card-empty">No figures yet.</p>;
  return (
    <div className="card-table overflow-x-auto">
      <table className="hub-stats w-full" aria-label={label}>
        <thead>
          <tr>
            {headings.map((heading, index) => (
              <th key={heading} scope="col" className={index && !mobile.includes(index) ? "hidden md:table-cell" : ""}>
                {index ? (
                  <button type="button" onClick={() => setSort(index)} aria-pressed={sort === index}>
                    {heading}
                  </button>
                ) : (
                  heading
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, rowIndex) => (
            <tr key={`${row[0][0]}-${rowIndex}`}>
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={index} scope="row">
                    <span className="block truncate">{(cell as [string, string])[0]}</span>
                    <small>{(cell as [string, string])[1]}</small>
                  </th>
                ) : (
                  <td key={index} className={!mobile.includes(index) ? "hidden md:table-cell" : sort === index ? "hub-sorted" : ""}>
                    {cell as string | number}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Competition control room: every match at once, live table, results and season stats. */
export function LeagueHub({ data, onRefresh, refreshing }: { data: PlatformDashboardData; onRefresh: () => void; refreshing: boolean }) {
  const teamName = useTeamName(data);
  const [competitionId, setCompetitionId] = useState(data.competitions[0]?.id ?? "");
  const [view, setView] = useState<HubView>("live");
  const [openId, setOpenId] = useState<string | null>(null);
  const matches = data.matches.filter((match) => !competitionId || match.competitionId === competitionId);
  const situations = matches.map((match) => readLiveSituation(match));
  const liveMatches = matches.filter((match) => liveStatuses.has(match.status));
  const results = matches
    .filter((match) => match.status === "completed")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const situationFor = (id: string) => situations.find((item) => item.matchId === id)!;

  useEffect(() => {
    if (!liveMatches.length || openId) return;
    const timer = window.setInterval(onRefresh, 20_000);
    return () => window.clearInterval(timer);
  }, [liveMatches.length, openId, onRefresh]);

  const open = data.matches.find((match) => match.id === openId);
  if (open) return <MatchDetail record={open} title={`${teamName(open.homeTeamId)} v ${teamName(open.awayTeamId)}`} onBack={() => setOpenId(null)} />;

  return (
    <section className="space-y-5" aria-label="League hub">
      <div className="grid gap-3 sm:flex sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="panel-kicker inline-flex items-center gap-1.5">
            <Trophy className="size-3.5" aria-hidden="true" /> League hub
          </p>
          <h2 className="mt-1 font-display text-3xl font-bold">Every match, every number</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Competition"
            value={competitionId}
            onChange={(event) => setCompetitionId(event.target.value)}
            className="scorer-input min-h-10 w-auto max-w-[16rem]"
          >
            {data.competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.name}
              </option>
            ))}
            <option value="">All club matches</option>
          </select>
          <button type="button" className="workspace-nav-item inline-flex min-h-10 items-center gap-2" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      <div className="card-tabs" role="tablist" aria-label="League hub section" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {(
          [
            ["live", `Live${liveMatches.length ? ` (${liveMatches.length})` : ""}`],
            ["table", "Table"],
            ["results", "Results"],
            ["stats", "Stats"],
          ] as [HubView, string][]
        ).map(([key, text]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)}>
            {text}
          </button>
        ))}
      </div>

      {view === "live" &&
        (liveMatches.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {liveMatches.map((match) => (
              <MatchTile key={match.id} match={match} situation={situationFor(match.id)} teamName={teamName} onOpen={() => setOpenId(match.id)} />
            ))}
          </div>
        ) : (
          <div className="broadcast-panel p-6 text-center">
            <Radio className="mx-auto size-7 text-gold" aria-hidden="true" />
            <p className="mt-3 font-bold">No matches are live right now</p>
            <p className="mt-1 text-sm text-slate-400">When scorers start, every game in this competition shows here side by side.</p>
          </div>
        ))}

      {view === "table" && <LiveTable data={data} competitionId={competitionId} situations={situations.filter((item) => liveMatches.some((match) => match.id === item.matchId))} teamName={teamName} />}

      {view === "results" &&
        (results.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((match) => (
              <MatchTile key={match.id} match={match} situation={situationFor(match.id)} teamName={teamName} onOpen={() => setOpenId(match.id)} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Finished matches and their full scorecards appear here.</p>
        ))}

      {view === "stats" && <StatsBoard matches={matches} />}
    </section>
  );
}
