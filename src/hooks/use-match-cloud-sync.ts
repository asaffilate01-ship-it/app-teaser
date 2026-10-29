import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CricketMatch } from "@/lib/cricket";
import {
  battingCard,
  bowlingCard,
  currentInnings,
  findPlayer,
  findTeam,
  summarizeInnings,
  targetForCurrentInnings,
} from "@/lib/cricket";
import {
  flushPendingEvents,
  isCloudConfigured,
  queuePendingEvent,
  readPendingEvents,
  subscribeToMatchEvents,
  type PendingMatchEvent,
} from "@/lib/cloud";

type SyncStatus = "local" | "connecting" | "synced" | "queued" | "error";

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

function publicLiveState(match: CricketMatch): Record<string, unknown> {
  const innings = currentInnings(match);
  const summary = summarizeInnings(innings, match.settings.ballsPerOver);
  const striker = findPlayer(match, innings.strikerId);
  const nonStriker = findPlayer(match, innings.nonStrikerId);
  const bowler = findPlayer(match, innings.bowlerId);
  const batters = battingCard(match, innings);
  const bowlers = bowlingCard(match, innings);
  const strikerFigures = batters.find((row) => row.playerId === striker?.id);
  const nonStrikerFigures = batters.find((row) => row.playerId === nonStriker?.id);
  const bowlerFigures = bowlers.find((row) => row.playerId === bowler?.id);
  const batting = findTeam(match, innings.battingTeamId);
  const target = targetForCurrentInnings(match);
  return {
    battingTeamId: batting?.id,
    runs: summary.runs,
    wickets: summary.wickets,
    overs: summary.overs,
    target,
    striker: striker
      ? { name: striker.name, runs: strikerFigures?.runs ?? 0, balls: strikerFigures?.balls ?? 0 }
      : null,
    nonStriker: nonStriker
      ? {
          name: nonStriker.name,
          runs: nonStrikerFigures?.runs ?? 0,
          balls: nonStrikerFigures?.balls ?? 0,
        }
      : null,
    bowler: bowler
      ? {
          name: bowler.name,
          wickets: bowlerFigures?.wickets ?? 0,
          runs: bowlerFigures?.runs ?? 0,
          overs: bowlerFigures?.overs ?? "0.0",
        }
      : null,
    recent: innings.deliveries.slice(-6).map((delivery) => ({
      label: delivery.dismissal
        ? "W"
        : delivery.batterRuns > 0
          ? String(delivery.batterRuns)
          : delivery.extras?.wide
            ? "Wd"
            : delivery.extras?.noBall
              ? "Nb"
              : "·",
      kind: delivery.dismissal ? "wicket" : delivery.batterRuns >= 4 ? "boundary" : "normal",
    })),
    message:
      match.status === "completed"
        ? "Match completed"
        : `${batting?.name ?? "Batting side"} innings in progress`,
  };
}

export function useMatchCloudSync(
  cloudMatchId: string | null,
  onRemoteMatch: (match: CricketMatch) => void,
) {
  const enabled = Boolean(cloudMatchId && isCloudConfigured());
  const deviceId = useMemo(() => (typeof window === "undefined" ? "server" : getDeviceId()), []);
  const [status, setStatus] = useState<SyncStatus>(enabled ? "connecting" : "local");
  const [lastSequence, setLastSequence] = useState(0);
  const latestRemoteSequence = useRef<{ matchId: string | null; sequence: number }>({
    matchId: cloudMatchId,
    sequence: 0,
  });

  useEffect(() => {
    if (!enabled || !cloudMatchId) return;
    let active = true;
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
        const hasPending = readPendingEvents(cloudMatchId).length > 0;
        if (event.deviceId !== deviceId && !hasPending) {
          const snapshot = event.payload["matchSnapshot"];
          if (snapshot && typeof snapshot === "object") onRemoteMatch(snapshot as CricketMatch);
        }
        // Never overwrite unflushed local scoring with another device's snapshot.
        setStatus(hasPending ? "queued" : "synced");
      },
      (next) =>
        active &&
        setStatus(
          next === "SUBSCRIBED"
            ? readPendingEvents(cloudMatchId).length
              ? "queued"
              : "synced"
            : "connecting",
        ),
    );
    const flush = () => {
      void flushPendingEvents(cloudMatchId)
        .then((result) => {
          if (!active) return;
          setLastSequence((sequence) => Math.max(sequence, result.lastSequence));
          setStatus(result.remaining ? "queued" : "synced");
        })
        .catch(() => {
          if (active) setStatus("error");
        });
    };
    window.addEventListener("online", flush);
    flush();
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("online", flush);
    };
  }, [cloudMatchId, deviceId, enabled, onRemoteMatch]);

  const publish = useCallback(
    async (match: CricketMatch, eventType: string) => {
      if (!enabled || !cloudMatchId) return;
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
        if (!navigator.onLine) {
          setStatus("queued");
          return;
        }
        setStatus("connecting");
        const result = await flushPendingEvents(cloudMatchId);
        setLastSequence((sequence) => Math.max(sequence, result.lastSequence));
        setStatus(result.remaining ? "queued" : "synced");
      } catch {
        setStatus("error");
      }
    },
    [cloudMatchId, deviceId, enabled],
  );

  return { enabled, status, lastSequence, publish };
}
