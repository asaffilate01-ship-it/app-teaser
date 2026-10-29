import { isCurrentDelivery, type DeliveryEvidence } from "./analysis.ts";
import { coachingOptions, type CoachingAnnotation } from "./coaching.ts";
export const bowlingLines = coachingOptions.bowling_line;
export const bowlingLengths = coachingOptions.bowling_length;
export type BowlingCell = {
  key: string;
  line: string;
  length: string;
  deliveries: DeliveryEvidence[];
  runs: number;
  wickets: number;
};
/** One classification per current delivery. Do not infer a complete pair from
 * separate partial notes or resolve disagreements by choosing the latest note. */
export function summarizeBowlingPlacement(rows: DeliveryEvidence[], notes: CoachingAnnotation[]) {
  const cells: BowlingCell[] = bowlingLengths.flatMap((length) =>
    bowlingLines.map((line) => ({
      key: `${length}:${line}`,
      line,
      length,
      deliveries: [],
      runs: 0,
      wickets: 0,
    })),
  );
  const byId = new Map<string, CoachingAnnotation[]>();
  for (const note of notes) {
    if (note.discipline !== "bowling" || !note.delivery_id) continue;
    const list = byId.get(note.delivery_id) ?? [];
    list.push(note);
    byId.set(note.delivery_id, list);
  }
  const conflicting: DeliveryEvidence[] = [],
    unclassified: DeliveryEvidence[] = [];
  const seen = new Set<string>();
  let mapped = 0;
  for (const row of rows) {
    if (!isCurrentDelivery(row) || seen.has(row.id)) continue;
    seen.add(row.id);
    const annotations = byId.get(row.id) ?? [];
    const lines = new Set(annotations.map((n) => n.bowling_line).filter(Boolean));
    const lengths = new Set(annotations.map((n) => n.bowling_length).filter(Boolean));
    if (lines.size > 1 || lengths.size > 1) {
      conflicting.push(row);
      continue;
    }
    const complete = annotations.find(
      (n) =>
        bowlingLines.includes(n.bowling_line as (typeof bowlingLines)[number]) &&
        bowlingLengths.includes(n.bowling_length as (typeof bowlingLengths)[number]),
    );
    const cell =
      complete &&
      cells.find((c) => c.line === complete.bowling_line && c.length === complete.bowling_length);
    if (!cell) {
      unclassified.push(row);
      continue;
    }
    cell.deliveries.push(row);
    cell.runs += row.total_runs;
    cell.wickets += Number(row.wicket);
    mapped++;
  }
  return { cells, conflicting, unclassified, mapped, total: seen.size };
}
