import type { Discipline } from "./analysis";

export const coachingOptions = {
  shot_type: [
    "drive",
    "cut",
    "pull",
    "hook",
    "sweep",
    "reverse_sweep",
    "defence",
    "glance",
    "lofted",
    "other",
  ],
  bowling_line: ["outside_off", "off_stump", "middle_stump", "leg_stump", "outside_leg"],
  bowling_length: ["yorker", "full", "good", "short", "full_toss"],
  fielding_action: ["catch", "drop", "stop", "misfield", "throw", "run_out", "stumping"],
} as const;
export type CoachingKey = keyof typeof coachingOptions;
export type CoachingFields = Record<CoachingKey, string>;
export const emptyCoachingFields: CoachingFields = {
  shot_type: "",
  bowling_line: "",
  bowling_length: "",
  fielding_action: "",
};
export const coachingLabels: Record<CoachingKey, string> = {
  shot_type: "Shot type",
  bowling_line: "Bowling line",
  bowling_length: "Bowling length",
  fielding_action: "Fielding action",
};
export const coachingKeys = Object.keys(coachingOptions) as CoachingKey[];
export const coachingLabel = (value: string) => value.replaceAll("_", " ");
export type CoachingAnnotation = {
  discipline: Discipline;
  delivery_id: string | null;
} & Partial<Record<CoachingKey, string | null>>;
export function matchesCoaching(annotation: CoachingAnnotation, filters: CoachingFields): boolean {
  return coachingKeys.every((key) => !filters[key] || annotation[key] === filters[key]);
}
export function validateCoaching(fields: CoachingFields, evidenceId: string, seconds: string) {
  for (const key of coachingKeys) {
    if (fields[key] && !(coachingOptions[key] as readonly string[]).includes(fields[key]))
      throw new Error(`Choose a supported ${coachingLabels[key].toLowerCase()}.`);
  }
  if (seconds !== "" && (!evidenceId || !/^\d+$/.test(seconds) || Number(seconds) > 86400))
    throw new Error(
      "Video time must be a whole second between 0 and 86400 with a source selected.",
    );
  return {
    ...Object.fromEntries(coachingKeys.map((key) => [key, fields[key] || null])),
    evidence_file_id: evidenceId || null,
    evidence_time_seconds: seconds === "" ? null : Number(seconds),
  };
}
/** Coach-authored rows only; all cells quoted and spreadsheet formula prefixes escaped. */
export function coachingCsv(
  notes: Array<
    CoachingAnnotation & {
      id: string;
      note: string;
      tags: string;
      created_at: string;
      delivery_state?: string;
      evidence_file_id?: string | null;
      evidence_time_seconds?: number | null;
    }
  >,
) {
  const columns = [
    "id",
    "discipline",
    "delivery_id",
    "delivery_state",
    ...coachingKeys,
    "note",
    "tags",
    "evidence_file_id",
    "evidence_time_seconds",
    "created_at",
  ] as const;
  const cell = (value: unknown) =>
    '"' +
    String(value ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return [columns, ...notes.map((n) => columns.map((key) => n[key]))]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}

export type ObservationHistory = "current" | "historical" | "all";
export function observationState(deliveryId: string | null, currentIds: Set<string>) {
  return deliveryId === null
    ? "whole_match"
    : currentIds.has(deliveryId)
      ? "current"
      : "no_longer_current";
}
export function filterObservations<T extends CoachingAnnotation & { note: string; tags: string }>(
  notes: T[],
  discipline: Discipline,
  fields: CoachingFields,
  search: string,
  history: ObservationHistory,
  currentIds: Set<string>,
  filteredIds: Set<string>,
): T[] {
  return notes.filter((n) => {
    if (
      n.discipline !== discipline ||
      !matchesCoaching(n, fields) ||
      !`${n.note} ${n.tags}`.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    const historical = n.delivery_id !== null && !currentIds.has(n.delivery_id);
    if (historical) return history !== "current";
    if (history === "historical") return false;
    return n.delivery_id === null || filteredIds.has(n.delivery_id);
  });
}
