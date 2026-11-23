/**
 * When sending saved scoring changes fails while the phone thinks it is online (weak signal,
 * ground Wi-Fi with no internet, an expired sign-in being renewed), try again by itself:
 * 3s, 6s, 12s, 24s, 48s, then every 60s. Nothing is ever dropped while waiting.
 */
export function retryDelayMs(attempt: number): number {
  const safe = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  return Math.min(60_000, 3_000 * 2 ** Math.min(safe, 5));
}

/** Plain-language line for the scorer's sync chip. */
export function syncChipLabel(input: { status: string; pending: number; online: boolean }): string {
  const waiting = input.pending > 0 ? `${input.pending} ${input.pending === 1 ? "change" : "changes"} to send` : "";
  if (input.status === "conflict") return "Needs review";
  if (!input.online || input.status === "offline") return waiting ? `Offline · saved on phone · ${waiting}` : "Offline · saved on phone";
  if (input.status === "error") return waiting ? `Retrying · ${waiting}` : "Can't reach cloud";
  if (input.status === "connecting") return waiting ? `Sending · ${waiting}` : "Connecting";
  if (input.pending > 0 || input.status === "queued") return waiting ? `Sending · ${waiting}` : "Sending";
  if (input.status === "synced") return "All sent";
  return "Saved on phone";
}
