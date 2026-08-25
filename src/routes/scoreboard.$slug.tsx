import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock3, MapPin, Radio, RotateCw } from "lucide-react";
import logoAsset from "@/assets/criclume-logo-header.png.asset.json";
import { getCloudClient, isCloudConfigured } from "@/lib/cloud";

export const Route = createFileRoute("/scoreboard/$slug")({
  head: () => ({
    meta: [
      { title: "Live cricket score — CricLume" },
      {
        name: "description",
        content: "Live cricket score, innings state and recent deliveries powered by CricLume.",
      },
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
  };
  updatedAt: string;
  sponsor?: { name?: string };
}

function PublicScoreboard() {
  const { slug } = Route.useParams();
  const [scoreboard, setScoreboard] = useState<ScoreboardData | null>(null);
  const [loading, setLoading] = useState(isCloudConfigured());
  const [error, setError] = useState<string | null>(null);

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
        title="Cloud scoreboard not configured"
        detail="Connect the Supabase environment, publish a match and enable its public scoreboard."
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

  const batting =
    scoreboard.liveState.battingTeamId === scoreboard.homeTeam.id
      ? scoreboard.homeTeam
      : scoreboard.awayTeam;
  const bowling = batting.id === scoreboard.homeTeam.id ? scoreboard.awayTeam : scoreboard.homeTeam;
  return (
    <div className="min-h-screen overflow-hidden bg-[#0f0d17] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(244,63,94,0.15),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(251,191,36,0.12),transparent_38%)]" />
      <header className="relative border-b border-white/10 px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/">
            <img src={logoAsset.url} alt="CricLume" className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-rose-300">
            <span className="size-2 animate-pulse rounded-full bg-rose-400" />
            Live scoreboard
          </div>
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-14">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex flex-wrap gap-4">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-amber-300" />
              {scoreboard.ground?.name ?? "Ground to be confirmed"}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 className="size-3.5 text-amber-300" />
              Updated{" "}
              {new Date(scoreboard.updatedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
          <span>{scoreboard.weather?.summary}</span>
        </div>
        <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/40 md:p-9">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
                {batting.name} batting
              </div>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-6xl font-bold tracking-tight md:text-8xl">
                  {scoreboard.liveState.runs ?? 0}/{scoreboard.liveState.wickets ?? 0}
                </span>
                <span className="pb-2 text-lg font-bold text-slate-400">
                  {scoreboard.liveState.overs ?? "0.0"} ov
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">v {bowling.name}</div>
              {scoreboard.liveState.target && (
                <div className="mt-2 text-sm font-bold">Target {scoreboard.liveState.target}</div>
              )}
            </div>
          </div>
          {scoreboard.liveState.message && (
            <div className="mt-6 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm font-bold text-amber-100">
              {scoreboard.liveState.message}
            </div>
          )}
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <PlayerLine
              label="Batters"
              primary={
                scoreboard.liveState.striker
                  ? `${scoreboard.liveState.striker.name} ${scoreboard.liveState.striker.runs}* (${scoreboard.liveState.striker.balls})`
                  : "Awaiting striker"
              }
              secondary={
                scoreboard.liveState.nonStriker
                  ? `${scoreboard.liveState.nonStriker.name} ${scoreboard.liveState.nonStriker.runs} (${scoreboard.liveState.nonStriker.balls})`
                  : "Awaiting non-striker"
              }
            />
            <PlayerLine
              label="Bowler"
              primary={
                scoreboard.liveState.bowler
                  ? `${scoreboard.liveState.bowler.name} ${scoreboard.liveState.bowler.wickets}/${scoreboard.liveState.bowler.runs}`
                  : "Awaiting bowler"
              }
              secondary={
                scoreboard.liveState.bowler ? `${scoreboard.liveState.bowler.overs} overs` : ""
              }
            />
          </div>
          <div className="mt-7">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Recent deliveries
            </div>
            <div className="flex flex-wrap gap-2">
              {(scoreboard.liveState.recent ?? []).map((ball, index) => (
                <span
                  key={`${ball.label}-${index}`}
                  className={`flex size-10 items-center justify-center rounded-full border text-sm font-black ${ball.kind === "wicket" ? "border-rose-400 bg-rose-500 text-white" : ball.kind === "boundary" ? "border-amber-300 bg-amber-300 text-[#160f18]" : "border-white/10 bg-white/5"}`}
                >
                  {ball.label}
                </span>
              ))}
            </div>
          </div>
        </section>
        <div className="mt-5 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-600">
          <span>Powered by CricLume</span>
          <span className="flex items-center gap-1">
            <RotateCw className="size-3" />
            Auto-refreshes every 10 seconds
          </span>
        </div>
      </main>
    </div>
  );
}

function PlayerLine({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/15 p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-base font-bold">{primary}</div>
      <div className="mt-1 text-xs text-slate-400">{secondary}</div>
    </div>
  );
}

function ScoreboardMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0d17] px-4 text-center text-white">
      <div>
        <Radio className="mx-auto size-8 text-amber-300" />
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-2 max-w-md text-sm text-slate-400">{detail}</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-md bg-white px-4 py-2 text-xs font-bold text-[#160f18]"
        >
          CricLume home
        </Link>
      </div>
    </div>
  );
}
