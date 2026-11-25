import { useMemo, useState } from "react";
import { Gauge } from "lucide-react";
import { currentInnings, findPlayer, findTeam, type CricketMatch } from "@/lib/cricket";
import { bowlingSpeedInsights, latestDeliverySpeed } from "@/lib/match-speed-insights";

function speed(value: number | null) {
  return value === null ? "—" : value.toFixed(1);
}

/** Private scorer view only. Do not reuse in public scoreboard responses. */
export function LatestSpeedEstimate({ match }: { match: CricketMatch }) {
  const latest = latestDeliverySpeed(currentInnings(match).deliveries);
  if (!latest) return null;
  const { delivery, evidence } = latest;
  return (
    <aside
      aria-label="Last delivery video speed estimate"
      className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 md:mx-0"
    >
      <div className="flex min-w-0 items-start gap-2">
        <Gauge className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold">Last delivery · video estimate</p>
          <p className="text-xs text-muted-foreground">
            Over {delivery.over}.{delivery.ball} ·{" "}
            {findPlayer(match, delivery.bowlerId)?.name ?? "Bowler"}
          </p>
        </div>
      </div>
      <div className="text-right">
        <strong className="font-display text-xl tabular-nums">{speed(evidence.kph)} km/h</strong>
        <p className="text-xs tabular-nums text-muted-foreground">
          Timing/distance range {speed(evidence.lowKph)}–{speed(evidence.highKph)}
        </p>
      </div>
      <p className="w-full text-xs text-muted-foreground">
        Reviewed segment-average estimate, not radar-certified release speed.
      </p>
    </aside>
  );
}

export function SpeedInsightsPanel({ match }: { match: CricketMatch }) {
  const [selected, setSelected] = useState("");
  const current = currentInnings(match);
  const innings = match.innings.find((item) => item.id === selected) ?? current;
  const insights = useMemo(() => bowlingSpeedInsights(innings.deliveries), [innings.deliveries]);
  return (
    <section className="broadcast-panel space-y-4 p-4 md:p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="panel-kicker flex items-center gap-2">
            <Gauge className="size-4" aria-hidden="true" /> Bowling speed insights
          </h2>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            Only saved video estimates with consistent calculation evidence contribute to these
            figures. Small or selective samples may not represent the bowler's usual speed.
          </p>
        </div>
        <label className="grid w-full gap-1 text-xs sm:w-auto">
          Innings
          <select
            className="scorer-input"
            value={selected && innings.id === selected ? selected : ""}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">Current innings</option>
            {match.innings.map((item) => (
              <option key={item.id} value={item.id}>
                {item.kind === "super-over" ? "Super Over" : "Innings " + item.number} ·{" "}
                {findTeam(match, item.bowlingTeamId).name} bowling
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Reviewed estimates", String(insights.reviewed)],
          ["Recorded entries", String(insights.deliveries)],
          ["Legacy readings", String(insights.legacy)],
          ["Inconsistent readings", String(insights.invalid)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <strong className="font-display text-xl tabular-nums">{value}</strong>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <div className="flex flex-wrap justify-between gap-2 text-xs">
          <span>Reviewed measurement coverage</span>
          <strong className="tabular-nums">{insights.coveragePercent.toFixed(1)}%</strong>
        </div>
        <progress
          className="h-2 w-full accent-amber-400"
          aria-label="Reviewed measurement coverage"
          value={insights.reviewed}
          max={Math.max(1, insights.deliveries)}
        />
        <p className="text-xs text-muted-foreground">
          Coverage counts all recorded delivery entries, including wides and no-balls. It measures
          completeness, not accuracy.
        </p>
      </div>

      {insights.reviewed === 0 && (
        <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
          No reviewed speed estimates for this innings. Use the video speed tool to save a
          measurement with its calculation details.
        </p>
      )}

      {insights.bowlers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">By bowler</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {insights.bowlers.map((bowler) => (
              <div key={bowler.bowlerId} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {findPlayer(match, bowler.bowlerId)?.name ?? "Unassigned bowler"}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {bowler.reviewed}/{bowler.deliveries} reviewed
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Average</p>
                    <strong className="tabular-nums">{speed(bowler.average)}</strong>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fastest</p>
                    <strong className="tabular-nums">{speed(bowler.fastest)}</strong>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Slowest</p>
                    <strong className="tabular-nums">{speed(bowler.slowest)}</strong>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  km/h · {bowler.legacy} legacy · {bowler.invalid} inconsistent · {bowler.missing}{" "}
                  unmeasured
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.recent.length > 0 && (
        <details className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Recent reviewed estimates ({insights.recent.length})
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {insights.recent.map(({ delivery, evidence }) => (
              <div key={delivery.id} className="border-t border-border pt-2 text-xs">
                <p className="font-semibold">
                  Over {delivery.over}.{delivery.ball} ·{" "}
                  {findPlayer(match, delivery.bowlerId)?.name ?? "Bowler"}
                </p>
                <p className="tabular-nums">
                  {speed(evidence.kph)} km/h · {speed(evidence.lowKph)}–{speed(evidence.highKph)}
                </p>
                <p className="text-muted-foreground">
                  {evidence.distanceMetres} m · {evidence.mediaFps} fps ·{" "}
                  {evidence.method === "manual" ? "Manual timing" : "Reviewed motion"}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
      <p className="text-xs text-muted-foreground">
        Private coaching estimates only. Timing and distance bounds omit perspective, blur and
        calibration bias. No public speed publication or score changes are performed here.
      </p>
    </section>
  );
}
