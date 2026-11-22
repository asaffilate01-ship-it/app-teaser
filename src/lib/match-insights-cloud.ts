import { getCloudClient } from "@/lib/cloud";
import type { DismissalType, FieldZone } from "@/lib/cricket";
import type { InsightBall } from "@/lib/match-insights";

export interface InsightInnings {
  id: string;
  number: number;
  battingTeamId: string;
  bowlingTeamId: string;
  target: number | null;
  balls: InsightBall[];
}

const count = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

/** Loads every confirmed ball of a match the signed-in member can view, grouped by innings. */
export async function loadMatchInsights(matchId: string): Promise<InsightInnings[]> {
  const client = getCloudClient();
  const [inningsResult, deliveriesResult] = await Promise.all([
    client
      .from("innings")
      .select("id,innings_number,batting_team_id,bowling_team_id,target")
      .eq("match_id", matchId)
      .order("innings_number"),
    client
      .from("deliveries")
      .select(
        "innings_id,sequence,over_number,legal_ball,batter_runs,extras,striker_id,bowler_id,fielding_zone,dismissal",
      )
      .eq("match_id", matchId)
      .is("superseded_by", null)
      .is("voided_by_event_id", null)
      .order("sequence"),
  ]);
  if (inningsResult.error) throw new Error(inningsResult.error.message);
  if (deliveriesResult.error) throw new Error(deliveriesResult.error.message);
  const ballsByInnings = new Map<string, InsightBall[]>();
  for (const row of (deliveriesResult.data ?? []) as Record<string, unknown>[]) {
    const extras = (row["extras"] ?? {}) as Record<string, unknown>;
    const dismissal = row["dismissal"] as { type?: DismissalType } | null;
    const ball: InsightBall = {
      over: Number(row["over_number"] ?? 0),
      legal: Boolean(row["legal_ball"]),
      batterRuns: count(row["batter_runs"]),
      wide: count(extras["wide"]),
      noBall: count(extras["noBall"]),
      bye: count(extras["bye"]),
      legBye: count(extras["legBye"]),
      strikerId: String(row["striker_id"]),
      bowlerId: String(row["bowler_id"]),
      fieldZone: ((row["fielding_zone"] as FieldZone | null) ?? "Not recorded") as FieldZone,
      dismissalType: dismissal?.type ?? null,
    };
    const key = String(row["innings_id"]);
    ballsByInnings.set(key, [...(ballsByInnings.get(key) ?? []), ball]);
  }
  return ((inningsResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row["id"]),
    number: Number(row["innings_number"]),
    battingTeamId: String(row["batting_team_id"]),
    bowlingTeamId: String(row["bowling_team_id"]),
    target: row["target"] == null ? null : Number(row["target"]),
    balls: ballsByInnings.get(String(row["id"])) ?? [],
  }));
}
