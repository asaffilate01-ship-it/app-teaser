import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { formatMoney, periodRange, totalsByCurrency, type EarningsPeriod, type PromoEarningRow } from "@/lib/promo-earnings";
import { Empty, OfficeCard, type OfficeProps } from "./ui";

const periods: Array<[EarningsPeriod, string]> = [
  ["month", "This month"],
  ["lastMonth", "Last month"],
  ["year", "This year"],
];
const financeRoles = new Set(["owner", "club_admin", "league_admin", "treasurer"]);

/** The club's share of CricLume ad money from its own screens (estimated until the campaign ends). */
export function AdEarningsPanel({ organisationId, role }: Pick<OfficeProps, "organisationId" | "role">) {
  const allowed = financeRoles.has(role);
  const [period, setPeriod] = useState<EarningsPeriod>("month");
  const [rows, setRows] = useState<PromoEarningRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setRows(null);
    setError(null);
    const { from, to } = periodRange(period);
    void getCloudClient()
      .rpc("club_promo_earnings", { p_organisation_id: organisationId, p_from: from, p_to: to })
      .then(({ data, error: failure }) => {
        if (!active) return;
        if (failure) setError("Ad earnings could not load. Try again shortly.");
        else setRows((data ?? []) as PromoEarningRow[]);
      });
    return () => {
      active = false;
    };
  }, [allowed, organisationId, period]);

  if (!allowed) {
    return (
      <OfficeCard title="Ad earnings">
        <Empty>Only the club owner, admins and treasurer can see ad earnings.</Empty>
      </OfficeCard>
    );
  }

  const totals = rows ? totalsByCurrency(rows) : [];
  return (
    <div className="space-y-4">
      <OfficeCard
        title="Ad earnings"
        description="CricLume sells the top and side banners on your big screen, public scoreboard and app. Your club earns a share of the ad money from your own screens."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="office-stat">
            <span className="office-meta">Free plan</span>
            <strong>0%</strong>
          </div>
          <div className="office-stat">
            <span className="office-meta">Club or League plan</span>
            <strong>30%</strong>
          </div>
          <div className="office-stat">
            <span className="office-meta">Paid plan + video add-on</span>
            <strong>50%</strong>
          </div>
        </div>
      </OfficeCard>

      <OfficeCard
        title="Your share"
        description="Estimated from how often each ad ran on your screens. CricLume confirms the final amount when a campaign ends."
        action={
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Period">
            {periods.map(([value, label]) => (
              <button key={value} type="button" className="office-choice px-3 text-xs font-bold" aria-pressed={period === value} onClick={() => setPeriod(value)}>
                {label}
              </button>
            ))}
          </div>
        }
      >
        {error && <p className="office-meta">{error}</p>}
        {!rows && !error && (
          <p className="office-meta flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" /> Loading…
          </p>
        )}
        {rows && rows.length === 0 && <Empty>No ads have run on your screens in this period yet.</Empty>}
        {rows && rows.length > 0 && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              {totals.map((total) => (
                <div key={total.currency} className="office-stat">
                  <span className="office-meta">{total.plays.toLocaleString()} plays</span>
                  <strong>{formatMoney(total.amount, total.currency)}</strong>
                </div>
              ))}
            </div>
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.campaign_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold">{row.advertiser}</p>
                    <p className="office-meta">
                      {row.campaign_name} · {Number(row.club_plays).toLocaleString()} plays · {row.share_percent}% share
                    </p>
                  </div>
                  <strong>{formatMoney(Number(row.estimated_earnings), row.currency)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </OfficeCard>
    </div>
  );
}
