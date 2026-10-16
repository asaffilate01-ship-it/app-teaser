/**
 * Remove only acknowledged events from the latest queue snapshot.
 *
 * A replay can overlap with new deliveries being scored on the same device.
 * Replacing the queue with the old replay snapshot would silently drop those
 * new deliveries. The caller must re-read storage immediately before writing.
 */
export function reconcilePendingEvents<T extends { clientEventId: string }>(
  latestQueue: T[],
  acknowledgedClientEventIds: ReadonlySet<string>,
): T[] {
  return latestQueue.filter(
    (event) => !acknowledgedClientEventIds.has(event.clientEventId),
  );
}
