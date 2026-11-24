import { useEffect, useState } from "react";
import { ExternalLink, MonitorPlay, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { GroundPreview } from "@/components/ground/GroundPreview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  defaultGroundSettings,
  groundPageIds,
  groundPageLabels,
  type GroundPageId,
  type GroundScreenSettings,
  type ReplayMode,
} from "@/lib/ground-board";
import {
  loadGroundControl,
  loadReplayCandidates,
  requestGroundReplay,
  saveGroundScreen,
  type ReplayCandidate,
} from "@/lib/ground-screen-cloud";

const intervals = [8, 10, 15, 20, 30, 45, 60, 90, 120];
const replayModes: Array<{ id: ReplayMode; label: string; hint: string }> = [
  { id: "off", label: "Off", hint: "No video on the big screen." },
  { id: "manual", label: "When I send one", hint: "Pick a wicket or boundary below to play it." },
  {
    id: "auto",
    label: "Automatic",
    hint: "Each new wicket and boundary plays once its recording has uploaded.",
  },
];

/** Control panel for the ground big screen: page rotation, manual pages, names and replays. */
export function GroundScreenControl({
  matchId,
  slug,
  matchTitle,
}: {
  matchId: string;
  slug: string;
  matchTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<GroundScreenSettings>(defaultGroundSettings);
  const [saving, setSaving] = useState(false);
  const [balls, setBalls] = useState<ReplayCandidate[]>([]);
  const [loadingBalls, setLoadingBalls] = useState(false);

  useEffect(() => {
    if (!open) return;
    void loadGroundControl(matchId).then((row) => row && setSettings(row));
  }, [open, matchId]);

  const refreshBalls = async () => {
    setLoadingBalls(true);
    try {
      setBalls(await loadReplayCandidates(matchId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load replays");
    } finally {
      setLoadingBalls(false);
    }
  };
  useEffect(() => {
    if (open && settings.replays !== "off") void refreshBalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, settings.replays]);

  const save = async (next: GroundScreenSettings) => {
    const previous = settings;
    setSettings(next);
    setSaving(true);
    try {
      await saveGroundScreen(matchId, next);
    } catch (error) {
      setSettings(previous);
      toast.error(error instanceof Error ? error.message : "Couldn't update the ground screen");
    } finally {
      setSaving(false);
    }
  };

  const togglePage = (id: GroundPageId) => {
    const pages = settings.pages.includes(id)
      ? settings.pages.filter((page) => page !== id)
      : groundPageIds.filter((page) => page === id || settings.pages.includes(page));
    if (pages.length === 0) return;
    void save({ ...settings, pages });
  };

  const sendReplay = async (ball: ReplayCandidate) => {
    try {
      await requestGroundReplay(matchId, ball.id);
      toast.success(`Replay sent: over ${ball.over_number}.${ball.ball_in_over}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send the replay");
    }
  };

  const screenLink = `/ground/${slug}`;

  return (
    <>
      <button
        type="button"
        className="action-secondary"
        onClick={() => setOpen(true)}
        title="Choose what the big screen at the ground shows"
      >
        Screen control <MonitorPlay className="size-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="ground-control max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ground screen · {matchTitle}</DialogTitle>
            <DialogDescription>
              Open the screen link on the laptop or smart TV connected to the big screen, then press
              Full screen. Changes here reach every screen within a few seconds.
            </DialogDescription>
          </DialogHeader>

          <div className="ground-control-preview" aria-label="Live preview of the big screen">
            {open && <GroundPreview slug={slug} settings={settings} />}
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={screenLink} target="_blank" rel="noreferrer" className="action-primary">
              Open screen <ExternalLink className="size-3.5" />
            </a>
            <button
              type="button"
              className="action-secondary"
              onClick={() => {
                const link = `${window.location.origin}${screenLink}`;
                void navigator.clipboard
                  .writeText(link)
                  .then(() => toast.success("Screen link copied"))
                  .catch(() => window.prompt("Copy the screen link", link));
              }}
            >
              Copy link
            </button>
          </div>

          <section className="ground-control-section">
            <h3>Pages</h3>
            <div className="insights-toggle" role="group" aria-label="Page switching">
              {(["auto", "manual"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={settings.mode === mode}
                  className={settings.mode === mode ? "is-active" : ""}
                  disabled={saving}
                  onClick={() => void save({ ...settings, mode })}
                >
                  {mode === "auto" ? "Change automatically" : "I choose the page"}
                </button>
              ))}
            </div>
            {settings.mode === "auto" ? (
              <>
                <p className="ground-control-hint">
                  Tick the pages to rotate through. Pages with nothing to show yet are skipped.
                </p>
                <div className="ground-control-pages">
                  {groundPageIds.map((id) => (
                    <label key={id} className={settings.pages.includes(id) ? "is-on" : ""}>
                      <input
                        type="checkbox"
                        checked={settings.pages.includes(id)}
                        onChange={() => togglePage(id)}
                        disabled={saving}
                      />
                      {groundPageLabels[id]}
                    </label>
                  ))}
                </div>
                <label className="ground-control-row">
                  Seconds per page
                  <select
                    value={settings.intervalSeconds}
                    onChange={(event) =>
                      void save({ ...settings, intervalSeconds: Number(event.target.value) })
                    }
                    disabled={saving}
                  >
                    {intervals.map((value) => (
                      <option key={value} value={value}>
                        {value} seconds
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
                <p className="ground-control-hint">
                  Tap a page to put it on the big screen now. It stays until you pick another.
                </p>
                <div className="ground-control-pages">
                  {groundPageIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={settings.manualPage === id ? "is-on" : ""}
                      aria-pressed={settings.manualPage === id}
                      onClick={() => void save({ ...settings, manualPage: id })}
                      disabled={saving}
                    >
                      {groundPageLabels[id]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="ground-control-section">
            <h3>Player names</h3>
            <label className="ground-control-row">
              <span>
                Show names on the batting and bowling pages
                <small>
                  Adults are named. Junior players are named only when a parent-signed publicity
                  consent is recorded and current; everyone else shows as their batting position or
                  bowling order.
                </small>
              </span>
              <input
                type="checkbox"
                checked={settings.showNames}
                onChange={(event) => void save({ ...settings, showNames: event.target.checked })}
                disabled={saving}
              />
            </label>
          </section>

          <section className="ground-control-section">
            <h3>Video replays</h3>
            <div className="insights-toggle" role="group" aria-label="Replays">
              {replayModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={settings.replays === mode.id}
                  className={settings.replays === mode.id ? "is-active" : ""}
                  disabled={saving}
                  onClick={() => void save({ ...settings, replays: mode.id })}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <p className="ground-control-hint">
              {replayModes.find((mode) => mode.id === settings.replays)?.hint} Replays play only on
              a screen signed in with a club account, use the angles your phones or club cameras
              filmed, and only for balls where the batter and bowler have public-highlight consent.
              Each phone uploads its video every minute, so a replay is ready a minute or two after
              the ball.
            </p>
            {settings.replays !== "off" && (
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">Recent wickets and boundaries</strong>
                  <button
                    type="button"
                    className="app-chip-button"
                    onClick={() => void refreshBalls()}
                    disabled={loadingBalls}
                  >
                    <RefreshCw className="size-4" /> Refresh
                  </button>
                </div>
                {balls.length === 0 ? (
                  <p className="ground-control-hint">
                    No wickets or boundaries with public-highlight consent yet.
                  </p>
                ) : (
                  <ul className="ground-control-balls">
                    {balls.slice(0, 12).map((ball) => (
                      <li key={ball.id}>
                        <span>
                          Over {ball.over_number}.{ball.ball_in_over} ·{" "}
                          {ball.wicket ? "Wicket" : ball.batter_runs === 6 ? "Six" : "Four"}
                        </span>
                        <button
                          type="button"
                          className="app-chip-button"
                          onClick={() => void sendReplay(ball)}
                        >
                          <Play className="size-4" /> Play on screen
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
