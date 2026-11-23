import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCloudClient, isCloudConfigured } from "@/lib/cloud";
import { chaseState, teamInitials } from "@/lib/match-broadcast";

type OverlayLayout = "bar" | "corner";

export const Route = createFileRoute("/overlay/$slug")({
  validateSearch: (search: Record<string, unknown>): { layout?: OverlayLayout } =>
    search["layout"] === "corner" ? { layout: "corner" } : {},
  head: () => ({
    meta: [
      { title: "Live score overlay — CricLume" },
      { name: "description", content: "Transparent live cricket score overlay for live streams, from CricLume." },
      { property: "og:title", content: "Live score overlay — CricLume" },
      { property: "og:description", content: "Add the live CricLume score to OBS, Streamlabs or any streaming software." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScoreOverlay,
});

interface OverlayState {
  battingTeamId?: string;
  runs?: number;
  wickets?: number;
  overs?: string;
  target?: number | null;
  striker?: { runs: number; balls: number } | null;
  nonStriker?: { runs: number; balls: number } | null;
  bowler?: { wickets: number; runs: number; overs: string } | null;
  recent?: Array<{ label: string; kind?: string }>;
  settings?: { oversPerInnings?: number | null; ballsPerOver?: number };
  superOver?: boolean;
  freeHit?: boolean;
  result?: string | null;
  rain?: { revisedOvers?: number | null } | null;
  par?: number | null;
  oversLimit?: number | null;
}

interface OverlayData {
  status: string;
  homeTeam: { id: string; name: string; shortName?: string };
  awayTeam: { id: string; name: string; shortName?: string };
  liveState: OverlayState;
}

const shortName = (team: { name: string; shortName?: string }) =>
  (team.shortName && team.shortName.trim()) || team.name;

/** Transparent score bug for OBS / Streamlabs browser sources. Same public data as the scoreboard, no names. */
function ScoreOverlay() {
  const { slug } = Route.useParams();
  const { layout = "bar" } = Route.useSearch();
  const [data, setData] = useState<OverlayData | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("overlay-page");
    return () => document.documentElement.classList.remove("overlay-page");
  }, []);

  useEffect(() => {
    if (!isCloudConfigured()) return;
    let active = true;
    const load = async () => {
      const { data: next, error } = await getCloudClient().rpc("get_public_scoreboard", { p_slug: slug });
      if (!active) return;
      if (error || !next) setOffline(true);
      else {
        setData(next as OverlayData);
        setOffline(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 4_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [slug]);

  if (!data) {
    return offline ? (
      <div className={`overlay-root overlay-${layout}`}>
        <div className="overlay-bug overlay-waiting">Score feed not available — check the board is published.</div>
      </div>
    ) : null;
  }

  const state = data.liveState ?? {};
  const batting = state.battingTeamId === data.awayTeam.id ? data.awayTeam : data.homeTeam;
  const bowling = batting.id === data.homeTeam.id ? data.awayTeam : data.homeTeam;
  const bpo = state.settings?.ballsPerOver ?? 6;
  const match = /^(\d+)\.(\d+)$/.exec(state.overs ?? "");
  const legal = match ? Number(match[1]) * bpo + Number(match[2]) : 0;
  const oversLimit =
    state.oversLimit !== undefined
      ? state.oversLimit
      : state.superOver
        ? 1
        : (state.settings?.oversPerInnings ?? null);
  const chase = chaseState(state.target ?? null, state.runs ?? 0, legal, oversLimit, bpo);
  const info = state.result
    ? state.result
    : chase && chase.runsNeeded > 0
      ? `Need ${chase.runsNeeded} from ${chase.ballsLeft ?? "–"}${chase.ballsLeft != null ? " balls" : ""}${state.par != null ? ` · Par ${state.par}` : ""}`
      : state.target
        ? `Target ${state.target}`
        : `v ${shortName(bowling)}`;
  const recent = (state.recent ?? []).slice(-6);

  return (
    <div className={`overlay-root overlay-${layout}`}>
      <div className="overlay-bug" role="status" aria-live="polite">
        <div className="overlay-team">
          <span className="overlay-crest">{teamInitials(batting.name)}</span>
          <span className="overlay-name">{shortName(batting)}</span>
        </div>
        <div className="overlay-score">
          <strong>
            {state.runs ?? 0}-{state.wickets ?? 0}
          </strong>
          <span>
            {state.overs ?? "0.0"}
            {oversLimit ? `/${oversLimit}` : ""} ov
          </span>
        </div>
        {layout === "bar" && (
          <div className="overlay-crease">
            {state.striker && (
              <span>
                <i className="overlay-strike" aria-hidden="true" />
                {state.striker.runs} ({state.striker.balls})
              </span>
            )}
            {state.nonStriker && (
              <span>
                {state.nonStriker.runs} ({state.nonStriker.balls})
              </span>
            )}
            {state.bowler && (
              <span className="overlay-bowler">
                {state.bowler.wickets}-{state.bowler.runs} ({state.bowler.overs})
              </span>
            )}
          </div>
        )}
        {layout === "bar" && recent.length > 0 && (
          <ol className="overlay-balls" aria-label="Last balls">
            {recent.map((ball, index) => (
              <li key={index} className={ball.kind === "wicket" ? "is-wicket" : ball.kind === "boundary" ? "is-boundary" : ""}>
                {ball.label}
              </li>
            ))}
          </ol>
        )}
        <div className={`overlay-info ${state.freeHit || state.superOver ? "is-alert" : ""}`}>
          {state.freeHit ? "FREE HIT" : state.superOver && !state.result ? `SUPER OVER · ${info}` : info}
        </div>
        {layout === "bar" && <span className="overlay-brand">CricLume</span>}
      </div>
    </div>
  );
}
