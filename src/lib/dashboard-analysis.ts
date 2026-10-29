import type { DeliveryEvidence } from "./analysis.ts";
import { uniqueCurrent } from "./spatial-analysis.ts";
export function dashboardAnalysis(rows: DeliveryEvidence[], inningsIds: string[] = []) {
  const current = uniqueCurrent(rows);
  const innings = [...new Set([...inningsIds, ...current.map((r) => r.innings_id)])];
  const series = innings
    .map((id, index) => {
      const overs = new Map<number, DeliveryEvidence[]>();
      for (const r of current.filter((r) => r.innings_id === id))
        overs.set(r.over_number, [...(overs.get(r.over_number) ?? []), r]);
      let runs = 0,
        balls = 0;
      return {
        id,
        label: `Innings ${index + 1}`,
        points: [...overs]
          .sort(([a], [b]) => a - b)
          .map(([over, deliveries]) => {
            runs += deliveries.reduce((n, r) => n + r.total_runs, 0);
            balls += deliveries.filter((r) => r.legal_ball).length;
            return { over, runs, balls, rate: balls ? (6 * runs) / balls : null };
          }),
      };
    })
    .filter((s) => s.points.length);
  const leaders = (kind: "batting" | "bowling" | "fielding") => {
    const players = new Map<string, { id: string; deliveries: number; runs: number }>();
    for (const r of current) {
      const id =
        kind === "batting" ? r.striker_id : kind === "bowling" ? r.bowler_id : r.fielder_id;
      if (!id) continue;
      const p = players.get(id) ?? { id, deliveries: 0, runs: 0 };
      p.deliveries++;
      p.runs += kind === "batting" ? r.batter_runs : r.total_runs;
      players.set(id, p);
    }
    return [...players.values()]
      .sort((a, b) => (kind === "batting" ? b.runs - a.runs : b.deliveries - a.deliveries))
      .slice(0, 3);
  };
  return {
    series,
    batters: leaders("batting"),
    bowlers: leaders("bowling"),
    fielders: leaders("fielding"),
  };
}
export type RateSeries = ReturnType<typeof dashboardAnalysis>["series"];
