import { Link } from "@tanstack/react-router";
import { CalendarClock, ChevronRight, CloudRain, MapPin, Star } from "lucide-react";
import { TeamCrest } from "@/components/scorer/Broadcast";
import {
  battingTeam,
  countryFlag,
  liveBucket,
  liveSummary,
  stoppageLabel,
  type LiveAlertKind,
  type LiveBall,
  type LiveMatch,
  type LiveTeam,
} from "@/lib/live-centre";

const flashWords: Record<LiveAlertKind, string> = {
  wicket: "Wicket!",
  six: "Six!",
  four: "Four!",
  milestone: "Milestone",
  stoppage: "Update",
  innings: "Innings",
  result: "Result",
  start: "Started",
};

function ballTone(ball: LiveBall) {
  if (ball.kind === "wicket" || ball.label === "W") return "wicket";
  if (ball.kind === "boundary") return "boundary";
  if (ball.label === "Wd" || ball.label === "Nb") return "extra";
  if (ball.label === "·" || ball.label === "0") return "dot";
  return "run";
}

function StatusPill({ match }: { match: LiveMatch }) {
  const state = match.liveState;
  if (match.status === "completed") return <span className="live-pill live-pill-done">Result</span>;
  if (liveBucket(match) === "upcoming") return <span className="live-pill">Upcoming</span>;
  if (state?.stoppage)
    return (
      <span className="live-pill live-pill-warn">
        <CloudRain className="size-3" aria-hidden="true" />
        {stoppageLabel(state.stoppage.reason)}
      </span>
    );
  if (match.status === "innings_break")
    return <span className="live-pill live-pill-warn">Innings break</span>;
  if (state?.days?.atStumps) return <span className="live-pill live-pill-warn">Stumps</span>;
  return (
    <span className="live-pill live-pill-live">
      <span className="live-dot" aria-hidden="true" /> Live
    </span>
  );
}

function TeamRow({ team, match }: { team: LiveTeam; match: LiveMatch }) {
  const state = match.liveState;
  const started = liveBucket(match) !== "upcoming" && state && !match.delayed;
  const batting = started && battingTeam(match).id === team.id;
  let side: string | null = null;
  if (started && !batting)
    side =
      state.target != null
        ? `Target ${state.target}`
        : liveBucket(match) === "live"
          ? "Bowling"
          : null;
  return (
    <div className={`live-team ${batting ? "live-team-batting" : ""}`}>
      <TeamCrest name={team.name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="live-team-name">{team.name}</span>
        {batting && liveBucket(match) === "live" && <span className="sr-only"> (batting)</span>}
      </span>
      {batting ? (
        <span className="live-team-score">
          {state.runs ?? 0}
          <span>/{state.wickets ?? 0}</span>
          <small>{state.overs ?? "0.0"} ov</small>
        </span>
      ) : side ? (
        <span className="live-team-side">{side}</span>
      ) : null}
    </div>
  );
}

export function LiveMatchCard({
  match,
  followed,
  flash,
  onFollow,
  now,
}: {
  match: LiveMatch;
  followed: boolean;
  flash?: LiveAlertKind | undefined;
  onFollow: () => void;
  now: number;
}) {
  const upcoming = liveBucket(match) === "upcoming";
  const recent = match.liveState?.recent ?? [];
  const minutes = Math.max(0, Math.round((now - new Date(match.updatedAt).getTime()) / 60_000));
  const updated =
    minutes < 1
      ? "just now"
      : minutes < 60
        ? `${minutes} min ago`
        : `${Math.round(minutes / 60)} h ago`;
  const when = match.scheduledAt
    ? new Date(match.scheduledAt).toLocaleString([], {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Time to be confirmed";
  const place = [match.region, match.country ? countryFlag(match.country) : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className="live-card"
      data-flash={flash}
      data-bucket={liveBucket(match)}
      aria-label={`${match.homeTeam.name} v ${match.awayTeam.name}`}
    >
      {flash && (
        <span className="live-flash" data-kind={flash} role="status">
          {flash === "stoppage"
            ? match.liveState?.stoppage
              ? stoppageLabel(match.liveState.stoppage.reason)
              : "Play resumes"
            : flashWords[flash]}
        </span>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="live-card-kicker">
          <span className="truncate">
            {match.competition?.name ?? match.organisation ?? "Match"}
          </span>
          {place && <span className="shrink-0 opacity-80">· {place}</span>}
        </p>
        <StatusPill match={match} />
      </div>

      <div className="mt-3 space-y-1.5">
        <TeamRow team={match.homeTeam} match={match} />
        <TeamRow team={match.awayTeam} match={match} />
      </div>

      <p className="live-card-summary">
        {upcoming ? (
          <>
            <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" /> {when}
          </>
        ) : (
          liveSummary(match)
        )}
      </p>

      {!upcoming && liveBucket(match) === "live" && recent.length > 0 && (
        <ol className="live-balls" aria-label="Last balls">
          {recent.map((ball, index) => (
            <li key={index} className="ball-chip live-ball" data-tone={ballTone(ball)}>
              {ball.label}
            </li>
          ))}
        </ol>
      )}

      <div className="live-card-foot">
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{match.ground ?? "Ground TBC"}</span>
          {!upcoming && <span className="shrink-0">· {updated}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="live-follow"
            aria-pressed={followed}
            aria-label={followed ? "Stop following this match" : "Follow this match"}
            onClick={onFollow}
          >
            <Star className="size-4" aria-hidden="true" fill={followed ? "currentColor" : "none"} />
          </button>
          <Link to="/scoreboard/$slug" params={{ slug: match.slug }} className="live-open">
            {upcoming ? "Details" : "Scorecard"}{" "}
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        </span>
      </div>
    </article>
  );
}
