import { CloudRain, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { CricketMatch, StoppageReason } from "@/lib/cricket";
import { resumePlay, stopPlay, stoppageReasons } from "@/lib/stoppage";

function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

/** Rain delay / bad light: pauses scoring and tells everyone watching that play has stopped. */
export function StoppagePanel({
  match,
  onSave,
}: {
  match: CricketMatch;
  onSave: (match: CricketMatch, eventType?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const stoppage = match.stoppage;
  useEffect(() => {
    if (!stoppage) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [stoppage]);
  if (match.status !== "live" || match.days?.atStumps) return null;

  if (stoppage) {
    const label =
      stoppageReasons.find((item) => item.id === stoppage.reason)?.label ?? "Play suspended";
    return (
      <section className="rule-banner mb-4" role="status" aria-label="Play stopped">
        <span className="flex min-w-0 items-center gap-3">
          <CloudRain className="size-5 shrink-0 text-gold" aria-hidden="true" />
          <span className="min-w-0">
            <strong>{label}</strong>
            <span className="block">
              Scoring is paused · {minutesSince(stoppage.since, now)} min so far. Viewers can see
              play has stopped.
            </span>
          </span>
        </span>
        <button
          type="button"
          className="action-primary shrink-0"
          onClick={() => onSave(resumePlay(match), "match.play_resumed")}
        >
          <Play className="size-4" aria-hidden="true" /> Resume play
        </button>
      </section>
    );
  }

  return (
    <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
      {open ? (
        <>
          <span className="text-xs text-muted-foreground">Why has play stopped?</span>
          {stoppageReasons.map((reason) => (
            <button
              key={reason.id}
              type="button"
              className="action-secondary"
              onClick={() => {
                setOpen(false);
                onSave(stopPlay(match, reason.id as StoppageReason), "match.play_stopped");
              }}
            >
              {reason.label}
            </button>
          ))}
          <button type="button" className="action-secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </>
      ) : (
        <button type="button" className="action-secondary" onClick={() => setOpen(true)}>
          <CloudRain className="size-4" aria-hidden="true" /> Stop play (rain, light…)
        </button>
      )}
    </div>
  );
}
