export type Discipline = "batting" | "bowling" | "fielding";
export type DeliveryEvidence = {
  id: string;
  innings_id: string;
  sequence: number;
  over_number: number;
  ball_in_over: number;
  striker_id: string;
  bowler_id: string;
  fielder_id: string | null;
  delivery_style: string | null;
  outcome: string;
  batter_runs: number;
  total_runs: number;
  legal_ball: boolean;
  wicket: boolean;
  shot_zone: string | null;
  fielding_zone: string | null;
  superseded_by: string | null;
};
export type AnalysisFilters = {
  discipline: Discipline;
  player: string;
  innings: string;
  style: string;
  zone: string;
  outcome: string;
  fromOver: string;
  toOver: string;
  mediaOnly: boolean;
};
export const defaultAnalysisFilters: AnalysisFilters = {
  discipline: "batting",
  player: "",
  innings: "",
  style: "",
  zone: "",
  outcome: "",
  fromOver: "",
  toOver: "",
  mediaOnly: false,
};
export function filterDeliveries(
  rows: DeliveryEvidence[],
  f: AnalysisFilters,
  media: Set<string> = new Set(),
) {
  return rows.filter(
    (d) =>
      !d.superseded_by &&
      (!f.player ||
        (f.discipline === "batting"
          ? d.striker_id
          : f.discipline === "bowling"
            ? d.bowler_id
            : d.fielder_id) === f.player) &&
      (!f.innings || d.innings_id === f.innings) &&
      (!f.style || d.delivery_style === f.style) &&
      (!f.zone || (f.discipline === "fielding" ? d.fielding_zone : d.shot_zone) === f.zone) &&
      (!f.outcome ||
        (f.outcome === "wickets"
          ? d.wicket
          : f.outcome === "boundaries"
            ? [4, 6].includes(d.batter_runs)
            : f.outcome === "dots"
              ? d.total_runs === 0
              : d.outcome === f.outcome)) &&
      (f.fromOver === "" || d.over_number >= Number(f.fromOver)) &&
      (f.toOver === "" || d.over_number <= Number(f.toOver)) &&
      (!f.mediaOnly || media.has(d.id)),
  );
}
export function summarizeDeliveries(rows: DeliveryEvidence[]) {
  return rows.reduce(
    (s, d) => ({
      deliveries: s.deliveries + 1,
      batterRuns: s.batterRuns + d.batter_runs,
      teamRuns: s.teamRuns + d.total_runs,
      legalBalls: s.legalBalls + Number(d.legal_ball),
      wicketEvents: s.wicketEvents + Number(d.wicket),
      boundaries: s.boundaries + Number([4, 6].includes(d.batter_runs)),
    }),
    { deliveries: 0, batterRuns: 0, teamRuns: 0, legalBalls: 0, wicketEvents: 0, boundaries: 0 },
  );
}
/** Safe spreadsheet export: never allow an untrusted cell to become a formula. */
export function deliveryCsv(rows: DeliveryEvidence[]) {
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return [
    [
      "innings",
      "over",
      "ball",
      "batter_runs",
      "team_runs",
      "legal_ball",
      "wicket",
      "style",
      "shot_zone",
      "fielding_zone",
    ],
    ...rows.map((d) => [
      d.innings_id,
      d.over_number,
      d.ball_in_over,
      d.batter_runs,
      d.total_runs,
      d.legal_ball,
      d.wicket,
      d.delivery_style,
      d.shot_zone,
      d.fielding_zone,
    ]),
  ]
    .map((r) => r.map(cell).join(","))
    .join("\r\n");
}
