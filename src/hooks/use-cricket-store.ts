import { useCallback, useEffect, useState } from "react";
import type { CricketMatch } from "@/lib/cricket";

const STORAGE_KEY = "criclume.matches.v1";

export function useCricketStore() {
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setMatches(JSON.parse(saved) as CricketMatch[]);
    } catch {
      // A private browser or blocked storage must not stop live scoring.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
    } catch {
      // The scorer remains usable in memory if the device has no storage quota.
    }
  }, [loaded, matches]);

  const upsertMatch = useCallback((match: CricketMatch) => {
    setMatches((current) => {
      const existing = current.findIndex((item) => item.id === match.id);
      if (existing === -1) return [match, ...current];
      return current.map((item) => (item.id === match.id ? match : item));
    });
  }, []);

  const removeMatch = useCallback((matchId: string) => {
    setMatches((current) => current.filter((match) => match.id !== matchId));
  }, []);

  return { matches, loaded, upsertMatch, removeMatch };
}
