import { useState } from "react";
import { Calculator } from "lucide-react";
import {
  pakistanSubscriptionEstimate,
  type PakistanPaidPlan,
} from "@/lib/subscription-estimate";

const pkr = (amount: number) => "PKR " + amount.toLocaleString("en-PK");

export function PakistanSubscriptionEstimate({ ownTeamCount }: { ownTeamCount: number }) {
  const [plan, setPlan] = useState<PakistanPaidPlan>("club");
  const [teams, setTeams] = useState(String(Math.max(1, ownTeamCount)));
  const [video, setVideo] = useState(false);
  const estimate = pakistanSubscriptionEstimate(plan, teams, video);
  return (
    <section className="space-y-4 rounded-xl border border-white/10 p-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <Calculator className="size-4 text-gold" aria-hidden="true" /> Pakistan annual plan estimate
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Choose the total number of teams to be covered. League prices apply progressively to each
          band, not to all teams at the lowest rate.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">
          Plan
          <select
            className="scorer-input"
            value={plan}
            onChange={(event) => setPlan(event.target.value as PakistanPaidPlan)}
          >
            <option value="club">Club</option>
            <option value="league">League</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Teams to cover
          <input
            className="scorer-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            step={1}
            value={teams}
            aria-invalid={!estimate}
            onChange={(event) => setTeams(event.target.value)}
          />
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-amber-300"
          checked={video}
          onChange={(event) => setVideo(event.target.checked)}
        />
        Include video and video analytics
      </label>
      {estimate ? (
        <div className="space-y-2" aria-live="polite">
          {estimate.lines.map((line) => (
            <div
              key={line.label}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-2 text-sm"
            >
              <div className="min-w-0">
                <p>{line.label}</p>
                <p className="text-xs text-slate-400">
                  {line.teams} × {pkr(line.rate)}
                </p>
              </div>
              <strong className="tabular-nums">{pkr(line.amount)}</strong>
            </div>
          ))}
          <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
            <span className="text-sm">Estimated annual total</span>
            <strong className="text-xl tabular-nums text-gold">{pkr(estimate.total)}</strong>
          </div>
        </div>
      ) : (
        <p role="alert" className="text-sm text-amber-200">
          Enter a whole number of teams from 1 to 10,000.
        </p>
      )}
      <p className="text-xs leading-5 text-slate-400">
        Estimate only, not an invoice or payment request. Confirm the final plan, receiving
        account, payment reference and activation with CricLume before sending money. Club member
        fee payments are separate from the CricLume platform subscription.
      </p>
    </section>
  );
}
