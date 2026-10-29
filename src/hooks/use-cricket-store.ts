import { useCallback, useEffect, useRef, useState } from "react";
import type { CricketMatch } from "@/lib/cricket";
import { parseScorerMatches, scorerStorageKey } from "@/lib/scorer-storage";

export function useCricketStore() {
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageIssue, setStorageIssue] = useState<string | null>(null);
  const [recoveryData, setRecoveryData] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const mayWrite = useRef(false);
  useEffect(() => {
    mayWrite.current = false;
    try {
      const raw = window.localStorage.getItem(scorerStorageKey);
      if (raw !== null) {
        try {
          setMatches(parseScorerMatches(raw));
        } catch {
          setRecoveryData(raw);
          setStorageIssue(
            "Saved match data could not be read. It has been preserved. New scoring changes stay in memory; download both backups before closing this page.",
          );
          return;
        }
      }
      mayWrite.current = true;
    } catch {
      setStorageIssue(
        "Device storage could not be read. Existing data will not be overwritten. New scoring changes stay in memory; download a backup before closing this page.",
      );
    } finally {
      setLoaded(true);
    }
  }, []);
  const persist = useCallback(() => {
    if (!loaded || !mayWrite.current) return;
    try {
      window.localStorage.setItem(scorerStorageKey, JSON.stringify(matches));
      setStorageIssue(null);
      setSaved(true);
      setDirty(false);
    } catch {
      setSaved(false);
      setStorageIssue(
        "Changes could not be saved on this device. Keep this page open, download a backup, or retry saving after freeing browser storage.",
      );
    }
  }, [loaded, matches]);
  useEffect(() => {
    persist();
  }, [persist]);
  useEffect(() => {
    if (!storageIssue || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [storageIssue, dirty]);
  const upsertMatch = useCallback((match: CricketMatch) => {
    setSaved(false);
    setDirty(true);
    setMatches((current) =>
      current.some((item) => item.id === match.id)
        ? current.map((item) => (item.id === match.id ? match : item))
        : [match, ...current],
    );
  }, []);
  const importMatches = useCallback((incoming: CricketMatch[]) => {
    setSaved(false);
    setDirty(true);
    setMatches((current) => [...incoming, ...current]);
  }, []);
  const removeMatch = useCallback((matchId: string) => {
    setSaved(false);
    setDirty(true);
    setMatches((current) => current.filter((match) => match.id !== matchId));
  }, []);
  return {
    matches,
    loaded,
    upsertMatch,
    removeMatch,
    importMatches,
    storageIssue,
    recoveryData,
    saved,
    retrySave: persist,
    canRetrySave: mayWrite.current,
  };
}
