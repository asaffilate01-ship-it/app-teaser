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


export function useMatchCloudSync(
  cloudMatchId: string | null,
  onRemoteMatch: (match: CricketMatch) => boolean | void,
  pausedForReview = false,
) {
  const enabled = Boolean(cloudMatchId && isCloudConfigured());
  const deviceId = useMemo(() => (typeof window === "undefined" ? "server" : getDeviceId()), []);
  const [status, setStatus] = useState<ScorerSyncStatus>(enabled ? "connecting" : "local");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSequence, setLastSequence] = useState(0);
  const latestRemoteSequence = useRef<{ matchId: string | null; sequence: number }>({
    matchId: cloudMatchId,
    sequence: 0,
  });

  useEffect(() => {
    if (!enabled || !cloudMatchId || pausedForReview) return;
    let active = true;
    setPendingCount(readPendingEvents(cloudMatchId).length);
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
        const waiting = readPendingEvents(cloudMatchId).length;
        const hasPending = waiting > 0;
        setPendingCount(waiting);
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
        const waiting = readPendingEvents(cloudMatchId).length;
        setPendingCount(waiting);
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
      if (!navigator.onLine) {
        setPendingCount(readPendingEvents(cloudMatchId).length);
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
          if (active) {
            setPendingCount(readPendingEvents(cloudMatchId).length);
            setStatus(navigator.onLine ? "error" : "offline");
          }
        });
    };
    const offline = () => {
      setPendingCount(readPendingEvents(cloudMatchId).length);
      setStatus("offline");
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
  }, [cloudMatchId, deviceId, enabled, onRemoteMatch, pausedForReview]);

  const retry = useCallback(async () => {
    if (!enabled || !cloudMatchId || pausedForReview) return;
    if (!navigator.onLine) {
      setStatus("offline");
      setPendingCount(readPendingEvents(cloudMatchId).length);
      return;
    }
    setStatus("connecting");
    try {
      const result = await flushPendingEvents(cloudMatchId);
      setLastSequence((sequence) => Math.max(sequence, result.lastSequence));
      setPendingCount(result.remaining);
      setStatus(!navigator.onLine ? "offline" : result.remaining ? "queued" : "synced");
    } catch {
      setPendingCount(readPendingEvents(cloudMatchId).length);
      setStatus(navigator.onLine ? "error" : "offline");
    }
  }, [cloudMatchId, enabled, pausedForReview]);

  const publish = useCallback(
    async (match: CricketMatch, eventType: string) => {
      if (!enabled || !cloudMatchId || pausedForReview) return;
      const innings = currentInnings(match);
      const delivery = eventType === "delivery.recorded" ? innings.deliveries.at(-1) : null;
      const canonicalInningsEvent = ["delivery.recorded", "delivery.voided"].includes(eventType);
      const liveState = publicLiveState(match);
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
        setPendingCount(readPendingEvents(cloudMatchId).length);
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
        setPendingCount(readPendingEvents(cloudMatchId).length);
        setStatus(navigator.onLine ? "error" : "offline");
      }
    },
    [cloudMatchId, deviceId, enabled, pausedForReview],
  );

  const visibleStatus = pausedForReview
    ? "conflict"
    : status === "synced" && pendingCount > 0
      ? "queued"
      : status;
  return { enabled, status: visibleStatus, lastSequence, pendingCount, publish, retry };
}
