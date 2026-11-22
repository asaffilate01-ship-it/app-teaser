import type { ReactNode } from "react";
import { Gauge, Target, TrendingUp } from "lucide-react";
import {
  battingCard,
  bowlingCard,
  currentInnings,
  deliveryLabel,
  findPlayer,
  findTeam,
  summarizeInnings,
  targetForCurrentInnings,
  type CricketMatch,
} from "@/lib/cricket";
import { ballCaption, ballTone, chaseState, projectedScore, teamInitials } from "@/lib/match-broadcast";

/** Shield crest with the team's monogram — used wherever a team logo would go. */
export function TeamCrest({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "size-16 md:size-20" : size === "sm" ? "size-9" : "size-12";
  const text = size === "lg" ? "text-lg md:text-xl" : size === "sm" ? "text-[10px]" : "text-sm";
  return (
    <span className={`crest ${box}`} aria-hidden="true">
      <svg viewBox="0 0 64 72" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id="crest-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--crest-rim-a)" />
            <stop offset="1" stopColor="var(--crest-rim-b)" />
          </linearGradient>
        </defs>
        <path
          d="M32 3 59 12v22c0 17-11.5 28.5-27 35C16.5 62.5 5 51 5 34V12Z"
          fill="var(--crest-fill)"
          stroke="url(#crest-rim)"
          strokeWidth="3"
        />
      </svg>
      <span className={`relative font-display font-bold tracking-wide ${text}`}>{teamInitials(name)}</span>
    </span>
  );
}

/** Broadcast-style score header: crests, big score, chase/status ribbon. */
export function ScoreHero({ match, sync }: { match: CricketMatch; sync?: ReactNode }) {
  const innings = currentInnings(match);
  const bpo = match.settings.ballsPerOver;
  const summary = summarizeInnings(innings, bpo);
  const batting = findTeam(match, innings.battingTeamId);
  const bowling = findTeam(match, innings.bowlingTeamId);
  const target = targetForCurrentInnings(match);
  const chase = chaseState(target, summary.runs, summary.legalBalls, match.settings.oversPerInnings, bpo);
  const earlier = match.innings.filter((item) => item.battingTeamId === bowling.id && item.id !== innings.id);
  const bowlingScore = earlier.length
    ? earlier.map((item) => {
        const s = summarizeInnings(item, bpo);
        return `${s.runs}/${s.wickets}`;
      })
    : null;
  const ribbon =
    chase && chase.runsNeeded > 0
      ? `${batting.name} need ${chase.runsNeeded} ${chase.runsNeeded === 1 ? "run" : "runs"}${chase.ballsLeft != null ? ` from ${chase.ballsLeft} balls` : ""}`
      : chase
        ? `${batting.name} have reached the target`
        : `${batting.name} batting · Innings ${innings.number}`;
  const live = match.status === "live";

  return (
    <section className="broadcast-hero" aria-label="Live score">
      <div className="flex flex-wrap items-center justify-center gap-2 text-center">
        <span className={`hero-chip ${live ? "hero-chip-live" : ""}`}>
          {live && <span className="live-dot" aria-hidden="true" />}
          {match.status.replace("-", " ")}
        </span>
        <span className="hero-chip">{match.settings.format}</span>
        {match.settings.ground && <span className="hero-chip hidden sm:inline-flex">{match.settings.ground}</span>}
        {sync}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-8">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <TeamCrest name={batting.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-[0.12em] md:text-sm">{batting.name}</p>
            <p className="font-display text-4xl font-bold leading-none tabular-nums text-gold md:text-6xl">
              {summary.runs}
              <span className="text-2xl md:text-4xl">/{summary.wickets}</span>
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground md:text-xs">
              {summary.overs}
              {match.settings.oversPerInnings ? ` / ${match.settings.oversPerInnings}` : ""} overs
            </p>
          </div>
        </div>
        <span className="hero-vs" aria-hidden="true">v</span>
        <div className="flex min-w-0 flex-row-reverse items-center gap-3 text-right md:gap-4">
          <TeamCrest name={bowling.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-[0.12em] md:text-sm">{bowling.name}</p>
            <p className="mt-1 font-display text-lg text-muted-foreground md:text-2xl">
              {bowlingScore ? bowlingScore.join(" & ") : "Yet to bat"}
            </p>
          </div>
        </div>
      </div>

      <p className="hero-ribbon">{ribbon}</p>
    </section>
  );
}

/** Striker, non-striker and bowler figures — the strip under the score. */
export function CreaseStrip({
  match,
  strikerId,
  nonStrikerId,
  bowlerId,
}: {
  match: CricketMatch;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
}) {
  const innings = currentInnings(match);
  const bat = battingCard(match, innings);
  const bowl = bowlingCard(match, innings);
  const row = (id: string) => bat.find((item) => item.playerId === id);
  const bowler = bowl.find((item) => item.playerId === bowlerId);
  const batter = (id: string, onStrike: boolean) => {
    const r = row(id);
    return (
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          <span className="truncate">{findPlayer(match, id)?.name ?? "—"}</span>
          {onStrike && <span className="strike-dot" aria-label="on strike" />}
        </p>
        <p className="text-sm tabular-nums text-gold">
          {r?.runs ?? 0} <span className="text-muted-foreground">({r?.balls ?? 0})</span>
        </p>
      </div>
    );
  };
  return (
    <div className="crease-strip">
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
        {batter(strikerId, true)}
        {batter(nonStrikerId, false)}
      </div>
      <span className="h-10 w-px bg-white/10" aria-hidden="true" />
      <div className="min-w-0 text-right">
        <p className="truncate text-sm font-semibold">{findPlayer(match, bowlerId)?.name ?? "—"}</p>
        <p className="text-sm tabular-nums text-gold">
          {bowler ? `${bowler.overs}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}` : "0-0-0-0"}
        </p>
      </div>
    </div>
  );
}

/** Recent deliveries as a connected trail, newest on the right. */
export function BallTrail({ match, limit = 6 }: { match: CricketMatch; limit?: number }) {
  const balls = currentInnings(match).deliveries.slice(-limit);
  return (
    <section className="broadcast-panel" aria-label="Recent deliveries">
      <p className="panel-kicker text-center">Recent deliveries</p>
      {balls.length === 0 ? (
        <p className="mt-3 text-center text-sm text-muted-foreground">No balls recorded yet — tap a run to start.</p>
      ) : (
        <ol className="ball-trail mt-3">
          {balls.map((ball) => (
            <li key={ball.id} className="ball-trail-item">
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {ball.over}.{ball.ball}
              </span>
              <span className="ball-chip" data-tone={ballTone(ball)}>
                {deliveryLabel(ball)}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {ballCaption(ball)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Current rate, projected score and (when chasing) the required rate. */
export function RateStrip({ match }: { match: CricketMatch }) {
  const innings = currentInnings(match);
  const bpo = match.settings.ballsPerOver;
  const summary = summarizeInnings(innings, bpo);
  const target = targetForCurrentInnings(match);
  const chase = chaseState(target, summary.runs, summary.legalBalls, match.settings.oversPerInnings, bpo);
  const projected = projectedScore(summary.runs, summary.legalBalls, match.settings.oversPerInnings, bpo);
  const items = [
    { icon: Gauge, label: "Run rate", value: summary.runRate.toFixed(2) },
    chase?.requiredRate != null
      ? { icon: Target, label: "Required rate", value: chase.requiredRate.toFixed(2) }
      : { icon: TrendingUp, label: "Projected", value: projected != null ? String(projected) : "—" },
  ];
  return (
    <div className="broadcast-panel grid grid-cols-2 divide-x divide-white/10 py-4">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center justify-center gap-3">
          <Icon className="size-7 text-gold" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
