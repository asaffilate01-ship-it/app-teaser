import { pakistanPrices } from "./pricing.ts";

export type PakistanPaidPlan = "club" | "league";

export type SubscriptionLine = {
  label: string;
  teams: number;
  rate: number;
  amount: number;
};

/** A published-price estimate only; never a payable invoice or an entitlement. */
export function pakistanSubscriptionEstimate(
  plan: PakistanPaidPlan,
  teamCount: string,
  video: boolean,
) {
  const raw = teamCount.trim();
  if (!/^\d+$/.test(raw)) return null;
  const teams = Number(raw);
  if (!Number.isSafeInteger(teams) || teams < 1 || teams > 10_000) return null;
  if (plan !== "club" && plan !== "league") return null;

  const lines: SubscriptionLine[] = [];
  const add = (label: string, count: number, rate: number) => {
    if (count > 0) lines.push({ label, teams: count, rate, amount: count * rate });
  };
  if (plan === "club") {
    add("Club plan", teams, pakistanPrices.clubPerTeam);
  } else {
    let previous = 0;
    for (const band of pakistanPrices.leagueBands) {
      const count = Math.min(teams, band.upTo) - previous;
      if (count <= 0) break;
      const label = Number.isFinite(band.upTo)
        ? `League teams ${previous + 1}–${Math.min(teams, band.upTo)}`
        : `League teams ${previous + 1}–${teams}`;
      add(label, count, band.perTeam);
      previous += count;
    }
  }
  if (video) {
    add(
      "Video add-on",
      teams,
      plan === "club" ? pakistanPrices.clubVideoPerTeam : pakistanPrices.leagueVideoPerTeam,
    );
  }
  return {
    plan,
    teams,
    video,
    currency: "PKR" as const,
    period: "year" as const,
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
  };
}
