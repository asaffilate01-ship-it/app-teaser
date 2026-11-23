import { Moon, Sun } from "lucide-react";
import type { CricketMatch } from "@/lib/cricket";
import { callStumps, closeOfPlayText, currentDay, endMatchOutOfTime, isMultiDay, outOfTime, scheduledDays, startNextDay } from "@/lib/multi-day";

/** Multi-day play: Day N of M, stumps, start the next day, and a draw when time runs out. */
export function DayPanel({ match, onSave }: { match: CricketMatch; onSave: (match: CricketMatch, eventType?: string) => void }) {
  if (!isMultiDay(match)) return null;
  const day = currentDay(match);
  const days = scheduledDays(match);
  const atStumps = Boolean(match.days?.atStumps);
  const done = match.status === "completed";
  const closes = match.days?.closes ?? [];
  const lastDay = days !== null && day >= days;

  const stumps = () => onSave(callStumps(match), "match.stumps");
  const nextDay = () => onSave(startNextDay(match), "match.day_started");
  const timeUp = () => {
    if (!window.confirm("End the match now because time has run out? Unless a result has been reached, it will be drawn.")) return;
    onSave(endMatchOutOfTime(match), "match.completed");
  };

  return (
    <section className={`broadcast-panel mb-4 ${atStumps ? "day-panel-stumps" : ""}`} aria-label="Day of play">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          {atStumps ? <Moon className="size-5 text-gold" aria-hidden="true" /> : <Sun className="size-5 text-gold" aria-hidden="true" />}
          <span>
            <span className="panel-kicker block">
              Day {day}
              {days ? ` of ${days}` : ""}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {done ? "Match finished" : atStumps ? "Stumps — play has stopped for the day" : "Play in progress"}
            </span>
          </span>
        </span>
        {!done && (
          <div className="flex flex-wrap gap-2">
            {atStumps ? (
              outOfTime(match) ? null : (
                <button type="button" className="action-primary" onClick={nextDay}>
                  Start day {day + 1}
                </button>
              )
            ) : (
              <button type="button" className="action-secondary" onClick={stumps}>
                Stumps
              </button>
            )}
            {(atStumps || lastDay) && (
              <button type="button" className={outOfTime(match) ? "action-primary" : "action-secondary"} onClick={timeUp}>
                Out of time — end match
              </button>
            )}
          </div>
        )}
      </div>
      {atStumps && !done && <p className="mt-3 text-sm">Scoring is paused. {outOfTime(match) ? "This was the last scheduled day." : `Tap “Start day ${day + 1}” when play resumes.`}</p>}
      {closes.length > 0 && (
        <ol className="mt-3 grid gap-1 text-xs text-muted-foreground">
          {closes.map((close) => (
            <li key={close.day}>{closeOfPlayText(match, close)}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
