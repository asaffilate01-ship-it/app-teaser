import { isCurrentDelivery, normalizeAnalysisZone, type DeliveryEvidence } from "./analysis.ts";
import { groundZones } from "./analysis-ground.ts";
import { summarizeBowlingPlacement, bowlingLines, bowlingLengths } from "./bowling-placement.ts";
import type { CoachingAnnotation } from "./coaching.ts";
export type SpatialMark = {
  id: string;
  label: string;
  x: number;
  z: number;
  height: number;
  color: number;
  shape: "ball" | "bar" | "fielder" | "shot" | "trend";
  fromX?: number;
  fromHeight?: number;
};
export type SpatialMode = "wagon" | "pitch" | "overs" | "fielders" | "worm";
export type FieldPosition = { name: string; x: number; z: number };
export const initialField: FieldPosition[] = groundZones
  .filter((z) => z.name !== "Straight")
  .map<FieldPosition>((z) => ({ name: z.name, x: z.x, z: z.z }))
  .concat([{ name: "Extra cover", x: 20, z: -8 }]);
export function uniqueCurrent(rows: DeliveryEvidence[]) {
  return [...new Map(rows.filter(isCurrentDelivery).map((row) => [row.id, row])).values()];
}
export function buildSpatialData(
  rows: DeliveryEvidence[],
  notes: CoachingAnnotation[],
  mode: SpatialMode,
  inningsIds: string[] = [],
  playerNames: ReadonlyMap<string, string> = new Map(),
) {
  const current = uniqueCurrent(rows);
  const marks: SpatialMark[] = [];
  const innings = [...new Set([...inningsIds, ...current.map((r) => r.innings_id)])];
  const bowling = summarizeBowlingPlacement(current, notes);
  const color = (row: DeliveryEvidence) =>
    row.wicket
      ? 0xfb7185
      : row.batter_runs === 6
        ? 0xc084fc
        : row.batter_runs === 4
          ? 0xfbbf24
          : 0x5eead4;
  if (mode === "wagon" || mode === "fielders") {
    for (const row of current) {
      const zone = groundZones.find(
        (z) =>
          normalizeAnalysisZone(z.name) ===
          normalizeAnalysisZone(mode === "wagon" ? row.shot_zone : row.fielding_zone),
      );
      if (!zone) continue;
      marks.push({
        id: row.id,
        label: `Innings ${innings.indexOf(row.innings_id) + 1} · ${row.over_number}.${row.ball_in_over} · ${zone.name}${mode === "fielders" ? ` · ${row.fielder_id ? (playerNames.get(row.fielder_id) ?? "Unnamed fielder") : "Fielder not recorded"}` : ""} · ${row.total_runs} runs${row.wicket ? " · wicket" : ""}`,
        x: zone.x,
        z: zone.z,
        height: 1,
        color: color(row),
        shape: mode === "wagon" ? "shot" : "fielder",
      });
    }
  } else if (mode === "pitch") {
    for (const cell of bowling.cells)
      for (const row of cell.deliveries) {
        marks.push({
          id: row.id,
          label: `Innings ${innings.indexOf(row.innings_id) + 1} · ${row.over_number}.${row.ball_in_over} · ${cell.line.replaceAll("_", " ")} / ${cell.length.replaceAll("_", " ")}${cell.length === "full_toss" ? " (no bounce)" : ""}`,
          x: (2 - bowlingLines.indexOf(cell.line as (typeof bowlingLines)[number])) * 1.3,
          z:
            cell.length === "full_toss"
              ? 8
              : 8 - bowlingLengths.indexOf(cell.length as (typeof bowlingLengths)[number]) * 4,
          height: cell.length === "full_toss" ? 2.5 : 0.55,
          color: color(row),
          shape: "ball",
        });
      }
  } else {
    const groups = new Map<string, DeliveryEvidence[]>();
    for (const row of current) {
      const key = `${row.innings_id}:${row.over_number}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const ordered = [...groups.values()].sort(
      (a, b) =>
        innings.indexOf(a[0]!.innings_id) - innings.indexOf(b[0]!.innings_id) ||
        a[0]!.over_number - b[0]!.over_number,
    );
    if (mode === "worm") {
      const totals = new Map<string, number>();
      const points = ordered.map((group) => {
        const r = group[0]!;
        const runs = (totals.get(r.innings_id) ?? 0) + group.reduce((n, d) => n + d.total_runs, 0);
        totals.set(r.innings_id, runs);
        return { innings: r.innings_id, over: r.over_number, runs };
      });
      const maxRuns = Math.max(1, ...points.map((p) => p.runs));
      const maxOver = Math.max(1, ...points.map((p) => p.over));
      const previous = new Map<string, { x: number; height: number }>();
      for (const p of points) {
        const x = -35 + (70 * p.over) / maxOver,
          height = 0.3 + (24 * p.runs) / maxRuns;
        const prev = previous.get(p.innings) ?? { x, height };
        marks.push({
          id: `worm:${p.innings}:${p.over}`,
          label: `Innings ${innings.indexOf(p.innings) + 1} · through over ${p.over} · ${p.runs} cumulative filtered runs`,
          x,
          z: innings.indexOf(p.innings) * 6 - 6,
          height,
          fromX: prev.x,
          fromHeight: prev.height,
          color: [0x5eead4, 0xc084fc, 0xfbbf24, 0x60a5fa][innings.indexOf(p.innings) % 4]!,
          shape: "trend",
        });
        previous.set(p.innings, { x, height });
      }
    } else {
      const max = Math.max(
        1,
        ...ordered.map((group) => group.reduce((n, r) => n + r.total_runs, 0)),
      );
      ordered.forEach((group, i) => {
        const r = group[0]!;
        const runs = group.reduce((n, r) => n + r.total_runs, 0);
        marks.push({
          id: `over:${r.innings_id}:${r.over_number}`,
          label: `Innings ${innings.indexOf(r.innings_id) + 1} · over ${r.over_number} · ${runs} runs · ${group.filter((r) => r.legal_ball).length} legal balls · ${group.filter((r) => r.wicket).length} wicket events`,
          x: ordered.length === 1 ? 0 : -35 + (70 * i) / (ordered.length - 1),
          z: 0,
          height: Math.max(0.15, (20 * runs) / max),
          color: group.some((r) => r.wicket) ? 0xfb7185 : 0x5eead4,
          shape: "bar",
        });
      });
    }
  }
  return {
    marks,
    total: current.length,
    excluded: mode === "overs" || mode === "worm" ? 0 : current.length - marks.length,
    conflicting: bowling.conflicting.length,
  };
}
