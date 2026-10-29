import { useCallback, useEffect, useRef, useState } from "react";
import type { CricketMatch } from "@/lib/cricket";
import {
  parseScorerMatches,
  scorerStorageKey,
  scorerWriteLock,
  commitScorerSnapshot,
} from "@/lib/scorer-storage";

export function useCricketStore() {
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageIssue, setStorageIssue] = useState<string | null>(null);
  const [recoveryData, setRecoveryData] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const mayWrite = useRef(false);
  const baseline = useRef<string | null>(null);
  const generation = useRef(0);
  const [storageConflict, setStorageConflict] = useState(false);
  const blockConflict = useCallback((current: string | null) => {
    generation.current += 1;
    mayWrite.current = false;
    setSaved(false);
    setStorageConflict(true);
    setDirty(true);
    setRecoveryData(current ?? "[]");
    setStorageIssue(
      "Device match data changed in another tab or was cleared. This tab has stopped saving to avoid overwriting it. Download current matches and preserved device data, then reload to use the latest device version.",
    );
  }, []);
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
      baseline.current = raw;
      mayWrite.current = true;
      setSaved(true);
    } catch {
      setStorageIssue(
        "Device storage could not be read. Existing data will not be overwritten. New scoring changes stay in memory; download a backup before closing this page.",
      );
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    const checkExternal = (event: StorageEvent) => {
      if (event.key !== null && event.key !== scorerStorageKey) return;
      try {
        if (event.storageArea !== window.localStorage) return;
        // Read the live value rather than an older queued event payload.
        const current = window.localStorage.getItem(scorerStorageKey);
        if (mayWrite.current && current !== baseline.current) blockConflict(current);
        else if (storageConflict) setRecoveryData(current ?? "[]");
      } catch {
        generation.current += 1;
        mayWrite.current = false;
        setSaved(false);
        setStorageIssue(
          "Device storage can no longer be read. Saving is paused to protect existing data. Download current matches before reloading.",
        );
      }
    };
    window.addEventListener("storage", checkExternal);
    return () => {
      generation.current += 1;
      window.removeEventListener("storage", checkExternal);
    };
  }, [blockConflict, storageConflict]);
  const persist = useCallback(async () => {
    if (!loaded || !dirty || !mayWrite.current) return;
    const request = ++generation.current;
    if (!navigator.locks?.request) {
      mayWrite.current = false;
      setStorageIssue(
        "This browser cannot coordinate device saves between tabs. Changes stay in memory. Download a backup and use a supported browser over HTTPS to save safely.",
      );
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      await navigator.locks.request(scorerWriteLock, { signal: controller.signal }, () => {
        if (request !== generation.current || !mayWrite.current) return;
        const next = JSON.stringify(matches);
        const result = commitScorerSnapshot(window.localStorage, baseline.current, next);
        if (!result.saved) {
          blockConflict(result.current);
          return;
        }
        baseline.current = next;
        setStorageIssue(null);
        setSaved(true);
        setDirty(false);
      });
    } catch {
      if (request !== generation.current) return;
      setSaved(false);
      setStorageIssue(
        "Changes could not be saved on this device. Keep this page open, download a backup, or retry saving after freeing browser storage or closing another busy scorer tab.",
      );
    } finally {
      window.clearTimeout(timeout);
    }
  }, [loaded, dirty, matches, blockConflict]);
  useEffect(() => {
    void persist();
  }, [persist]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const upsertMatch = useCallback((match: CricketMatch) => {
    generation.current += 1;
    setSaved(false);
    setDirty(true);
    setMatches((current) =>
      current.some((item) => item.id === match.id)
        ? current.map((item) => (item.id === match.id ? match : item))
        : [match, ...current],
    );
  }, []);
  const importMatches = useCallback((incoming: CricketMatch[]) => {
    generation.current += 1;
    setSaved(false);
    setDirty(true);
    setMatches((current) => [...incoming, ...current]);
  }, []);
  const removeMatch = useCallback((matchId: string) => {
    generation.current += 1;
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
    storageConflict,
    recoveryData,
    saved,
    retrySave: persist,
    canRetrySave: mayWrite.current,
  };
}
