import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CricketMatch } from "@/lib/cricket";
import type { ScorerSyncStatus } from "@/lib/scorer-sync-status";
import { readScorerSnapshot } from "@/lib/scorer-storage";
import { currentInnings } from "@/lib/cricket";
import { publicLiveState } from "@/lib/public-match-state";
import { retryDelayMs } from "@/lib/sync-retry";
import { isPatchEventType, readPatchEvent, type ScoringPatch } from "@/lib/scoring-duties";
import {
  flushPendingEvents,
  getCloudClient,
  isCloudConfigured,
  loadScoringPatches,
  scoringDeviceId,
  queuePendingEvent,
  readPendingEvents,
  subscribeToMatchEvents,
  type PendingMatchEvent,
} from "@/lib/cloud";

function safeQueueCount(matchId: string): number | null {
  try {
    return readPendingEvents(matchId).length;
  } catch {
    return null;
  }
}

/** Unsent changes that carry a whole score (balls, undo, innings) — fielding notes don't count. */
function pendingScoreChanges(matchId: string): number {
  try {
    return readPendingEvents(matchId).filter((event) => !isPatchEventType(event.eventType)).length;
  } catch {
    return 1;
  }
}

export function useMatchCloudSync(
  cloudMatchId: string | null,
  onRemoteMatch: (match: CricketMatch) => boolean | void,
  pausedForReview = false,
  /** Bowling & fielding notes from another phone (applied on top of whatever score is shown). */
  onRemotePatch?: (patch: ScoringPatch) => void,
) {
  // Callbacks change every ball; keep them in refs so the live connection isn't rebuilt each time.
  const onRemoteMatchRef = useRef(onRemoteMatch);
  onRemoteMatchRef.current = onRemoteMatch;
  const onRemotePatchRef = useRef(onRemotePatch);
  onRemotePatchRef.current = onRemotePatch;
  const enabled = Boolean(cloudMatchId && isCloudConfigured());
  const deviceId = useMemo(() => (typeof window === "undefined" ? "server" : scoringDeviceId()), []);
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
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  // Shared with publish/retry so any successful send resets the automatic resend timer.
  const kick = useRef<() => void>(() => undefined);
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
        if (isPatchEventType(event.eventType)) {
          // Fielding notes and bowler changes never replace the score, so they apply even
          // while this phone still has balls to send.
          const patch = readPatchEvent(event);
          if (patch && event.deviceId !== deviceId) onRemotePatchRef.current?.(patch);
          setStatus(!navigator.onLine ? "offline" : hasPending ? "queued" : "synced");
          return;
        }
        if (event.deviceId !== deviceId && pendingScoreChanges(cloudMatchId) === 0) {
          const snapshot = event.payload["matchSnapshot"];
          if (snapshot !== undefined && snapshot !== null) {
            const validMatch = readScorerSnapshot(snapshot, cloudMatchId);
            if (!validMatch) {
              // An incomplete remote event must not crash or replace the scorer.
              setStatus("error");
              return;
            }
            if (onRemoteMatchRef.current(validMatch) === false) {
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
        if (next === "SUBSCRIBED" && onRemotePatchRef.current) {
          // Catch up on fielding notes and bowler changes made while this phone wasn't listening.
          void loadScoringPatches(cloudMatchId, 0)
            .then((patches) => {
              if (active) patches.forEach((patch) => onRemotePatchRef.current?.(patch));
            })
            .catch(() => undefined);
        }
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
    // Automatic resend: while changes are waiting and the phone says it's online, keep trying
    // (weak signal, ground Wi-Fi without internet, sign-in being renewed). Order is kept by the queue.
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (remaining: number) => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      if (!active || remaining <= 0 || !navigator.onLine) return;
      timer = setTimeout(flush, retryDelayMs(attempt));
      attempt += 1;
    };
    function flush() {
      if (!active || notePending(cloudMatchId!) === null) return;
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      void flushPendingEvents(cloudMatchId!)
        .then((result) => {
          if (!active) return;
          setLastSequence((sequence) => Math.max(sequence, result.lastSequence));
          setPendingCount(result.remaining);
          if (result.sent > 0) {
            attempt = 0;
            setLastSentAt(Date.now());
          }
          setStatus(!navigator.onLine ? "offline" : result.remaining ? "error" : "synced");
          schedule(result.remaining);
        })
        .catch(() => {
          if (!active) return;
          const waiting = notePending(cloudMatchId!);
          if (waiting === null) return;
          setStatus(navigator.onLine ? "error" : "offline");
          schedule(waiting);
        });
    }
    kick.current = () => {
      attempt = 0;
      flush();
    };
    const offline = () => {
      if (timer) clearTimeout(timer);
      if (notePending(cloudMatchId) !== null) setStatus("offline");
    };
    const online = () => {
      setStatus("connecting");
      attempt = 0;
      flush();
    };
    const visible = () => {
      if (document.visibilityState === "visible") {
        attempt = 0;
        flush();
      }
    };
    // A renewed sign-in after a long time offline: send straight away.
    const { data: auth } = getCloudClient().auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        attempt = 0;
        flush();
      }
    });
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    // Ask the browser not to clear this phone's saved scoring when storage runs low.
    void navigator.storage?.persist?.().catch(() => undefined);
    flush();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      kick.current = () => undefined;
      auth.subscription.unsubscribe();
      unsubscribe();
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [cloudMatchId, deviceId, enabled, notePending, pausedForReview]);

  const retry = useCallback(async () => {
    if (!enabled || !cloudMatchId || pausedForReview || queueUnreadable) return;
    if (notePending(cloudMatchId) === null) return;
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("connecting");
    kick.current();
  }, [cloudMatchId, enabled, notePending, pausedForReview, queueUnreadable]);

  const publish = useCallback(
    async (match: CricketMatch, eventType: string, extraPayload: Record<string, unknown> = {}) => {
      if (!enabled || !cloudMatchId || pausedForReview || queueUnreadable) return;
      const innings = currentInnings(match);
      const delivery = eventType === "delivery.recorded" ? innings.deliveries.at(-1) : null;
      const canonicalInningsEvent = ["delivery.recorded", "delivery.voided", "delivery.corrected"].includes(eventType);
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
          ...extraPayload,
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
        kick.current();
      } catch {
        if (notePending(cloudMatchId) !== null) {
          setStatus(navigator.onLine ? "error" : "offline");
        }
      }
    },
    [cloudMatchId, deviceId, enabled, notePending, pausedForReview, queueUnreadable],
  );

  /** Bowling & fielding notes: no score snapshot, so they can never overwrite the ball scorer's work. */
  const publishPatch = useCallback(
    (eventType: "delivery.tagged" | "bowling.updated", payload: Record<string, unknown>) => {
      if (!enabled || !cloudMatchId || queueUnreadable) return;
      const event: PendingMatchEvent = {
        matchId: cloudMatchId,
        clientEventId: crypto.randomUUID(),
        deviceId,
        eventType,
        payload,
        occurredAt: new Date().toISOString(),
      };
      try {
        queuePendingEvent(event);
        if (notePending(cloudMatchId) === null) return;
        if (!navigator.onLine) {
          setStatus("offline");
          return;
        }
        setStatus("connecting");
        kick.current();
      } catch {
        if (notePending(cloudMatchId) !== null) setStatus(navigator.onLine ? "error" : "offline");
      }
    },
    [cloudMatchId, deviceId, enabled, notePending, queueUnreadable],
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
    lastSentAt,
    pendingCount,
    queueUnreadable,
    publish,
    publishPatch,
    retry,
  };
}
