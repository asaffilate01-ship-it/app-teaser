/** Pure helpers for the club's ad earnings view. */
export interface PromoEarningRow {
  campaign_id: string;
  advertiser: string;
  campaign_name: string;
  currency: string;
  club_plays: number;
  share_percent: number;
  estimated_earnings: number;
}

export type EarningsPeriod = "month" | "lastMonth" | "year";

const iso = (date: Date) => date.toISOString().slice(0, 10);

/** First and last day (inclusive, UTC) of the chosen period. */
export function periodRange(
  period: EarningsPeriod,
  now = new Date(),
): { from: string; to: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (period === "year")
    return { from: iso(new Date(Date.UTC(y, 0, 1))), to: iso(new Date(Date.UTC(y, 11, 31))) };
  const offset = period === "lastMonth" ? -1 : 0;
  return {
    from: iso(new Date(Date.UTC(y, m + offset, 1))),
    to: iso(new Date(Date.UTC(y, m + offset + 1, 0))),
  };
}

/** Totals per currency (campaigns can be sold in different currencies). */
export function totalsByCurrency(
  rows: PromoEarningRow[],
): Array<{ currency: string; amount: number; plays: number }> {
  const map = new Map<string, { amount: number; plays: number }>();
  for (const row of rows) {
    const entry = map.get(row.currency) ?? { amount: 0, plays: 0 };
    entry.amount += Number(row.estimated_earnings) || 0;
    entry.plays += Number(row.club_plays) || 0;
    map.set(row.currency, entry);
  }
  return [...map.entries()]
    .map(([currency, value]) => ({
      currency,
      amount: Math.round(value.amount * 100) / 100,
      plays: value.plays,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
