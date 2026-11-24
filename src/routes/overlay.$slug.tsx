import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { lockDarkWhileMounted } from "@/lib/theme";
import { getCloudClient, isCloudConfigured } from "@/lib/cloud";
import { fetchGroundNames } from "@/lib/ground-screen-cloud";
import type { PublicBoardInput } from "@/lib/ground-board";
import {
  buildOverlayFeed,
  detectMoment,
  type OverlayFeed,
  type OverlayMoment,
} from "@/lib/overlay-feed";

type OverlayLayout = "bar" | "corner";
type OverlaySearch = { layout?: OverlayLayout; names?: "off" };

export const Route = createFileRoute("/overlay/$slug")({
  validateSearch: (search: Record<string, unknown>): OverlaySearch => ({
    ...(search["layout"] === "corner" ? { layout: "corner" as const } : {}),
    ...(search["names"] === "off" ? { names: "off" as const } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Live score overlay — CricLume" },
      {
        name: "description",
        content: "Transparent TV-style live cricket score overlay for live streams, from CricLume.",
      },
      { property: "og:title", content: "Live score overlay — CricLume" },
      {
        property: "og:description",
        content: "Add a TV-style live CricLume score to OBS, Streamlabs or any streaming software.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScoreOverlay,
});

const MOMENT_MS = 4200;
const FACT_MS = 6000;

/**
 * Transparent TV-style score bug for OBS / Streamlabs browser sources. Same public data as the
 * scoreboard; names only when the club switched them on (juniors need consent), else batting numbers.
 */
function ScoreOverlay() {
  // Broadcast and camera screens always stay dark, whatever look the visitor picked.
  useEffect(() => lockDarkWhileMounted(), []);
  const { slug } = Route.useParams();
  const { layout = "bar", names: namesSetting } = Route.useSearch();
  const [board, setBoard] = useState<PublicBoardInput | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [offline, setOffline] = useState(false);
  const [moment, setMoment] = useState<OverlayMoment | null>(null);
  const [factIndex, setFactIndex] = useState(0);
  const previous = useRef<OverlayFeed | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("overlay-page");
    return () => document.documentElement.classList.remove("overlay-page");
  }, []);

  useEffect(() => {
    if (!isCloudConfigured()) return;
    let active = true;
    const load = async () => {
      const { data: next, error } = await getCloudClient().rpc("get_public_scoreboard", {
        p_slug: slug,
      });
      if (!active) return;
      if (error || !next) setOffline(true);
      else {
        setBoard(next as unknown as PublicBoardInput);
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

  useEffect(() => {
    if (namesSetting === "off" || !isCloudConfigured()) {
      setNames({});
      return;
    }
    let active = true;
    const load = () =>
      void fetchGroundNames(slug)
        .then((next) => active && setNames(next))
        .catch(() => undefined);
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [slug, namesSetting]);

  const feed = board ? buildOverlayFeed(board, names) : null;

  // Flash a sting for wickets, boundaries and milestones.
  useEffect(() => {
    if (!feed) return;
    const next = detectMoment(previous.current, feed);
    previous.current = feed;
    if (!next) return;
    setMoment(next);
    const timer = window.setTimeout(() => setMoment(null), MOMENT_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed?.runs, feed?.wickets, feed?.overs]);

  const factCount = feed?.facts.length ?? 0;
  useEffect(() => {
    if (factCount < 2) return;
    const timer = window.setInterval(() => setFactIndex((i) => i + 1), FACT_MS);
    return () => window.clearInterval(timer);
  }, [factCount]);

  if (!feed) {
    return offline ? (
      <div className={`tv-root tv-${layout}`}>
        <div className="tv-waiting">Score feed not available — check the board is published.</div>
      </div>
    ) : null;
  }

  const fact = factCount ? feed.facts[factIndex % factCount] : null;
  const oversText = (
    <>
      {feed.overs}
      {feed.oversLimit ? <small>/{feed.oversLimit}</small> : null}
    </>
  );

  if (layout === "corner") {
    return (
      <div className="tv-root tv-corner">
        <div className="tv-card" role="status" aria-live="polite">
          <div className="tv-card-top">
            <span className="tv-code">{feed.battingCode}</span>
            <strong key={`${feed.runs}-${feed.wickets}`} className="tv-runs">
              {feed.runs}-{feed.wickets}
            </strong>
            <span className="tv-overs">{oversText}</span>
          </div>
          <div className={`tv-card-line ${feed.freeHit ? "is-alert" : ""}`}>
            {feed.freeHit ? "FREE HIT" : feed.headline}
          </div>
          {moment && <div className={`tv-card-moment tv-m-${moment.kind}`}>{moment.title}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="tv-root tv-bar">
      <div className="tv-wrap" role="status" aria-live="polite">
        <div className="tv-above">
          {moment ? (
            <div key={`${moment.kind}-${feed.overs}`} className={`tv-moment tv-m-${moment.kind}`}>
              <strong>{moment.title}</strong>
              <span>{moment.detail}</span>
            </div>
          ) : (
            <span />
          )}
          {feed.freeHit ? (
            <div className="tv-tab is-alert">FREE HIT</div>
          ) : feed.superOver && !feed.finished ? (
            <div className="tv-tab is-alert">SUPER OVER</div>
          ) : fact ? (
            <div key={fact} className="tv-tab">
              {fact}
            </div>
          ) : null}
        </div>

        <div className="tv-strip">
          <div className="tv-team">
            <span className="tv-code">{feed.battingCode}</span>
            <span className="tv-vs">v {feed.bowlingCode}</span>
          </div>
          <div className="tv-score">
            <strong key={`${feed.runs}-${feed.wickets}`} className="tv-runs">
              {feed.runs}-{feed.wickets}
            </strong>
            <span className="tv-overs">{oversText}</span>
          </div>

          {!feed.finished && feed.batters.length > 0 && (
            <div className="tv-batters">
              {feed.batters.map((b) => (
                <div key={b.key} className={b.onStrike ? "is-strike" : ""}>
                  <i aria-hidden="true" />
                  <span className="tv-name">{b.name}</span>
                  <span className="tv-fig">
                    {b.runs}
                    <small>({b.balls})</small>
                  </span>
                </div>
              ))}
            </div>
          )}

          {!feed.finished && feed.bowler && (
            <div className="tv-bowler">
              <div>
                <span className="tv-name">{feed.bowler.name}</span>
                <span className="tv-fig">
                  {feed.bowler.figures}
                  <small>({feed.bowler.overs})</small>
                </span>
              </div>
              {feed.recent.length > 0 && (
                <ol className="tv-balls" aria-label="Last balls">
                  {feed.recent.map((ball, i) => (
                    <li key={i} className={`is-${ball.kind}`}>
                      {ball.label}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div
            className={`tv-headline ${feed.stopped ? "is-stopped" : ""} ${feed.finished ? "is-final" : ""}`}
          >
            <span>{feed.headline}</span>
            <em>CricLume</em>
          </div>
        </div>
      </div>
    </div>
  );
}
