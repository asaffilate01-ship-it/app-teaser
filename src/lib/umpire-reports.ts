/** Umpire match records (decisions given) and assessments — pure helpers, shared by the umpire and manager screens. */

export const decisionKinds = [
  "lbw",
  "caught",
  "run_out",
  "stumped",
  "bowled",
  "wide",
  "no_ball",
  "other",
] as const;
export type DecisionKind = (typeof decisionKinds)[number];
export const decisionLabels: Record<DecisionKind, string> = {
  lbw: "LBW",
  caught: "Caught",
  run_out: "Run out",
  stumped: "Stumped",
  bowled: "Bowled",
  wide: "Wide",
  no_ball: "No-ball",
  other: "Other",
};

export interface UmpireDecision {
  kind: DecisionKind;
  given: boolean;
  over?: string;
  note?: string;
}

/** Reads saved decisions defensively (older or hand-edited rows are skipped). */
export function readDecisions(value: unknown): UmpireDecision[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const kind = decisionKinds.find((k) => k === row["kind"]);
    if (!kind) return [];
    return [
      {
        kind,
        given: row["given"] === true,
        ...(typeof row["over"] === "string" && row["over"] ? { over: row["over"] } : {}),
        ...(typeof row["note"] === "string" && row["note"] ? { note: row["note"] } : {}),
      },
    ];
  });
}

export function decisionSummary(decisions: UmpireDecision[]) {
  const appeals = decisions.filter((d) => !["wide", "no_ball"].includes(d.kind));
  const given = appeals.filter((d) => d.given).length;
  return {
    appeals: appeals.length,
    given,
    notGiven: appeals.length - given,
    lbwGiven: appeals.filter((d) => d.kind === "lbw" && d.given).length,
    lbwAppeals: appeals.filter((d) => d.kind === "lbw").length,
    wides: decisions.filter((d) => d.kind === "wide").length,
    noBalls: decisions.filter((d) => d.kind === "no_ball").length,
  };
}

/** Assessment criteria, each marked 1–5 by an assessor. */
export const assessmentCriteria = [
  ["decisions", "Decision making"],
  ["positioning", "Positioning"],
  ["signals", "Signals & communication"],
  ["management", "Match & player management"],
  ["laws", "Knowledge of the laws"],
] as const;
export type AssessmentScores = Partial<Record<(typeof assessmentCriteria)[number][0], number>>;

/** Overall score out of 100 = average of the criteria that were marked (each 1–5), scaled; 0 if none. */
export function overallPercent(scores: AssessmentScores): number {
  const marks = Object.values(scores).filter(
    (v): v is number => typeof v === "number" && v >= 1 && v <= 5,
  );
  if (!marks.length) return 0;
  return Math.round((marks.reduce((a, b) => a + b, 0) / marks.length) * 20);
}

/** Captains' marks average and count (captains mark umpires out of 5). */
export function averageMark(marks: { mark: number }[]): { average: number | null; count: number } {
  const valid = marks.filter((m) => Number.isFinite(m.mark));
  if (!valid.length) return { average: null, count: 0 };
  return {
    average: Math.round((valid.reduce((a, m) => a + m.mark, 0) / valid.length) * 10) / 10,
    count: valid.length,
  };
}
