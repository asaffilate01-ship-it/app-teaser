import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCloudClient, isCloudConfigured } from "@/lib/cloud";
import { chaseState } from "@/lib/match-broadcast";

type EmbedSearch = { theme?: "light" };

export const Route = createFileRoute("/embed/$slug")({
  validateSearch: (search: Record<string, unknown>): EmbedSearch => (search["theme"] === "light" ? { theme: "light" } : {}),
  head: () => ({
    meta: [
      { title: "Live score widget — CricLume" },
      { name: "description", content: "A small live cricket score for club and league websites, updated ball by ball by CricLume." },
      { property: "og:title", content: "Live score widget — CricLume" },
      { property: "og:description", content: "Put a live CricLume cricket score on any website." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScoreWidget,
});

interface Board {
  status: string;
  homeTeam: { id: string; name: string; shortName: string };
  awayTeam: { id: string; name: string; shortName: string };
  liveState: {
    battingTeamId?: string;
    runs?: number;
    wickets?: number;
    overs?: string;
    target?: number;
    result?: string | null;
    oversLimit?: number | null;
    settings?: { oversPerInnings?: number | null; ballsPerOver?: number };
    recent?: Array<{ label: string }>;
  };
}

function legalBalls(overs: string | undefined, perOver: number) {
  const [whole, part] = (overs ?? "0.0").split(".");
  return (Number(whole) || 0) * perOver + (Number(part) || 0);
}

/** Read-only score card other websites can show in a frame. Same name-free public data as the scoreboard. */
function ScoreWidget() {
  const { slug } = Route.useParams();
  const { theme } = Route.useSearch();
  const [board, setBoard] = useState<Board | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!isCloudConfigured()) return;
    let active = true;
    const load = async () => {
      const { data, error } = await getCloudClient().rpc("get_public_scoreboard", { p_slug: slug });
      if (!active) return;
      if (error || !data) setMissing(true);
      else {
        setBoard(data as unknown as Board);
        setMissing(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [slug]);

  const href = `/scoreboard/${slug}`;
  if (!board) {
    return (
      <a className="score-widget" data-theme={theme ?? "dark"} href={href} target="_blank" rel="noopener">
        <span className="score-widget-muted">{missing ? "Live score not available" : "Loading live score…"}</span>
      </a>
    );
  }
  const state = board.liveState;
  const batting = state.battingTeamId === board.awayTeam.id ? board.awayTeam : board.homeTeam;
  const bowling = batting.id === board.homeTeam.id ? board.awayTeam : board.homeTeam;
  const perOver = state.settings?.ballsPerOver ?? 6;
  const limit = state.oversLimit !== undefined ? state.oversLimit : (state.settings?.oversPerInnings ?? null);
  const chase = chaseState(state.target ?? null, state.runs ?? 0, legalBalls(state.overs, perOver), limit, perOver);
  const line = state.result
    ? state.result
    : chase && chase.runsNeeded > 0
      ? `Need ${chase.runsNeeded} from ${chase.ballsLeft != null ? `${chase.ballsLeft} balls` : "the innings"}`
      : `v ${bowling.name}`;
  const live = board.status === "live" || board.status === "innings_break";
  return (
    <a className="score-widget" data-theme={theme ?? "dark"} href={href} target="_blank" rel="noopener" aria-label={`${batting.name} ${state.runs ?? 0} for ${state.wickets ?? 0} — open the full scoreboard`}>
      <span className="score-widget-top">
        <span className={`score-widget-status ${live ? "is-live" : ""}`}>{live ? "Live" : board.status.replace("_", " ")}</span>
        <span className="score-widget-muted">CricLume</span>
      </span>
      <span className="score-widget-main">
        <span className="score-widget-team">{batting.shortName || batting.name}</span>
        <span className="score-widget-score">
          {state.runs ?? 0}/{state.wickets ?? 0}
        </span>
        <span className="score-widget-muted">({state.overs ?? "0.0"}{limit ? `/${limit}` : ""})</span>
      </span>
      <span className="score-widget-line">{line}</span>
      {(state.recent?.length ?? 0) > 0 && (
        <span className="score-widget-balls" aria-label="Recent balls">
          {state.recent!.slice(-6).map((ball, index) => (
            <span key={index}>{ball.label}</span>
          ))}
        </span>
      )}
    </a>
  );
}
