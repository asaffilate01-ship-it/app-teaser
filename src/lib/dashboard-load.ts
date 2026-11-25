/** Keep ID filters small enough for REST requests and page deterministic result sets. */
export const dashboardIdBatchSize = 80;
export const dashboardPageSize = 500;

/** Each loader must apply the supplied IDs, a stable order and an inclusive range. */
export async function collectDashboardRows<T>(
  ids: readonly string[],
  load: (ids: string[], from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const result: T[] = [];
  for (let offset = 0; offset < unique.length; offset += dashboardIdBatchSize) {
    const batch = unique.slice(offset, offset + dashboardIdBatchSize);
    for (let from = 0; ; from += dashboardPageSize) {
      const page = await load(batch, from, from + dashboardPageSize - 1);
      result.push(...page);
      if (page.length < dashboardPageSize) break;
    }
  }
  return result;
}

/** Accumulate a group without copying the growing array on every append. */
export function appendDashboardGroup<K, V>(groups: Map<K, V[]>, key: K, value: V): void {
  const group = groups.get(key);
  if (group) group.push(value);
  else groups.set(key, [value]);
}
