/** Keep ID filters small enough for REST requests and page deterministic result sets. */
export const dashboardIdBatchSize = 80;
export const dashboardPageSize = 500;
export const dashboardMaxPages = 20;

/** Each loader must apply the supplied IDs, a stable order and an inclusive range. */
export async function collectDashboardRows<T>(
  ids: readonly string[],
  load: (ids: string[], from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const result: T[] = [];
  for (let offset = 0; offset < unique.length; offset += dashboardIdBatchSize) {
    const batch = unique.slice(offset, offset + dashboardIdBatchSize);
    const records = await collectDashboardPages((from, to) => load(batch, from, to));
    result.push(...records);
  }
  return result;
}

/** Accumulate a group without copying the growing array on every append. */
export function appendDashboardGroup<K, V>(groups: Map<K, V[]>, key: K, value: V): void {
  const group = groups.get(key);
  if (group) group.push(value);
  else groups.set(key, [value]);
}

/** Bounded pagination with a stable, unique order supplied by the caller.
 * A full final page is followed by a single probe; never report a capped list as complete.
 */
export async function collectDashboardPages<T>(
  load: (from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  const result: T[] = [];
  for (let page = 0; page < dashboardMaxPages; page++) {
    const from = page * dashboardPageSize;
    const records = await load(from, from + dashboardPageSize - 1);
    if (records.length > dashboardPageSize) throw new Error("Invalid dashboard page size.");
    result.push(...records);
    if (records.length < dashboardPageSize) return result;
  }
  const from = dashboardMaxPages * dashboardPageSize;
  const extra = await load(from, from);
  if (extra.length > 0)
    throw new Error(
      "Workspace records exceed the dashboard safety limit. Request a scoped review.",
    );
  return result;
}

/** A missing count or failed query must not masquerade as zero visible records. */
export function requireDashboardCount(result: {
  count: number | null;
  error: { message: string } | null;
}): number {
  if (result.error) throw new Error(result.error.message);
  if (result.count === null || !Number.isSafeInteger(result.count) || result.count < 0)
    throw new Error("An exact workspace count could not be verified.");
  return result.count;
}
