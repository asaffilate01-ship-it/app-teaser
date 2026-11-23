import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock3, MapPin, Radio, RotateCw } from "lucide-react";
import logoAsset from "@/assets/criclume-logo-on-dark.png.asset.json";
import { getCloudClient, isCloudConfigured } from "@/lib/cloud";
import { TeamCrest } from "@/components/scorer/Broadcast";
import { chaseState } from "@/lib/match-broadcast";
import { WinPredictor } from "@/components/scorer/WinPredictor";
import { CommentaryFeed } from "@/components/scorer/CommentaryFeed";
import { predictWin, type MatchConditions } from "@/lib/win-predictor";
import type { CommentaryLine } from "@/lib/commentary";

export const Route = createFileRoute("/scoreboard/$slug")({
  head: () => ({
    meta: [
      { title: "Live cricket score — CricLume" },
      {
        name: "description",
        content: "Live cricket score, innings state and recent deliveries powered by CricLume.",
      },
      { property: "og:title", content: "Live cricket score — CricLume" },
      {
        property: "og:description",
        content: "Follow the score ball by ball: runs, wickets, run rate and the chase, live from the ground.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicScoreboard,
});

interface ScoreboardData {
  matchId: string;
  status: string;
  scheduledAt?: string;
  startedAt?: string;
  weather?: { summary?: string };
  homeTeam: { id: string; name: string; shortName: string };
  awayTeam: { id: string; name: string; shortName: string };
  ground?: { id: string; name: string };
  liveState: {
    battingTeamId?: string;
    runs?: number;
    wickets?: number;
    overs?: string;
    target?: number;
    striker?: { name: string; runs: number; balls: number };
    nonStriker?: { name: string; runs: number; balls: number };
    bowler?: { name: string; wickets: number; runs: number; overs: string };
    recent?: Array<{ label: string; kind?: string }>;
    message?: string;
    settings?: { oversPerInnings?: number | null; inningsPerSide?: number; ballsPerOver?: number };
    inningsNumber?: number;
    maxWickets?: number;
    battingIsHome?: boolean;
    conditions?: MatchConditions | null;
    commentary?: CommentaryLine[] | null;
    superOver?: boolean;
    freeHit?: boolean;
    declared?: boolean;
    followOn?: boolean;
    result?: string | null;
  };
  updatedAt: string;
  sponsor?: { name?: string };
}

type BallKind = "boundary" | "wicket" | "extra" | "dot" | "run";

function ballKind(ball: { label: string; kind?: string }): BallKind {
  if (ball.kind === "wicket" || ball.label === "W") return "wicket";
  if (ball.kind === "boundary") return "boundary";
  if (ball.label === "Wd" || ball.label === "Nb") return "extra";
  if (ball.label === "·" || ball.label === "0") return "dot";
  return "run";
}

function legalBallsFromOvers(overs: string | undefined, ballsPerOver: number) {
  const match = /^(\d+)\.(\d+)$/.exec(overs ?? "");
  if (!match) return 0;
  return Number(match[1]) * ballsPerOver + Number(match[2]);
}

function strikeRate(runs: number, balls: number) {
  return balls > 0 ? ((runs * 100) / balls).toFixed(1) : "—";
}

function PublicScoreboard() {
  const { slug } = Route.useParams();
  const [scoreboard, setScoreboard] = useState<ScoreboardData | null>(null);
  const [loading, setLoading] = useState(isCloudConfigured());
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"live" | "commentary">("live");

  useEffect(() => {
    if (!isCloudConfigured()) return;
    let active = true;
    const load = async () => {
      const { data, error: requestError } = await getCloudClient().rpc("get_public_scoreboard", {
        p_slug: slug,
      });
      if (!active) return;
      if (requestError) setError(requestError.message);
      else if (!data) setError("This scoreboard is not public or is not available yet.");
      else {
        setScoreboard(data as ScoreboardData);
        setError(null);
      }
      setLoading(false);
    };
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [slug]);

  if (!isCloudConfigured()) {
    return (
      <ScoreboardMessage
        title="Live scores aren't connected yet"
        detail="Publish a match from your club workspace and switch on its public scoreboard."
      />
    );
  }
  if (loading)
    return (
      <ScoreboardMessage
        title="Loading live score…"
        detail="Connecting to the CricLume match feed."
      />
    );
  if (error || !scoreboard)
    return (
      <ScoreboardMessage
        title="Scoreboard unavailable"
        detail={error ?? "No public score is available."}
      />
    );

  const state = scoreboard.liveState;
  const batting = state.battingTeamId === scoreboard.homeTeam.id ? scoreboard.homeTeam : scoreboard.awayTeam;
  const bowling = batting.id === scoreboard.homeTeam.id ? scoreboard.awayTeam : scoreboard.homeTeam;
  const ballsPerOver = state.settings?.ballsPerOver ?? 6;
  const runs = state.runs ?? 0;
  const wickets = state.wickets ?? 0;
  const legalBalls = legalBallsFromOvers(state.overs, ballsPerOver);
  const runRate = legalBalls > 0 ? (runs * ballsPerOver) / legalBalls : 0;
  const oversLimit = state.superOver ? 1 : (state.settings?.oversPerInnings ?? null);
  const chase = chaseState(state.target ?? null, runs, legalBalls, oversLimit, ballsPerOver);
  const isLive = scoreboard.status === "live" || scoreboard.status === "innings_break";
  const ribbon = state.result
    ? state.result
    : chase && chase.runsNeeded > 0
      ? `${batting.name} need ${chase.runsNeeded} ${chase.runsNeeded === 1 ? "run" : "runs"}${chase.ballsLeft != null ? ` from ${chase.ballsLeft} balls` : ""}`
      : chase
        ? `${batting.name} have reached the target`
        : (state.message ?? `${batting.name} batting`);
  const recent = state.recent ?? [];
  const commentary = state.commentary ?? null;
  const prediction = predictWin({
    oversPerInnings: state.settings?.oversPerInnings ?? null,
    inningsPerSide: state.settings?.inningsPerSide ?? 1,
    ballsPerOver,
    inningsNumber: state.inningsNumber ?? (state.target ? 2 : 1),
    runs,
    wickets,
    legalBalls,
    target: state.target ?? null,
    maxWickets: state.maxWickets ?? 10,
    battingIsHome: state.battingIsHome ?? batting.id === scoreboard.homeTeam.id,
    conditions: state.conditions ?? undefined,
  });
  const homeBatting = batting.id === scoreboard.homeTeam.id;
  const homeWin = prediction ? (homeBatting ? prediction.battingWin : prediction.bowlingWin) : null;
  const updated = new Date(scoreboard.updatedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="scoreboard-stage min-h-screen pb-24">
      <header className="scoreboard-topbar">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Link to="/" aria-label="CricLume home">
            <img src={logoAsset.url} alt="CricLume" className="h-9 w-auto md:h-10" />
          </Link>
          <div className="flex items-center gap-2">
            {(state.superOver || state.freeHit) && (
              <span className="hero-chip hero-chip-alert" role="status">
                {state.freeHit ? "Free hit" : "Super Over"}
              </span>
            )}
            <span className={`hero-chip ${isLive ? "hero-chip-live" : ""}`}>
              {isLive && <span className="live-dot" aria-hidden="true" />}
              {isLive ? "Live" : scoreboard.status.replaceAll("_", " ")}
            </span>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-3 py-4 md:px-8 md:py-8">
        <section className="scoreboard-frame">
          <div className="scoreboard-meta">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0 text-gold" aria-hidden="true" />
              <span className="truncate">{scoreboard.ground?.name ?? "Ground to be confirmed"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5 text-gold" aria-hidden="true" />
              Updated {updated}
            </span>
          </div>

          <div className="scoreboard-hero">
            <div className="flex min-w-0 flex-col items-center gap-2 text-center md:flex-row md:text-left">
              <TeamCrest name={batting.name} size="lg" />
              <div className="min-w-0">
                <p className="scoreboard-team-tag">Batting</p>
                <p className="scoreboard-team">{batting.name}</p>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <p className="scoreboard-score">
                {runs}
                <span>/{wickets}</span>
              </p>
              <p className="scoreboard-overs">
                <strong>{state.overs ?? "0.0"}</strong> overs
                {state.settings?.oversPerInnings ? ` of ${state.settings.oversPerInnings}` : ""}
              </p>
            </div>
            <div className="flex min-w-0 flex-col items-center gap-2 text-center md:flex-row-reverse md:text-right">
              <TeamCrest name={bowling.name} size="lg" />
              <div className="min-w-0">
                <p className="scoreboard-team-tag">Bowling</p>
                <p className="scoreboard-team">{bowling.name}</p>
              </div>
            </div>
          </div>

          <p className="hero-ribbon scoreboard-ribbon">{ribbon}</p>

          <div className="mt-4">
            <WinPredictor
              firstName={scoreboard.homeTeam.name}
              secondName={scoreboard.awayTeam.name}
              firstWin={homeWin}
              prediction={prediction}
              battingName={batting.name}
            />
          </div>

          {commentary && (
            <div className="card-tabs mt-4 md:hidden" role="tablist" aria-label="Scoreboard view" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", top: "64px" }}>
              <button type="button" role="tab" aria-selected={panel === "live"} onClick={() => setPanel("live")}>
                Live
              </button>
              <button type="button" role="tab" aria-selected={panel === "commentary"} onClick={() => setPanel("commentary")}>
                Ball by ball
              </button>
            </div>
          )}

          <div className={`mt-4 grid gap-3 ${commentary ? "md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:items-start" : ""}`}>
            <div className={commentary && panel !== "live" ? "hidden md:block" : ""}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="broadcast-panel">
                <table className="scoreboard-table">
                  <caption className="sr-only">Batters at the crease</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="panel-kicker">Batters</th>
                      <th scope="col">R</th>
                      <th scope="col">B</th>
                      <th scope="col">SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: "striker", label: "Striker", line: state.striker, onStrike: true },
                      { key: "non", label: "Non-striker", line: state.nonStriker, onStrike: false },
                    ].map((row) => (
                      <tr key={row.key}>
                        <th scope="row">
                          <span className="inline-flex items-center gap-2">
                            {row.onStrike ? <span className="strike-dot" aria-label="On strike" /> : <span className="inline-block w-[0.45rem]" />}
                            {row.label}
                          </span>
                        </th>
                        <td className="scoreboard-figure">{row.line ? `${row.line.runs}${row.onStrike ? "*" : ""}` : "—"}</td>
                        <td>{row.line?.balls ?? "—"}</td>
                        <td>{row.line ? strikeRate(row.line.runs, row.line.balls) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="broadcast-panel">
                <table className="scoreboard-table">
                  <caption className="sr-only">Current bowler</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="panel-kicker">Bowler</th>
                      <th scope="col">O</th>
                      <th scope="col">R</th>
                      <th scope="col">W</th>
                      <th scope="col">Econ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Bowler</th>
                      <td>{state.bowler?.overs ?? "—"}</td>
                      <td>{state.bowler?.runs ?? "—"}</td>
                      <td className="scoreboard-wickets">{state.bowler?.wickets ?? "—"}</td>
                      <td>
                        {state.bowler
                          ? (() => {
                              const balls = legalBallsFromOvers(state.bowler.overs, ballsPerOver);
                              return balls > 0 ? ((state.bowler.runs * ballsPerOver) / balls).toFixed(2) : "—";
                            })()
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="broadcast-panel mt-3">
              <p className="panel-kicker">Recent balls</p>
              {recent.length === 0 ? (
                <p className="scoreboard-muted mt-3 text-sm">The first ball hasn't been bowled yet.</p>
              ) : (
                <ol className="mt-3 flex flex-wrap gap-2 md:gap-3">
                  {recent.map((ball, index) => (
                    <li key={`${ball.label}-${index}`}>
                      <span className="ball-chip md:size-12" data-tone={ballKind(ball)}>
                        {ball.label}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 md:gap-3">
              <div className="broadcast-panel scoreboard-stat">
                <p className="panel-kicker">Run rate</p>
                <p className="scoreboard-stat-value">{runRate.toFixed(2)}</p>
                <p className="scoreboard-muted text-[11px] uppercase tracking-wider">Current</p>
              </div>
              <div className="broadcast-panel scoreboard-stat">
                <p className="panel-kicker">{chase?.requiredRate != null ? "Required" : "Target"}</p>
                <p className="scoreboard-stat-value text-gold">
                  {chase?.requiredRate != null ? chase.requiredRate.toFixed(2) : (state.target ?? "—")}
                </p>
                <p className="scoreboard-muted text-[11px] uppercase tracking-wider">
                  {chase?.requiredRate != null ? "Run rate" : state.target ? "To win" : "First innings"}
                </p>
              </div>
              <div className="broadcast-panel scoreboard-stat">
                <p className="panel-kicker">Wickets in hand</p>
                <p className="scoreboard-stat-value">{Math.max(0, 10 - wickets)}</p>
                <p className="scoreboard-muted text-[11px] uppercase tracking-wider">of 10</p>
              </div>
            </div>
            </div>
            {commentary && (
              <div className={`broadcast-panel ${panel !== "commentary" ? "hidden md:block" : ""}`}>
                <p className="panel-kicker mb-3">Ball by ball</p>
                <div className="md:max-h-[42rem] md:overflow-y-auto md:pr-1">
                  <CommentaryFeed lines={commentary} />
                </div>
              </div>
            )}
          </div>

          <p className="scoreboard-muted mt-4 text-center text-[11px]">
            Player names stay hidden on public scoreboards until the club confirms they can be shown.
          </p>
        </section>
      </main>

      <footer className="scoreboard-ticker" aria-label="Score summary">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:px-8">
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            {batting.shortName || batting.name}
          </span>
          <span className="font-display text-lg font-bold tabular-nums text-gold">
            {runs}/{wickets}
          </span>
          <span className="scoreboard-muted text-xs tabular-nums">{state.overs ?? "0.0"}</span>
          <span className="scoreboard-ticker-msg hidden min-w-0 flex-1 truncate text-center text-xs font-bold uppercase tracking-wider sm:block">
            {ribbon}
          </span>
          <span className="scoreboard-muted ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em]">
            <RotateCw className="size-3" aria-hidden="true" /> Every 10s
          </span>
        </div>
      </footer>
    </div>
  );
}

function ScoreboardMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="scoreboard-stage flex min-h-screen items-center justify-center px-4 text-center">
      <div className="broadcast-panel max-w-md p-8">
        <Radio className="mx-auto size-8 text-gold" aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-bold">{title}</h1>
        <p className="scoreboard-muted mt-2 text-sm">{detail}</p>
        <Link to="/" className="action-primary mt-6 inline-flex">
          CricLume home
        </Link>
      </div>
    </div>
  );
}
