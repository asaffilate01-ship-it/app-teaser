import { useEffect, useState } from "react";
import { CloudRain } from "lucide-react";
import {
  abandonForRain,
  currentInnings,
  isSuperOver,
  liveParScore,
  matchResult,
  rainChaseInputs,
  rainMinOvers,
  summarizeInnings,
  type CricketMatch,
} from "@/lib/cricket";
import { isCalculatedMethod, rainMethods, rainMethodShort, revisedTarget, type RainMethod, type RainState } from "@/lib/rain-rules";

const wholeNumber = (value: string) => {
  const parsed = Number(value);
  return value.trim() !== "" && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

/** Rain interruptions for one-innings, limited-overs matches: shorter games, revised chase targets and par scores. */
export function RainPanel({
  match,
  onSave,
}: {
  match: CricketMatch;
  onSave: (match: CricketMatch, eventType?: string) => void;
}) {
  const allotted = match.settings.oversPerInnings;
  const bpo = match.settings.ballsPerOver;
  const applies = match.settings.inningsPerSide === 1 && allotted !== null && !match.innings.some(isSuperOver);
  const [open, setOpen] = useState(false);
  const rain = match.rain;
  const method: RainMethod = rain?.method ?? match.settings.rules?.rainMethod ?? "arr";
  const [draftMethod, setDraftMethod] = useState<RainMethod>(method);
  const [oversText, setOversText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [parText, setParText] = useState("");
  const [minText, setMinText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setDraftMethod(method);
    setOversText(rain?.revisedOvers != null ? String(rain.revisedOvers) : "");
    setTargetText(rain?.officialTarget != null ? String(rain.officialTarget) : "");
    setParText(rain?.officialPar != null ? String(rain.officialPar) : "");
    setMinText(rain?.minOversForResult != null ? String(rain.minOversForResult) : "");
  }, [method, rain?.revisedOvers, rain?.officialTarget, rain?.officialPar, rain?.minOversForResult]);

  if (!applies || allotted === null) return null;

  const firstLive = match.innings.length === 1 && match.status === "live";
  const chase = match.innings[1];
  const chaseBalls = chase ? summarizeInnings(chase, bpo).legalBalls : 0;
  const chaseRuns = chase ? summarizeInnings(chase, bpo).runs : 0;
  const firstBalls = summarizeInnings(match.innings[0]!, bpo).legalBalls;
  const inputs = rainChaseInputs(match);
  const target = rain && inputs ? revisedTarget(rain, inputs) : null;
  const par = liveParScore(match);
  const result = match.status === "completed" ? matchResult(match) : null;
  const done = match.status === "completed";

  const save = (next: CricketMatch, eventType?: string) => {
    setError("");
    onSave({ ...next, updatedAt: new Date().toISOString() }, eventType);
  };

  const reduceOvers = () => {
    const overs = wholeNumber(oversText);
    const minimum = Math.ceil(firstBalls / bpo) || 1;
    if (overs === null || overs < minimum || overs > allotted) {
      setError(`Enter whole overs between ${minimum} and ${allotted}.`);
      return;
    }
    save({ ...match, settings: { ...match.settings, oversPerInnings: overs } });
    setOversText("");
  };

  const applyChase = () => {
    const overs = oversText.trim() === "" ? null : wholeNumber(oversText);
    const minimum = Math.ceil(chaseBalls / bpo);
    if (overs !== null && (overs < Math.max(1, minimum) || overs > allotted)) {
      setError(`Chase overs must be between ${Math.max(1, minimum)} and ${allotted}.`);
      return;
    }
    if (oversText.trim() !== "" && overs === null) {
      setError("Enter whole overs for the chase.");
      return;
    }
    const official = targetText.trim() === "" ? null : wholeNumber(targetText);
    const officialPar = parText.trim() === "" ? null : wholeNumber(parText);
    if (!isCalculatedMethod(draftMethod) && (official === null || official < 1)) {
      setError("Enter the official revised target.");
      return;
    }
    const minOvers = minText.trim() === "" ? null : wholeNumber(minText);
    const next: RainState = {
      method: draftMethod,
      revisedOvers: overs,
      ...(isCalculatedMethod(draftMethod) ? {} : { officialTarget: official, officialPar }),
      ...(minOvers !== null ? { minOversForResult: minOvers } : {}),
    };
    save({ ...match, rain: next });
  };

  const abandon = () => {
    if (!window.confirm("No more play is possible? The match will be decided on the par score and closed.")) return;
    save(abandonForRain(match), "match.completed");
  };

  const summary = rain
    ? [
        rainMethodShort(rain.method),
        rain.revisedOvers != null && `chase ${rain.revisedOvers} over${rain.revisedOvers === 1 ? "" : "s"}`,
        target !== null && `target ${target}`,
        par !== null && `par ${par}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : `No interruption · ${rainMethods.find((item) => item.id === method)?.label}`;

  return (
    <section className="broadcast-panel" aria-label="Rain interruption">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-3">
          <CloudRain className="size-5 text-gold" aria-hidden="true" />
          <span>
            <span className="panel-kicker block">Rain</span>
            <span className="mt-1 block text-xs text-muted-foreground">{summary}</span>
          </span>
        </span>
        <span className="text-sm font-bold text-gold">{open ? "Close" : "Open"}</span>
      </button>

      {chase && par !== null && !done && (
        <div className="rain-par" role="status">
          <span>
            Par score <strong>{par}</strong>
          </span>
          <span className={chaseRuns > par ? "is-ahead" : chaseRuns === par ? "" : "is-behind"}>
            {chaseRuns > par ? `Ahead by ${chaseRuns - par}` : chaseRuns === par ? "Level on par" : `Behind by ${par - chaseRuns}`}
          </span>
        </div>
      )}

      {open && (
        <div className="mt-4 grid gap-4">
          {done ? (
            <p className="text-sm">{result?.text ?? "Match completed."}</p>
          ) : firstLive ? (
            <div className="grid gap-2">
              <label className="grid gap-1 text-xs font-semibold">
                Reduce overs for both sides (now {allotted})
                <input
                  className="scorer-input h-11"
                  inputMode="numeric"
                  value={oversText}
                  onChange={(event) => setOversText(event.target.value)}
                  placeholder={`e.g. ${Math.max(1, allotted - 5)}`}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                When both sides lose the same overs, the target stays the first-innings score plus one. If only the
                chase is shortened, set it here after the first innings.
              </p>
              <button type="button" className="action-secondary justify-self-start" onClick={reduceOvers}>
                Shorten the match
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold sm:col-span-2">
                Method
                <select
                  className="scorer-input h-11"
                  value={draftMethod}
                  onChange={(event) => setDraftMethod(event.target.value as RainMethod)}
                >
                  {rainMethods.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <span className="font-normal text-muted-foreground">
                  {rainMethods.find((item) => item.id === draftMethod)?.hint}
                </span>
              </label>
              <label className="grid gap-1 text-xs font-semibold">
                Overs for the chase
                <input
                  className="scorer-input h-11"
                  inputMode="numeric"
                  value={oversText}
                  onChange={(event) => setOversText(event.target.value)}
                  placeholder={String(allotted)}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold">
                Minimum overs for a result
                <input
                  className="scorer-input h-11"
                  inputMode="numeric"
                  value={minText}
                  onChange={(event) => setMinText(event.target.value)}
                  placeholder={String(rainMinOvers(match))}
                />
              </label>
              {!isCalculatedMethod(draftMethod) && (
                <>
                  <label className="grid gap-1 text-xs font-semibold">
                    Official revised target
                    <input
                      className="scorer-input h-11"
                      inputMode="numeric"
                      value={targetText}
                      onChange={(event) => setTargetText(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">
                    Official par score now (optional)
                    <input
                      className="scorer-input h-11"
                      inputMode="numeric"
                      value={parText}
                      onChange={(event) => setParText(event.target.value)}
                    />
                  </label>
                  {draftMethod === "dls" && (
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      DLS figures need a licence, so CricLume never calculates them. Copy the target and par from the
                      official DLS calculator or the umpires’ sheet.
                    </p>
                  )}
                </>
              )}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button type="button" className="action-primary" onClick={applyChase}>
                  Apply
                </button>
                {rain && (
                  <button type="button" className="action-secondary" onClick={() => save({ ...match, rain: undefined })}>
                    Clear rain
                  </button>
                )}
              </div>
            </div>
          )}
          {!done && currentInnings(match) && (
            <div className="border-t border-border pt-3">
              <button type="button" className="action-secondary" onClick={abandon}>
                No more play: decide on par
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                {chase
                  ? `The chasing side must have faced ${rainMinOvers(match)} over${rainMinOvers(match) === 1 ? "" : "s"}, or it is no result.`
                  : "Before the chase starts this is a no result."}
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
