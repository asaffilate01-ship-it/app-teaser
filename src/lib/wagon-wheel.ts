import { deliveryRuns, type Innings } from "./cricket.ts";
import { normalizeAnalysisZone, type DeliveryEvidence, type Discipline } from "./analysis.ts";
import { groundZones } from "./analysis-ground.ts";
import { uniqueCurrent } from "./spatial-analysis.ts";
export const battingCrease = { x: 0, z: 8.5 };
export type WagonShot = {
  id: string;
  zone: string;
  x: number;
  z: number;
  color: string;
  fielding: boolean;
};
/** Recorded zone centres only: no inferred distance, angle, flight height or handedness. */
export function wagonWheelShots(rows: DeliveryEvidence[], discipline: Discipline): WagonShot[] {
  return uniqueCurrent(rows).flatMap((row) => {
    const zone = groundZones.find(
      (z) =>
        normalizeAnalysisZone(z.name) ===
        normalizeAnalysisZone(discipline === "fielding" ? row.fielding_zone : row.shot_zone),
    );
    return zone
      ? [
          {
            id: row.id,
            zone: zone.name,
            x: zone.x,
            z: zone.z,
            fielding: discipline === "fielding",
            color: row.wicket
              ? "#fb7185"
              : row.batter_runs === 6
                ? "#c084fc"
                : row.batter_runs === 4
                  ? "#fbbf24"
                  : "#5eead4",
          },
        ]
      : [];
  });
}

export function scorerWagonEvidence(innings: Innings): DeliveryEvidence[] {
  return innings.deliveries.map((ball) => ({
    id: ball.id,
    innings_id: innings.id,
    sequence: ball.sequence,
    over_number: ball.over,
    ball_in_over: ball.ball,
    striker_id: ball.strikerId,
    bowler_id: ball.bowlerId,
    fielder_id: ball.fielderId ?? null,
    delivery_style: ball.deliveryStyle,
    outcome: ball.outcome,
    batter_runs: ball.batterRuns,
    total_runs: deliveryRuns(ball),
    legal_ball: ball.legal,
    wicket: !!ball.dismissal,
    shot_zone: ball.fieldZone,
    fielding_zone: ball.fieldZone,
    superseded_by: null,
  }));
}
