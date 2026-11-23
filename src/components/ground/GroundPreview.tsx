import { useEffect, useMemo, useState } from "react";
import {
  availablePages,
  buildGroundBoard,
  groundPageLabels,
  pageOnScreen,
  type GroundScreenSettings,
  type PublicBoardInput,
} from "@/lib/ground-board";
import { fetchGroundNames, fetchPublicBoard } from "@/lib/ground-screen-cloud";
import { GroundPage } from "@/components/ground/GroundPages";

/**
 * Small live copy of the big screen inside the control panel. It is drawn here rather than framed,
 * because the site refuses to load inside frames (protection against click-jacking).
 */
export function GroundPreview({ slug, settings }: { slug: string; settings: GroundScreenSettings }) {
  const [board, setBoard] = useState<PublicBoardInput | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    const load = () => void fetchPublicBoard(slug).then((value) => active && setBoard(value));
    load();
    const timer = window.setInterval(load, 5_000);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, [slug]);

  useEffect(() => {
    if (!settings.showNames) {
      setNames({});
      return;
    }
    let active = true;
    void fetchGroundNames(slug).then((value) => active && setNames(value));
    return () => {
      active = false;
    };
  }, [slug, settings.showNames]);

  const view = useMemo(() => (board ? buildGroundBoard(board, names) : null), [board, names]);
  if (!board || !view) {
    return (
      <div className="stay-dark gs-stage gs-stage-preview gs-waiting">
        <p>Waiting for the live score…</p>
      </div>
    );
  }
  const page = pageOnScreen(settings, availablePages(view), now).page;
  return (
    <div className="stay-dark gs-stage gs-stage-preview">
      <header className="gs-head">
        <div className="gs-head-teams">
          <strong>{view.homeTeam}</strong>
          <span>v</span>
          <strong>{view.awayTeam}</strong>
        </div>
        <p className="gs-head-title">{groundPageLabels[page]}</p>
        <div className="gs-head-status" />
      </header>
      <section className="gs-body">
        <GroundPage page={page} board={view} state={(board.liveState ?? {}) as Record<string, unknown>} />
      </section>
      <footer className="gs-foot">
        <span className="gs-brand">Preview</span>
      </footer>
    </div>
  );
}
