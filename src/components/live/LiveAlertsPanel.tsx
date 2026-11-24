import { Bell, BellRing, CircleDot, CloudRain, Flag, Sparkles, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { liveAlertKinds, type LiveAlertKind, type LiveAlertPrefs } from "@/lib/live-centre";
import type { FeedEvent } from "@/hooks/use-live-centre";

const kindIcon: Record<LiveAlertKind, typeof Bell> = {
  wicket: CircleDot,
  six: Sparkles,
  four: Sparkles,
  milestone: Flag,
  stoppage: CloudRain,
  innings: Flag,
  result: Trophy,
  start: BellRing,
};

export function LiveAlertsPanel({
  prefs,
  setPrefs,
  feed,
  onOpen,
  followingCount,
}: {
  prefs: LiveAlertPrefs;
  setPrefs: (prefs: LiveAlertPrefs) => void;
  feed: FeedEvent[];
  onOpen: (slug: string) => void;
  followingCount: number;
}) {
  const [permission, setPermission] = useState<string>("default");
  useEffect(() => {
    setPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  const toggleBrowser = async () => {
    if (prefs.browser) {
      setPrefs({ ...prefs, browser: false });
      return;
    }
    if (!("Notification" in window)) return;
    const result =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    setPermission(result);
    if (result === "granted") setPrefs({ ...prefs, browser: true });
  };

  return (
    <div className="space-y-4">
      <section className="broadcast-panel" aria-labelledby="alert-settings">
        <h2 id="alert-settings" className="flex items-center gap-2 text-base font-bold">
          <Bell className="size-4 text-gold" aria-hidden="true" /> Match alerts
        </h2>
        <p className="mt-1 text-xs scoreboard-muted">Pick what pops up while this page is open.</p>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Alert types">
          {liveAlertKinds.map((kind) => (
            <button
              key={kind.id}
              type="button"
              className="live-toggle"
              aria-pressed={prefs.kinds[kind.id]}
              onClick={() =>
                setPrefs({ ...prefs, kinds: { ...prefs.kinds, [kind.id]: !prefs.kinds[kind.id] } })
              }
            >
              {kind.label}
            </button>
          ))}
        </div>
        <div className="live-segment mt-3" role="radiogroup" aria-label="Which matches">
          <button
            type="button"
            role="radio"
            aria-checked={prefs.scope === "all"}
            onClick={() => setPrefs({ ...prefs, scope: "all" })}
          >
            All matches
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={prefs.scope === "following"}
            onClick={() => setPrefs({ ...prefs, scope: "following" })}
          >
            Followed ({followingCount})
          </button>
        </div>
        {permission !== "unsupported" && (
          <label className="rule-toggle mt-3">
            <input
              type="checkbox"
              checked={prefs.browser}
              disabled={permission === "denied"}
              onChange={() => void toggleBrowser()}
            />
            <span>
              <span className="rule-toggle-title">Notify me in another tab</span>
              <span className="rule-toggle-hint">
                {permission === "denied"
                  ? "Notifications are blocked for this site in your browser settings."
                  : "Shows a system notification when this page is in the background."}
              </span>
            </span>
          </label>
        )}
        <p className="mt-3 text-[11px] leading-4 scoreboard-muted">
          Want alerts on your phone with the page closed? Open a match and tap “Phone alerts”.
        </p>
      </section>

      <section className="broadcast-panel" aria-labelledby="latest-moments">
        <h2 id="latest-moments" className="panel-kicker">
          Latest moments
        </h2>
        {feed.length === 0 ? (
          <p className="mt-2 text-sm scoreboard-muted">
            Wickets, boundaries, rain delays and results appear here as they happen.
          </p>
        ) : (
          <ol className="mt-2 space-y-1" aria-live="polite">
            {feed.map((event) => {
              const Icon = kindIcon[event.kind];
              return (
                <li key={event.key}>
                  <button
                    type="button"
                    className="live-feed-item"
                    data-kind={event.kind}
                    onClick={() => onOpen(event.slug)}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-bold">{event.title}</span>
                      <span className="block truncate text-xs scoreboard-muted">{event.body}</span>
                    </span>
                    <time
                      className="shrink-0 text-[10px] scoreboard-muted"
                      dateTime={new Date(event.at).toISOString()}
                    >
                      {new Date(event.at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
