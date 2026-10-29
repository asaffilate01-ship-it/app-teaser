import { isCurrentDelivery, type DeliveryEvidence, type Discipline } from "./analysis.ts";

// Schematic reference positions, not measured player or ball coordinates.
export const groundZones = [
  { name: "Fine leg", x: -21, z: 27 },
  { name: "Square leg", x: -34, z: 7 },
  { name: "Mid-wicket", x: -29, z: -16 },
  { name: "Long on", x: -17, z: -32 },
  { name: "Straight", x: 0, z: -38 },
  { name: "Long off", x: 17, z: -32 },
  { name: "Cover", x: 29, z: -16 },
  { name: "Point", x: 34, z: 7 },
  { name: "Third", x: 21, z: 27 },
  { name: "Keeper", x: 0, z: 24 },
  { name: "Bowler", x: 0, z: -18 },
] as const;
export type GroundMetric = "deliveries" | "runs" | "wickets";
export type GroundZone = {
  name: string;
  x: number;
  z: number;
  deliveries: number;
  runs: number;
  wickets: number;
};
export function summarizeGround(rows: DeliveryEvidence[], discipline: Discipline) {
  const zones: GroundZone[] = groundZones.map((zone) => ({
    ...zone,
    deliveries: 0,
    runs: 0,
    wickets: 0,
  }));
  let unmapped = 0;
  for (const row of rows.filter(isCurrentDelivery)) {
    const name = (discipline === "fielding" ? row.fielding_zone : row.shot_zone)
      ?.trim()
      .toLowerCase();
    const zone = zones.find((zone) => zone.name.toLowerCase() === name);
    if (!zone) {
      unmapped++;
      continue;
    }
    zone.deliveries++;
    zone.runs += discipline === "batting" ? row.batter_runs : row.total_runs;
    zone.wickets += Number(row.wicket);
  }
  return { zones, unmapped, mapped: zones.reduce((sum, zone) => sum + zone.deliveries, 0) };
}
