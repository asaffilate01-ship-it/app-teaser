import type { CricketMatch, StoppageReason } from "./cricket.ts";

export const stoppageReasons: ReadonlyArray<{ id: StoppageReason; label: string }> = [
  { id: "rain", label: "Rain delay" },
  { id: "bad-light", label: "Bad light" },
  { id: "wet-outfield", label: "Wet outfield" },
  { id: "other", label: "Play suspended" },
];

/** Stops play: scoring pauses and viewers see the delay until play resumes. */
export function stopPlay(
  match: CricketMatch,
  reason: StoppageReason,
  now = new Date(),
): CricketMatch {
  if (match.status !== "live" || match.stoppage) return match;
  return { ...match, stoppage: { reason, since: now.toISOString() }, updatedAt: now.toISOString() };
}

export function resumePlay(match: CricketMatch, now = new Date()): CricketMatch {
  if (!match.stoppage) return match;
  return { ...match, stoppage: null, updatedAt: now.toISOString() };
}
