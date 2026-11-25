/** Bounded review slices; they are not a full-match export. */
export const reviewClipLimit = 120;
export const reviewDeliveryLimit = 250;
export const reviewCuePageSize = 100;
export const reviewWindowMinutes = [15, 30, 60] as const;

export type ReviewWindow = { start: string; end: string };

function localMinute(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    String(date.getFullYear()).padStart(4, "0") +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
}

/** Reject impossible local dates instead of silently rolling them into another day. */
export function makeReviewWindow(start: string, minutes: number): ReviewWindow | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) return null;
  if (!reviewWindowMinutes.some((value) => value === minutes)) return null;
  const date = new Date(start);
  const time = date.getTime();
  if (!Number.isFinite(time) || localMinute(date) !== start) return null;
  return { start: date.toISOString(), end: new Date(time + minutes * 60_000).toISOString() };
}

export function validReviewWindow(window: ReviewWindow): boolean {
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    reviewWindowMinutes.some((minutes) => end - start === minutes * 60_000)
  );
}

/** Fetch one extra row to distinguish an exact-limit result from a truncated slice. */
export function boundedReviewRows<T>(rows: readonly T[], limit: number) {
  return { rows: rows.slice(0, limit), truncated: rows.length > limit };
}

export function nextCueLimit(current: number, total: number): number {
  return Math.min(total, current + reviewCuePageSize);
}
