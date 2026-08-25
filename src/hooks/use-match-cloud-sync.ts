import { useCallback, useEffect, useMemo, useState } from "react";
import type { CricketMatch } from "@/lib/cricket";
import {
  currentInnings,
  findPlayer,
  findTeam,
  summarizeInnings,
  targetForCurrentInnings,
} from "@/lib/cricket";
import {
  appendMatchEvent,
  flushPendingEvents,
  isCloudConfigured,
  queuePendingEvent,
  subscribeToMatchEvents,
  type PendingMatchEvent,
} from "@/lib/cloud";

type SyncStatus = "local" | "connecting" | "synced" | "queued" | "error";

function getDeviceId(): string {
  const key = "criclume:scoring-device-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}

function publicLiveState(match: CricketMatch): Record<string, unknown> {
  const innings = currentInnings(match);
  const summary = summarizeInnings(innings);
  const striker = findPlayer(match, innings.strikerId);
  const nonStriker = findPlayer(match, innings.nonStrikerId);
  const bowler = findPlayer(match, innings.bowlerId);
  const batting = findTeam(match, innings.battingTeamId);
  const target = targetForCurrentInnings(match);
  return {
    battingTeamId: batting?.id,
    runs: summary.runs,
    wickets: summary.wickets,
    overs: summary.overs,
    target,
    striker: striker ? { name: striker.name, runs: 0, balls: 0 } : null,
    nonStriker: nonStriker ? { name: nonStriker.name, runs: 0, balls: 0 } : null,
    bowler: bowler ? { name: bowler.name, wickets: 0, runs: 0, overs: "0.0" } : null,
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

  useEffect(() => {
    if (!enabled || !cloudMatchId) return;
    const unsubscribe = subscribeToMatchEvents(
      cloudMatchId,
      (event) => {
        setLastSequence((sequence) => Math.max(sequence, event.sequence));
        if (event.deviceId !== deviceId) {
          const snapshot = event.payload["matchSnapshot"];
          if (snapshot && typeof snapshot === "object") onRemoteMatch(snapshot as CricketMatch);
        }
        setStatus("synced");
      },
      (next) => setStatus(next === "SUBSCRIBED" ? "synced" : "connecting"),
    );
    const flush = () => {
      void flushPendingEvents(cloudMatchId).then((result) =>
        setStatus(result.remaining ? "queued" : "synced"),
      );
    };
    window.addEventListener("online", flush);
    flush();
    return () => {
      unsubscribe();
      window.removeEventListener("online", flush);
    };
  }, [cloudMatchId, deviceId, enabled, onRemoteMatch]);

  const publish = useCallback(
    async (match: CricketMatch, eventType: string) => {
      if (!enabled || !cloudMatchId) return;
      const event: PendingMatchEvent = {
        matchId: cloudMatchId,
        clientEventId: crypto.randomUUID(),
        deviceId,
        eventType,
        payload: { matchSnapshot: match, liveState: publicLiveState(match) },
        occurredAt: new Date().toISOString(),
      };
      if (!navigator.onLine) {
        queuePendingEvent(event);
        setStatus("queued");
        return;
      }
      setStatus("connecting");
      try {
        const saved = await appendMatchEvent(event);
        setLastSequence(saved.sequence);
        setStatus("synced");
      } catch {
        setStatus("queued");
      }
    },
    [cloudMatchId, deviceId, enabled],
  );

  return { enabled, status, lastSequence, publish };
}
