export interface CloudCameraEligibility {
  matchStatus: string;
  roomStatus: string;
  localArmed: boolean;
  consentConfirmed: boolean;
  autoEnabled: boolean;
  adultOnlyAttested: boolean;
}

export type CloudStopCause =
  "match_not_live" | "room_closed" | "consent_withdrawn" | "auto_opt_out" | "duration_limit";

export const activeCloudStates = ["starting", "recording", "stopping"] as const;

export function canAutomaticallyStartCamera(
  input: CloudCameraEligibility & { publisherPresent: boolean },
): boolean {
  return (
    input.matchStatus === "live" &&
    input.roomStatus === "open" &&
    input.localArmed &&
    input.consentConfirmed &&
    input.autoEnabled &&
    input.adultOnlyAttested &&
    input.publisherPresent
  );
}

export function automaticCloudStopCause(
  input: CloudCameraEligibility & {
    source: "director" | "match_state";
    startedAt: string;
    nowMs: number;
    maxDurationMinutes: number;
  },
): CloudStopCause | null {
  if (input.matchStatus !== "live") return "match_not_live";
  if (input.roomStatus !== "open") return "room_closed";
  if (!input.localArmed || !input.consentConfirmed) return "consent_withdrawn";
  if (input.source === "match_state" && (!input.autoEnabled || !input.adultOnlyAttested))
    return "auto_opt_out";

  // An unparseable or missing start timestamp also fails closed.
  const started = Date.parse(input.startedAt);
  if (!Number.isFinite(started)) return "duration_limit";
  const max = Math.max(1, Math.min(240, Math.floor(input.maxDurationMinutes)));
  if (!Number.isFinite(input.nowMs) || input.nowMs - started >= max * 60_000)
    return "duration_limit";
  return null;
}

export function cloudAutoQuota(value: string | undefined): number {
  if (!value || !/^[0-9]+$/.test(value)) return 4;
  const count = Number(value);
  return Number.isSafeInteger(count) ? Math.max(1, Math.min(8, count)) : 4;
}

export function cloudAutoDuration(value: string | undefined): number {
  if (!value || !/^[0-9]+$/.test(value)) return 120;
  const minutes = Number(value);
  return Number.isSafeInteger(minutes) ? Math.max(5, Math.min(240, minutes)) : 120;
}
