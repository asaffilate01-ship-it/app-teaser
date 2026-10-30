import { summarizeGround } from "./analysis-ground.ts";
import { summarizeBowlingPlacement, bowlingLines, bowlingLengths } from "./bowling-placement.ts";
import {
  filterDeliveries,
  summarizeDeliveries,
  isCurrentDelivery,
  type AnalysisFilters,
  type DeliveryEvidence,
} from "./analysis.ts";
import {
  coachingKeys,
  coachingLabels,
  coachingLabel,
  emptyCoachingFields,
  filterObservations,
  observationState,
  type CoachingAnnotation,
  type ObservationHistory,
} from "./coaching.ts";
type ReportNote = CoachingAnnotation & {
  id: string;
  note: string;
  tags: string;
  created_at: string;
  evidence_file_id: string | null;
  evidence_time_seconds: number | null;
};
export type ReviewReportInput = {
  organisationId: string;
  matchId: string;
  loadedAt: string;
  generatedAt: string;
  filters: AnalysisFilters;
  history: ObservationHistory;
  search: string;
  deliveries: DeliveryEvidence[];
  notes: ReportNote[];
  mediaIds: Set<string>;
};
export function reviewSnapshot(input: ReviewReportInput) {
  const rows = filterDeliveries(input.deliveries, input.filters, input.mediaIds, input.notes);
  const currentIds = new Set(input.deliveries.filter(isCurrentDelivery).map((d) => d.id));
  const notes = filterObservations(
    input.notes,
    input.filters.discipline,
    input.filters.coaching ?? emptyCoachingFields,
    input.search,
    input.history,
    currentIds,
    new Set(rows.map((d) => d.id)),
  );
  return {
    rows,
    summary: summarizeDeliveries(rows),
    ground: summarizeGround(rows, input.filters.discipline),
    bowling:
      input.filters.discipline === "bowling" ? summarizeBowlingPlacement(rows, input.notes) : null,
    notes: notes.map((n) => ({ ...n, deliveryState: observationState(n.delivery_id, currentIds) })),
  };
}
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
const timestamp = (value: string) =>
  Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : "Not recorded";
const labels: Record<string, string> = {
  deliveries: "Deliveries",
  batterRuns: "Batter runs",
  teamRuns: "Team runs",
  legalBalls: "Legal balls",
  wicketEvents: "Wicket events",
  boundaries: "Boundaries",
};
/** Standalone local report: no scripts, embedded media, signed URLs or external resources. */
export function reviewReportHtml(input: ReviewReportInput): string {
  const snapshot = reviewSnapshot(input);
  const criteria: Array<[string, string]> = [
    ["Discipline", input.filters.discipline],
    ["Player reference", input.filters.player || "All"],
    ["Batter reference", input.filters.batter || "All"],
    ["Bowler reference", input.filters.bowler || "All"],
    ["Fielder reference", input.filters.fielder || "All"],
    ["Innings reference", input.filters.innings || "All"],
    ["Bowling style", input.filters.style || "All"],
    ["Zone", input.filters.zone || "All"],
    ["Outcome", input.filters.outcome || "All"],
    ["From over (0-based)", input.filters.fromOver || "Start"],
    ["To over (0-based)", input.filters.toOver || "End"],
    ["Linked clips only", input.filters.mediaOnly ? "Yes" : "No"],
    ["Observation history", input.history],
    ["Observation search", input.search || "None"],
    ...coachingKeys.map(
      (key) =>
        [coachingLabels[key], coachingLabel(input.filters.coaching?.[key] || "All")] as [
          string,
          string,
        ],
    ),
  ];
  const rowLimit = 250,
    noteLimit = 100;
  const metrics = Object.entries(snapshot.summary)
    .map(
      ([key, value]) =>
        `<div class="metric"><span>${escape(labels[key])}</span><strong>${escape(value)}</strong></div>`,
    )
    .join("");
  const rows = snapshot.rows
    .slice(0, rowLimit)
    .map(
      (d) =>
        `<tr><td>${escape(d.innings_id)}</td><td>${escape(d.over_number)}.${escape(d.ball_in_over)}</td><td>${escape(d.batter_runs)}</td><td>${escape(d.total_runs)}</td><td>${d.wicket ? "Wicket event" : escape(d.outcome)}</td><td>${escape(d.delivery_style || "Not recorded")}</td></tr>`,
    )
    .join("");
  const notes = snapshot.notes
    .slice(0, noteLimit)
    .map(
      (n) =>
        `<article><div class="note-meta">${escape(n.deliveryState.replaceAll("_", " "))} · ${escape(timestamp(n.created_at))}</div><p class="observation">${escape(n.note)}</p><div class="tags">${coachingKeys
          .filter((key) => n[key])
          .map(
            (key) =>
              `<span>${escape(coachingLabels[key])}: ${escape(coachingLabel(n[key]!))}</span>`,
          )
          .join(
            "",
          )}</div>${n.tags ? `<p class="muted">Tags: ${escape(n.tags)}</p>` : ""}<dl><dt>Observation reference</dt><dd>${escape(n.id)}</dd><dt>Delivery reference</dt><dd>${escape(n.delivery_id || "Whole match")}</dd><dt>Evidence reference</dt><dd>${escape(n.evidence_file_id || "No linked source / source removed")}${n.evidence_time_seconds !== null ? ` · ${escape(n.evidence_time_seconds)} seconds` : ""}</dd></dl></article>`,
    )
    .join("");
  const groundRunLabel = input.filters.discipline === "batting" ? "Batter runs" : "Team runs";
  const groundRows = snapshot.ground.zones
    .map(
      (zone) =>
        `<tr><th scope="row">${escape(zone.name)}</th><td>${zone.deliveries}</td><td>${zone.runs}</td><td>${zone.wickets}</td></tr>`,
    )
    .join("");
  const groundSection = `<section aria-labelledby="zone-heading"><h2 id="zone-heading">Recorded zone summary</h2>
<p>${snapshot.ground.mapped} of ${snapshot.ground.mapped + snapshot.ground.unmapped} matching deliveries have a recognised ${input.filters.discipline === "fielding" ? "fielding" : "shot"} zone. ${snapshot.ground.unmapped} are unmapped and excluded from this zone table, but remain in delivery statistics.</p>
<p class="muted">Same aggregates as the Match Observatory. These are recorded zone categories, not measured ball paths or player coordinates. ${input.filters.discipline === "bowling" ? "Bowling zones describe shot destinations against the selected bowling." : ""}</p>
${snapshot.ground.mapped ? `<div class="table-wrap"><table><caption>All recognised zones · ${escape(groundRunLabel.toLowerCase())}</caption><thead><tr><th scope="col">Zone</th><th scope="col">Deliveries</th><th scope="col">${groundRunLabel}</th><th scope="col">Wicket events</th></tr></thead><tbody>${groundRows}</tbody></table></div>` : "<p>No mapped zones in these filters.</p>"}</section>`;
  const bowling = snapshot.bowling;
  const bowlingSection = bowling
    ? `<section aria-labelledby="bowling-heading"><h2 id="bowling-heading">Bowling line and length</h2>
<div class="metrics"><div class="metric"><span>Classified deliveries</span><strong>${bowling.mapped} / ${bowling.total}</strong></div><div class="metric"><span>Conflicting classifications</span><strong>${bowling.conflicting.length}</strong></div><div class="metric"><span>Unclassified deliveries</span><strong>${bowling.unclassified.length}</strong></div></div>
<p class="muted">Coach-recorded categories, not measured bounce coordinates. Each delivery counts once. Agreeing duplicate notes do not increase totals; disagreements are excluded. A complete supported line-and-length pair must appear in one bowling note. Separate partial notes are not combined.</p>
<div class="table-wrap"><table class="placement"><caption>Each cell: deliveries / team runs / wicket events. Full tosses do not bounce.</caption><thead><tr><th scope="col">Length / line</th>${bowlingLines.map((line) => `<th scope="col">${escape(coachingLabel(line))}</th>`).join("")}</tr></thead><tbody>${bowlingLengths
        .map(
          (length) =>
            `<tr><th scope="row">${escape(coachingLabel(length))}${length === "full_toss" ? " (no bounce)" : ""}</th>${bowlingLines
              .map((line) => {
                const cell = bowling.cells.find(
                  (cell) => cell.line === line && cell.length === length,
                )!;
                return `<td${cell.deliveries.length ? ' class="populated"' : ""}>${cell.deliveries.length} / ${cell.runs} / ${cell.wickets}</td>`;
              })
              .join("")}</tr>`,
        )
        .join("")}</tbody></table></div>
<p class="notice">This summary uses all saved bowling classifications for the current filtered deliveries, even when observation search or history settings hide some notes below. Historical deliveries and whole-match notes do not contribute. Team runs include extras; wicket events include run-outs and are not bowler wickets. Conflicting classifications require coach review and are not included in placement totals.</p></section>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>CricLume coaching review</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f1ed;color:#241c28;font:15px/1.6 system-ui,sans-serif}main{max-width:1000px;margin:32px auto;padding:40px;background:white;border-radius:16px}header{border-bottom:4px solid #b58429;padding-bottom:24px}h1{font-size:36px;line-height:1.15;margin:10px 0;color:#5b1837}h2{margin-top:32px;font-size:22px}.kicker{font-size:12px;letter-spacing:.15em;font-weight:750;color:#775313;text-transform:uppercase}.muted,.note-meta{color:#665e6b;font-size:13px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.metric{padding:16px;border:1px solid #ddd4dd;border-radius:10px}.metric span{display:block;color:#665e6b;font-size:12px}.metric strong{font-size:28px;color:#5b1837}dl{display:grid;grid-template-columns:170px minmax(0,1fr);gap:4px 16px;font-size:12px}dt{color:#665e6b}dd{margin:0;overflow-wrap:anywhere}.filters{break-inside:avoid;background:#faf8f3;padding:16px;border-radius:10px}.table-wrap{overflow-x:auto}caption{text-align:left;font-size:12px;color:#665e6b;padding:8px 0}.placement td{white-space:nowrap}.placement .populated{background:#e3f1eb;font-weight:700}table{border-collapse:collapse;width:100%;font-size:12px}th,td{text-align:left;border-bottom:1px solid #e4dee5;padding:9px;overflow-wrap:anywhere}th{background:#f7f2f4}article{border:1px solid #ddd4dd;padding:18px;border-radius:10px;margin:14px 0;break-inside:avoid}.observation{white-space:pre-wrap;overflow-wrap:anywhere}.tags{display:flex;gap:7px;flex-wrap:wrap}.tags span{font-size:12px;background:#faf3df;border-radius:6px;padding:3px 8px}.notice{padding:14px;border-left:4px solid #b58429;background:#faf8f3}footer{border-top:1px solid #ddd4dd;margin-top:32px;padding-top:16px;font-size:12px;color:#665e6b}
@media(max-width:600px){main{margin:0;padding:20px;border-radius:0}h1{font-size:28px}.metrics{grid-template-columns:repeat(2,1fr)}dl{grid-template-columns:1fr;gap:2px}dd{margin-bottom:8px}}
@media print{section{break-inside:avoid}@page{margin:16mm}body{background:white;font-size:10pt;line-height:1.35}header{padding-bottom:14px}h1{font-size:28px}.metric{padding:10px}.metric strong{font-size:22px}.filters{padding:12px}dl{margin:8px 0}p{margin:8px 0}main{margin:0;padding:0;max-width:none}.metrics{grid-template-columns:repeat(3,1fr)}h2{break-after:avoid}.table-wrap{overflow:visible}thead{display:table-header-group}tr{break-inside:avoid}article{break-inside:avoid;padding:12px}.notice{background:white}footer{font-size:9pt}}
</style></head><body><main><header><div class="kicker">CricLume · Coaching review</div><h1>${escape(coachingLabel(input.filters.discipline))} evidence report</h1><p>Recorded cricket events and saved human observations.</p><dl><dt>Organisation reference</dt><dd>${escape(input.organisationId)}</dd><dt>Match reference</dt><dd>${escape(input.matchId)}</dd><dt>Evidence loaded (UTC)</dt><dd>${escape(timestamp(input.loadedAt))}</dd><dt>Report generated (UTC)</dt><dd>${escape(timestamp(input.generatedAt))}</dd></dl></header>
<h2>Current delivery statistics</h2><div class="metrics">${metrics}</div><p class="muted">Totals cover all ${snapshot.rows.length} matching current deliveries. Undone and replaced deliveries are excluded. Team runs include extras; wicket events include run-outs and are not bowler wickets.</p>
<h2>Review criteria</h2><div class="filters"><dl>${criteria.map(([key, value]) => `<dt>${escape(key)}</dt><dd>${escape(value)}</dd>`).join("")}</dl></div>
${groundSection}
${bowlingSection}
<h2>Delivery evidence</h2><p class="muted">Showing ${Math.min(rowLimit, snapshot.rows.length)} of ${snapshot.rows.length} matching deliveries. Use the filtered delivery CSV for the complete row-level export.</p>${snapshot.rows.length ? `<div class="table-wrap"><table><thead><tr><th>Innings reference</th><th>Ball</th><th>Batter runs</th><th>Team runs</th><th>Outcome</th><th>Style</th></tr></thead><tbody>${rows}</tbody></table></div>` : "<p>No current deliveries match these filters.</p>"}
<h2>Saved human observations</h2><p class="muted">Showing ${Math.min(noteLimit, snapshot.notes.length)} of ${snapshot.notes.length} matching observations. Use observations CSV for the full matching export. Unsaved drafts are not included.</p><p class="notice">Historical observations follow discipline, classification and text filters. Current player, innings, over and outcome filters cannot be applied to historical notes. Historical and whole-match observations do not contribute to delivery totals.</p>${notes || "<p>No saved observations match these criteria.</p>"}
<footer>Private coaching material. Share only with authorised recipients. No media or signed access links are embedded. Source references do not guarantee that a file remains available. This is a saved snapshot, not a live scorecard or AI assessment. Open this file in a browser and use Print / Save as PDF for a paper copy.</footer></main></body></html>`;
}
