import { useCallback, useEffect, useState } from "react";
import { fetchMyMatchDuties, fetchScoringTeam } from "@/lib/cloud";
import { isScoringDuty, type ScoringDuty, type ScoringTeamMember } from "@/lib/scoring-duties";

const everything: ScoringDuty[] = ["lead", "batting", "bowling", "video"];

function cacheKey(matchId: string, userId: string) {
  return `criclume:duties:${matchId}:${userId}`;
}

function readCache(matchId: string, userId: string): { duties: ScoringDuty[]; team: ScoringTeamMember[] } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(cacheKey(matchId, userId)) ?? "null") as unknown;
    if (!raw || typeof raw !== "object") return null;
    const value = raw as { duties?: unknown; team?: unknown };
    if (!Array.isArray(value.duties)) return null;
    return {
      duties: value.duties.filter(isScoringDuty),
      team: Array.isArray(value.team) ? (value.team as ScoringTeamMember[]) : [],
    };
  } catch {
    return null;
  }
}

/** Duties saved on this phone from the last check (null if never checked here). */
export function cachedDuties(matchId: string, userId: string): ScoringDuty[] | null {
  return readCache(matchId, userId)?.duties ?? null;
}

/**
 * This person's duties for a cloud match, kept on the phone so the right screen shows offline.
 * The server checks every change again, so this only shapes the screen.
 */
export function useMatchDuties(cloudMatchId: string | null, userId: string | null) {
  const [duties, setDuties] = useState<ScoringDuty[] | null>(cloudMatchId ? null : everything);
  const [team, setTeam] = useState<ScoringTeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!cloudMatchId || !userId || !navigator.onLine) return;
    try {
      const mine = await fetchMyMatchDuties(cloudMatchId);
      const members = mine.length ? await fetchScoringTeam(cloudMatchId) : [];
      setDuties(mine);
      setTeam(members);
      setError(null);
      try {
        localStorage.setItem(cacheKey(cloudMatchId, userId), JSON.stringify({ duties: mine, team: members }));
      } catch {
        /* storage full or blocked: the screen still works */
      }
    } catch {
      setError("Couldn't check your scoring duties. Using the last ones saved on this phone.");
    }
  }, [cloudMatchId, userId]);

  useEffect(() => {
    if (!cloudMatchId) {
      setDuties(everything);
      return;
    }
    if (!userId) return;
    const cached = readCache(cloudMatchId, userId);
    if (cached) {
      setDuties(cached.duties);
      setTeam(cached.team);
    }
    void refresh();
    // Duties can be changed by the club during the match: check again now and then.
    const timer = window.setInterval(() => void refresh(), 60_000);
    const visible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", visible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", visible);
    };
  }, [cloudMatchId, userId, refresh]);

  return {
    /** null while the first check is running with nothing saved yet. */
    duties,
    team,
    error,
    refresh,
  };
}
