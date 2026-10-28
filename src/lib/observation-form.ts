export type ObservationErrors = Partial<Record<"note" | "time" | "source" | "delivery", string>>;

/** Local guidance only; the database remains authoritative for access and source validity. */
export function observationErrors(input: {
  note: string;
  time: string;
  sourceKind?: string | undefined;
  staleSource: boolean;
  staleDelivery: boolean;
}): ObservationErrors {
  const errors: ObservationErrors = {};
  if (input.note.trim().length < 3 || input.note.length > 3000)
    errors.note =
      "Enter an observation of 3 to 3000 characters, excluding leading and trailing spaces from the minimum.";
  if (input.staleDelivery) errors.delivery = "Choose a current delivery or Whole match.";
  if (input.staleSource) errors.source = "Choose an available source or No source linked.";
  if (
    input.time !== "" &&
    (input.sourceKind !== "video" || !/^\d+$/.test(input.time) || Number(input.time) > 86400)
  )
    errors.time = "Enter a whole number of seconds from 0 to 86400 for a video source.";
  return errors;
}
