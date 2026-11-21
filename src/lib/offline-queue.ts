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

/** Preserve unknown future fields without trusting incomplete or cross-match events. */
export interface PendingScorerQueueEvent {
  matchId: string;
  clientEventId: string;
  deviceId: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

const unreadableQueueMessage =
  "Saved offline scoring changes could not be read. The original queue was preserved. " +
  "Export a match backup and ask your club administrator to review device storage.";

/**
 * Never convert malformed persisted scoring data into an empty queue.
 * Otherwise the next recorded delivery would overwrite the only remaining
 * evidence of earlier unsent scores. No repair or deletion happens here.
 */
export function parsePendingScorerQueue(
  raw: string | null,
  matchId: string,
): PendingScorerQueueEvent[] {
  if (raw === null) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(unreadableQueueMessage);
  }
  if (!Array.isArray(value)) throw new Error(unreadableQueueMessage);
  const seen = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(unreadableQueueMessage);
    }
    const event = row as Record<string, unknown>;
    if (
      event["matchId"] !== matchId ||
      typeof event["clientEventId"] !== "string" ||
      !event["clientEventId"] ||
      typeof event["deviceId"] !== "string" ||
      !event["deviceId"] ||
      typeof event["eventType"] !== "string" ||
      !event["eventType"] ||
      typeof event["occurredAt"] !== "string" ||
      !event["occurredAt"] ||
      !event["payload"] ||
      typeof event["payload"] !== "object" ||
      Array.isArray(event["payload"]) ||
      seen.has(event["clientEventId"])
    ) {
      throw new Error(unreadableQueueMessage);
    }
    seen.add(event["clientEventId"] as string);
  }
  return value as PendingScorerQueueEvent[];
}
