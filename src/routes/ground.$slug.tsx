import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { lockDarkWhileMounted } from "@/lib/theme";
import { Maximize } from "lucide-react";
import { isCloudConfigured } from "@/lib/cloud";
import { useCloudSession } from "@/hooks/use-cloud-session";
import {
  availablePages,
  buildGroundBoard,
  defaultGroundSettings,
  groundPageLabels,
  pageOnScreen,
  type GroundPageId,
  type GroundScreenSettings,
  type PublicBoardInput,
} from "@/lib/ground-board";
import { fetchGroundNames, fetchGroundSettings, fetchPublicBoard, loadGroundControl, type GroundControlRow } from "@/lib/ground-screen-cloud";
import { GroundPage } from "@/components/ground/GroundPages";
import { GroundReplay } from "@/components/ground/GroundReplay";
import { PromoSlot } from "@/components/promo/PromoSlot";
import { usePromos } from "@/hooks/use-promos";

export const Route = createFileRoute("/ground/$slug")({
  head: () => ({
    meta: [
      { title: "Ground big screen — CricLume" },
      { name: "description", content: "Widescreen HD scoreboard for TVs, projectors and LED screens at the ground, with rotating score pages." },
      { property: "og:title", content: "Ground big screen — CricLume" },
      { property: "og:description", content: "Scoreboard, batting, bowling, Manhattan, worm and run chase pages for the big screen at the ground." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GroundScreen,
});

/** Widescreen (16:9) ground screen: pages turn automatically or as the club picks, with optional replays. */
function GroundScreen() {
  // Broadcast and camera screens always stay dark, whatever look the visitor picked.
  useEffect(() => lockDarkWhileMounted(), []);
  const { slug } = Route.useParams();
  const { session } = useCloudSession();
  const [board, setBoard] = useState<(PublicBoardInput & { matchId: string }) | null>(null);
  const [missing, setMissing] = useState(false);
  const [settings, setSettings] = useState<GroundScreenSettings>(defaultGroundSettings);
  const [names, setNames] = useState<Record<string, string>>({});
  const [control, setControl] = useState<GroundControlRow | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [local, setLocal] = useState<{ page: GroundPageId; until: number } | null>(null);
  const [chrome, setChrome] = useState(true);
  const [replayNote, setReplayNote] = useState("");
  const { promos, onPlay } = usePromos({ surface: "ground", slug });

  useEffect(() => {
    if (!isCloudConfigured()) {
      setMissing(true);
      return;
    }
    let active = true;
    const load = async () => {
      const [next, nextSettings] = await Promise.all([fetchPublicBoard(slug), fetchGroundSettings(slug)]);
      if (!active) return;
      setBoard(next);
      setMissing(!next);
      setSettings(nextSettings);
    };
    void load();
    const timer = window.setInterval(() => void load(), 4_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [slug]);

  // Names only when the club switched them on; the database decides which players may be named.
  useEffect(() => {
    if (!settings.showNames) {
      setNames({});
      return;
    }
    let active = true;
    const load = () => void fetchGroundNames(slug).then((value) => active && setNames(value));
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [slug, settings.showNames]);

  // Replay requests are private to the club: only a signed-in screen can read them.
  const matchId = board?.matchId ?? null;
  useEffect(() => {
    if (!session || !matchId) {
      setControl(null);
      return;
    }
    let active = true;
    const load = () => void loadGroundControl(matchId).then((row) => active && setControl(row));
    load();
    const timer = window.setInterval(load, 4_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [session, matchId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  // Pointer movement shows the full-screen button briefly; arrow keys step pages on this screen for a minute.
  useEffect(() => {
    let hide = window.setTimeout(() => setChrome(false), 4_000);
    const wake = () => {
      setChrome(true);
      window.clearTimeout(hide);
      hide = window.setTimeout(() => setChrome(false), 4_000);
    };
    window.addEventListener("pointermove", wake);
    return () => {
      window.removeEventListener("pointermove", wake);
      window.clearTimeout(hide);
    };
  }, []);

  const view = useMemo(() => (board ? buildGroundBoard(board, names) : null), [board, names]);
  const available = useMemo(() => (view ? availablePages(view) : (["score"] as GroundPageId[])), [view]);
  const shown = pageOnScreen(settings, available, now);
  const page = local && local.until > now && available.includes(local.page) ? local.page : shown.page;
  const rotation = settings.pages.filter((id) => available.includes(id));

  const step = useCallback(
    (delta: number) => {
      if (rotation.length === 0) return;
      const index = Math.max(0, rotation.indexOf(page));
      setLocal({ page: rotation[(index + delta + rotation.length) % rotation.length]!, until: Date.now() + 60_000 });
    },
    [page, rotation],
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "Escape") setLocal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  if (!board || !view) {
    return (
      <main className="gs-viewport">
        <div className="gs-stage gs-waiting">
          <p>{missing ? "This scoreboard is not public yet." : "Connecting to the live score…"}</p>
        </div>
      </main>
    );
  }

  const state = (board.liveState ?? {}) as Record<string, unknown>;
  const live = board.status === "live" || board.status === "innings_break";
  const replays = control?.replays ?? "off";

  return (
    <main className="gs-viewport" aria-live="polite">
      <div className={`gs-stage ${promos.top.length > 0 ? "gs-stage-promo" : ""}`}>
        <header className="gs-head">
          <div className="gs-head-teams">
            <strong>{view.homeTeam}</strong>
            <span>v</span>
            <strong>{view.awayTeam}</strong>
          </div>
          <h1 className="gs-head-title">{groundPageLabels[page]}</h1>
          <div className="gs-head-status">
            {live ? (
              <span className="gs-live">
                <i aria-hidden="true" /> Live
              </span>
            ) : (
              <span className="gs-muted">{board.status === "completed" ? "Result" : "Match"}</span>
            )}
          </div>
        </header>
        {promos.top.length > 0 && (
          <div className="gs-promo-top">
            <PromoSlot items={promos.top} slot="top" variant="ground" onPlay={onPlay} />
          </div>
        )}
        {promos.side.length > 0 ? (
          <div className="gs-body-split">
            <section className="gs-body" key={page}>
              <GroundPage page={page} board={view} state={state} />
            </section>
            <div className="gs-promo-side">
              <PromoSlot items={promos.side} slot="side" variant="ground" onPlay={onPlay} />
            </div>
          </div>
        ) : (
          <section className="gs-body" key={page}>
            <GroundPage page={page} board={view} state={state} />
          </section>
        )}
        <footer className="gs-foot">
          <div className="gs-dots" aria-hidden="true">
            {rotation.map((id) => (
              <i key={id} className={id === page ? "is-on" : ""} />
            ))}
          </div>
          <span className="gs-brand">{view.sponsor ? `Sponsored by ${view.sponsor} · ` : ""}CricLume live</span>
          {settings.mode === "auto" && !local && rotation.length > 1 && (
            <div className="gs-progress" style={{ transform: `scaleX(${shown.progress})` }} aria-hidden="true" />
          )}
        </footer>
        {session && matchId && replays !== "off" && (
          <GroundReplay
            matchId={matchId}
            mode={replays}
            requestedId={control?.replayDeliveryId ?? null}
            requestedAt={control?.replayRequestedAt ?? null}
            onStatus={setReplayNote}
          />
        )}
        {chrome && (
          <div className="gs-chrome">
            {replayNote && session && replays !== "off" && <span className="gs-note">{replayNote}</span>}
            <button
              type="button"
              className="gs-chrome-button"
              onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
            >
              <Maximize aria-hidden="true" /> Full screen
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
