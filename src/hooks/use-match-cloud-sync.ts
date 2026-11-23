import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CricketMatch } from "@/lib/cricket";
import type { ScorerSyncStatus } from "@/lib/scorer-sync-status";
import { readScorerSnapshot } from "@/lib/scorer-storage";
import { currentInnings } from "@/lib/cricket";
import { publicLiveState } from "@/lib/public-match-state";
import {
  flushPendingEvents,
  isCloudConfigured,
  queuePendingEvent,
  readPendingEvents,
  subscribeToMatchEvents,
  type PendingMatchEvent,
} from "@/lib/cloud";

function getDeviceId(): string {
  const key = "criclume:scoring-device-id";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
  } catch {
    // Some mobile browsers block persistent storage: scoring still works in memory.
  }
  const next = crypto.randomUUID();
  try {
    localStorage.setItem(key, next);
  } catch {
    // Do not crash the scorer if browser storage is unavailable.
  }
  return next;
}

function safeQueueCount(matchId: string): number | null {
  try {
    return readPendingEvents(matchId).length;
  } catch {
    return null;
  }
}

export function useMatchCloudSync(
  cloudMatchId: string | null,
  onRemoteMatch: (match: CricketMatch) => boolean | void,
  pausedForReview = false,
) {
  const enabled = Boolean(cloudMatchId && isCloudConfigured());
  const deviceId = useMemo(() => (typeof window === "undefined" ? "server" : getDeviceId()), []);
  const [status, setStatus] = useState<ScorerSyncStatus>(enabled ? "connecting" : "local");
  const [pendingCount, setPendingCount] = useState(0);
  const [queueUnreadable, setQueueUnreadable] = useState(false);
  const notePending = useCallback((matchId: string): number | null => {
    const count = safeQueueCount(matchId);
    if (count === null) {
      setQueueUnreadable(true);
      setStatus("error");
      return null;
    }
    setQueueUnreadable(false);
    setPendingCount(count);
    return count;
  }, []);
  const [lastSequence, setLastSequence] = useState(0);
  const latestRemoteSequence = useRef<{ matchId: string | null; sequence: number }>({
    matchId: cloudMatchId,
    sequence: 0,
  });

  useEffect(() => {
    if (!enabled || !cloudMatchId || pausedForReview) return;
    let active = true;
    if (notePending(cloudMatchId) === null) return;
    if (!navigator.onLine) setStatus("offline");
    const unsubscribe = subscribeToMatchEvents(
      cloudMatchId,
      (event) => {
        if (!active) return;
        if (latestRemoteSequence.current.matchId !== cloudMatchId) {
          latestRemoteSequence.current = { matchId: cloudMatchId, sequence: 0 };
        }
        // Ignore older realtime deliveries that could roll back the visible score.
        if (event.sequence <= latestRemoteSequence.current.sequence) return;
        latestRemoteSequence.current.sequence = event.sequence;
        setLastSequence((sequence) => Math.max(sequence, event.sequence));
        const waiting = notePending(cloudMatchId);
        if (waiting === null) return;
        const hasPending = waiting > 0;
        if (event.deviceId !== deviceId && !hasPending) {
          const snapshot = event.payload["matchSnapshot"];
          if (snapshot !== undefined && snapshot !== null) {
            const validMatch = readScorerSnapshot(snapshot, cloudMatchId);
            if (!validMatch) {
              // An incomplete remote event must not crash or replace the scorer.
              setStatus("error");
              return;
            }
            if (onRemoteMatch(validMatch) === false) {
              setStatus("conflict");
              return;
            }
          }
        }
        // Never overwrite unflushed local scoring with another device's snapshot.
        setStatus(!navigator.onLine ? "offline" : hasPending ? "queued" : "synced");
      },
      (next) => {
        if (!active) return;
        const waiting = notePending(cloudMatchId);
        if (waiting === null) return;
        setStatus(
          !navigator.onLine
            ? "offline"
            : next === "SUBSCRIBED"
              ? waiting
                ? "queued"
                : "synced"
              : "connecting",
        );
      },
    );
    const flush = () => {
      if (notePending(cloudMatchId) === null) return;
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      void flushPendingEvents(cloudMatchId)
        .then((result) => {
          if (!active) return;
          setLastSequence((sequence) => Math.max(sequence, result.lastSequence));
          setPendingCount(result.remaining);
          setStatus(!navigator.onLine ? "offline" : result.remaining ? "queued" : "synced");
        })
        .catch(() => {
          if (active && notePending(cloudMatchId) !== null) {
            setStatus(navigator.onLine ? "error" : "offline");
          }
        });
    };
    const offline = () => {
      if (notePending(cloudMatchId) !== null) setStatus("offline");
    };
    const online = () => {
      setStatus("connecting");
      flush();
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    flush();
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [cloudMatchId, deviceId, enabled, notePending, onRemoteMatch, pausedForReview]);

  const retry = useCallback(async () => {
    if (!enabled || !cloudMatchId || pausedForReview || queueUnreadable) return;
    if (notePending(cloudMatchId) === null) return;
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("connecting");
    try {
      const result = await flushPendingEvents(cloudMatchId);
      setLastSequence((sequence) => Math.max(sequence, result.lastSequence));
      setPendingCount(result.remaining);
      setStatus(!navigator.onLine ? "offline" : result.remaining ? "queued" : "synced");
    } catch {
      if (notePending(cloudMatchId) !== null) {
        setStatus(navigator.onLine ? "error" : "offline");
      }
    }
  }, [cloudMatchId, enabled, notePending, pausedForReview, queueUnreadable]);

  const publish = useCallback(
    async (match: CricketMatch, eventType: string) => {
      if (!enabled || !cloudMatchId || pausedForReview || queueUnreadable) return;
      const innings = currentInnings(match);
      const delivery = eventType === "delivery.recorded" ? innings.deliveries.at(-1) : null;
      const canonicalInningsEvent = ["delivery.recorded", "delivery.voided"].includes(eventType);
      const liveState = publicLiveState(match, { screenRefSalt: cloudMatchId });
      const event: PendingMatchEvent = {
        matchId: cloudMatchId,
        clientEventId: crypto.randomUUID(),
        deviceId,
        eventType,
        payload: {
          matchSnapshot: match,
          liveState,
          ...(canonicalInningsEvent ? { inningsId: innings.id } : {}),
          ...(delivery ? { delivery } : {}),
        },
        occurredAt: new Date().toISOString(),
      };
      try {
        // Persist before any network request: new scores must never leapfrog
        // older offline events, including a delivery whose retry is failing.
        queuePendingEvent(event);
        if (notePending(cloudMatchId) === null) return;
        if (!navigator.onLine) {
          setStatus("offline");
          return;
        }
        setStatus("connecting");
        const result = await flushPendingEvents(cloudMatchId);
        setLastSequence((sequence) => Math.max(sequence, result.lastSequence));
        setPendingCount(result.remaining);
        setStatus(!navigator.onLine ? "offline" : result.remaining ? "queued" : "synced");
      } catch {
        if (notePending(cloudMatchId) !== null) {
          setStatus(navigator.onLine ? "error" : "offline");
        }
      }
    },
    [cloudMatchId, deviceId, enabled, notePending, pausedForReview, queueUnreadable],
  );

  const visibleStatus = pausedForReview
    ? "conflict"
    : status === "synced" && pendingCount > 0
      ? "queued"
      : status;
  return {
    enabled,
    status: visibleStatus,
    lastSequence,
    pendingCount,
    queueUnreadable,
    publish,
    retry,
  };
}
