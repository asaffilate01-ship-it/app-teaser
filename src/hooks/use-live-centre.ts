import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getCloudClient, isCloudConfigured } from "@/lib/cloud";
import {
  defaultLiveAlertPrefs,
  liveEventsBetween,
  parseLiveAlertPrefs,
  shouldAlert,
  type LiveAlertKind,
  type LiveAlertPrefs,
  type LiveEvent,
  type LiveMatch,
} from "@/lib/live-centre";

const FOLLOW_KEY = "criclume.live.following.v1";
const PREFS_KEY = "criclume.live.alerts.v1";
const VISIBLE_POLL_MS = 15_000;
const HIDDEN_POLL_MS = 45_000;

/** When one poll brings several moments for a match, the card shows the biggest one. */
const flashPriority: Record<LiveAlertKind, number> = { result: 7, wicket: 6, stoppage: 5, six: 4, innings: 3, milestone: 2, four: 1, start: 0 };

export interface FeedEvent extends LiveEvent {
  at: number;
}

function readFollowing(): Set<string> {
  try {
    const value = JSON.parse(window.localStorage.getItem(FOLLOW_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 200) : []);
  } catch {
    return new Set();
  }
}

/** Polls the public match list, works out new moments and raises toasts / browser notifications. */
export function useLiveCentre(onOpen: (slug: string) => void) {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "unavailable">(isCloudConfigured() ? "loading" : "unavailable");
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [flash, setFlash] = useState<Record<string, LiveAlertKind>>({});
  const [following, setFollowing] = useState<Set<string>>(() => new Set());
  const [prefs, setPrefsState] = useState<LiveAlertPrefs>(defaultLiveAlertPrefs);
  const previous = useRef<Map<string, LiveMatch> | null>(null);
  const announced = useRef(new Set<string>());
  const prefsRef = useRef(prefs);
  const followingRef = useRef(following);
  const openRef = useRef(onOpen);
  prefsRef.current = prefs;
  followingRef.current = following;
  openRef.current = onOpen;

  useEffect(() => {
    setFollowing(readFollowing());
    try {
      setPrefsState(parseLiveAlertPrefs(window.localStorage.getItem(PREFS_KEY)));
    } catch {
      // Private browsing: keep the defaults for this visit.
    }
  }, []);

  const announce = useCallback((events: LiveEvent[]) => {
    const fresh = events.filter((event) => !announced.current.has(event.key));
    if (fresh.length === 0) return;
    const now = Date.now();
    for (const event of fresh) announced.current.add(event.key);
    setFeed((items) => [...fresh.map((event) => ({ ...event, at: now })).reverse(), ...items].slice(0, 40));
    setFlash((items) => {
      const next = { ...items };
      for (const event of fresh) {
        const current = next[event.slug];
        if (!current || flashPriority[event.kind] >= flashPriority[current]) next[event.slug] = event.kind;
      }
      return next;
    });
    window.setTimeout(() => {
      setFlash((items) => {
        const next = { ...items };
        for (const event of fresh) if (next[event.slug] === event.kind) delete next[event.slug];
        return next;
      });
    }, 5_000);

    const wanted = fresh.filter((event) => shouldAlert(event, prefsRef.current, followingRef.current)).slice(0, 3);
    for (const event of wanted) {
      if (prefsRef.current.browser && document.hidden && "Notification" in window && Notification.permission === "granted") {
        try {
          const note = new Notification(event.title, { body: event.body, tag: event.key, icon: "/favicon.png" });
          note.onclick = () => {
            window.focus();
            openRef.current(event.slug);
          };
        } catch {
          // Some phones only allow notifications from an installed app.
        }
      } else {
        toast(event.title, {
          description: event.body,
          duration: event.kind === "result" || event.kind === "stoppage" ? 9_000 : 5_000,
          action: { label: "Open", onClick: () => openRef.current(event.slug) },
        });
      }
    }
  }, []);

  const load = useCallback(async () => {
    if (!isCloudConfigured()) return;
    const { data, error } = await getCloudClient().rpc("list_public_live_matches");
    if (error) {
      setStatus((current) => (current === "ready" ? "ready" : "error"));
      return;
    }
    const next = (Array.isArray(data) ? data : []) as unknown as LiveMatch[];
    const before = previous.current;
    if (before) {
      const events: LiveEvent[] = [];
      for (const match of next) {
        const old = before.get(match.slug);
        if (old && old.updatedAt !== match.updatedAt) events.push(...liveEventsBetween(old, match));
      }
      announce(events);
    }
    previous.current = new Map(next.map((match) => [match.slug, match]));
    setMatches(next);
    setLoadedAt(Date.now());
    setStatus("ready");
  }, [announce]);

  useEffect(() => {
    if (!isCloudConfigured()) return;
    let timer = 0;
    let active = true;
    const tick = async () => {
      await load();
      if (!active) return;
      timer = window.setTimeout(() => void tick(), document.hidden ? HIDDEN_POLL_MS : VISIBLE_POLL_MS);
    };
    const onVisible = () => {
      if (document.hidden) return;
      window.clearTimeout(timer);
      void tick();
    };
    void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const toggleFollow = useCallback((slug: string) => {
    setFollowing((items) => {
      const next = new Set(items);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      try {
        window.localStorage.setItem(FOLLOW_KEY, JSON.stringify([...next]));
      } catch {
        // Following still works for this visit.
      }
      return next;
    });
  }, []);

  const setPrefs = useCallback((next: LiveAlertPrefs) => {
    setPrefsState(next);
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // Keep the choice for this visit only.
    }
  }, []);

  return { matches, status, loadedAt, feed, flash, following, toggleFollow, prefs, setPrefs, refresh: load };
}
