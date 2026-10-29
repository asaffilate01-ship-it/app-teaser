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
  return latestQueue.filter((event) => !acknowledgedClientEventIds.has(event.clientEventId));
}

export interface QueueDrainResult {
  sent: number;
  remaining: number;
  lastSequence: number;
}

/** One drain per match in this browser context. Re-read after every acknowledgement
 * so events scored during a request join the same ordered drain. */
export function createOrderedQueueDrainer<T extends { clientEventId: string }>(io: {
  read: (matchId: string) => T[];
  write: (matchId: string, events: T[]) => void;
  send: (event: T) => Promise<{ sequence: number }>;
}) {
  const active = new Map<string, Promise<QueueDrainResult>>();
  return (matchId: string): Promise<QueueDrainResult> => {
    const existing = active.get(matchId);
    if (existing) return existing;
    const operation = Promise.resolve()
      .then(async () => {
        let sent = 0;
        let lastSequence = 0;
        for (;;) {
          const event = io.read(matchId)[0];
          if (!event) return { sent, remaining: 0, lastSequence };
          let receipt: { sequence: number };
          try {
            receipt = await io.send(event);
          } catch {
            return { sent, remaining: io.read(matchId).length, lastSequence };
          }
          // A storage failure must stop replay too: retain the event ID so an
          // ambiguous acknowledgement can be retried through server idempotency.
          io.write(
            matchId,
            reconcilePendingEvents(io.read(matchId), new Set([event.clientEventId])),
          );
          sent += 1;
          lastSequence = Math.max(lastSequence, receipt.sequence);
        }
      })
      .finally(() => active.delete(matchId));
    active.set(matchId, operation);
    return operation;
  };
}
