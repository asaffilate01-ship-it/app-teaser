import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCloudClient, isCloudConfigured } from "@/lib/cloud";
import { buildGroundFeed, type GroundFeed } from "@/lib/ground-feed";

export const Route = createFileRoute("/ground/$slug")({
  head: () => ({
    meta: [
      { title: "Ground scoreboard — CricLume" },
      { name: "description", content: "Full-screen live scoreboard for a TV or projector at the ground." },
      { property: "og:title", content: "Ground scoreboard — CricLume" },
      { property: "og:description", content: "Big, high-contrast live score for screens around the ground." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GroundScreen,
});

/** Full-screen, high-contrast scoreboard for a TV, projector or LED screen fed by a laptop at the ground. */
function GroundScreen() {
  const { slug } = Route.useParams();
  const [feed, setFeed] = useState<GroundFeed | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!isCloudConfigured()) {
      setMissing(true);
      return;
    }
    let active = true;
    const load = async () => {
      const { data, error } = await getCloudClient().rpc("get_public_scoreboard", { p_slug: slug });
      if (!active) return;
      if (error || !data) setMissing(true);
      else {
        setFeed(buildGroundFeed(data as Parameters<typeof buildGroundFeed>[0]));
        setMissing(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 4_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [slug]);

  if (!feed) {
    return (
      <main className="ground-screen ground-waiting">
        <p>{missing ? "This scoreboard is not public yet." : "Connecting to the live score…"}</p>
      </main>
    );
  }

  const cells: Array<[string, string | number]> = [
    ["Overs", feed.oversLimit ? `${feed.overs}/${feed.oversLimit}` : feed.overs],
    ...(feed.target ? ([["Target", feed.target]] as Array<[string, number]>) : []),
    ...(feed.runsNeeded != null && feed.runsNeeded > 0 ? ([["Need", feed.runsNeeded]] as Array<[string, number]>) : []),
    ...(feed.ballsLeft != null && feed.target ? ([["Balls left", feed.ballsLeft]] as Array<[string, number]>) : []),
    ...(feed.par != null && feed.target ? ([["Par", feed.par]] as Array<[string, number]>) : []),
    ["Run rate", feed.runRate?.toFixed(2) ?? "–"],
  ];

  return (
    <main className="ground-screen" aria-live="polite">
      <header className="ground-head">
        <span>{feed.battingTeam}</span>
        {(feed.freeHit || feed.superOver) && <span className="ground-alert">{feed.freeHit ? "FREE HIT" : "SUPER OVER"}</span>}
        <span className="ground-vs">v {feed.bowlingTeam}</span>
      </header>
      <section className="ground-total" aria-label="Score">
        <span>{feed.runs}</span>
        <span className="ground-slash">/</span>
        <span>{feed.wickets}</span>
      </section>
      <section className="ground-cells">
        {cells.map(([key, value]) => (
          <div key={key}>
            <span>{key}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <section className="ground-players">
        <div>
          <span>Bat 1</span>
          <strong>{feed.batter1 ? `${feed.batter1.runs} (${feed.batter1.balls})` : "–"}</strong>
        </div>
        <div>
          <span>Bat 2</span>
          <strong>{feed.batter2 ? `${feed.batter2.runs} (${feed.batter2.balls})` : "–"}</strong>
        </div>
        <div>
          <span>Bowler</span>
          <strong>{feed.bowler ? `${feed.bowler.wickets}-${feed.bowler.runs} (${feed.bowler.overs})` : "–"}</strong>
        </div>
        <div>
          <span>Last balls</span>
          <strong>{feed.lastBalls.join(" ") || "–"}</strong>
        </div>
      </section>
      {feed.result && <p className="ground-result">{feed.result}</p>}
      <p className="ground-brand">CricLume live</p>
    </main>
  );
}
