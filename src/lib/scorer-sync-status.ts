export type ScorerSyncStatus =
  "local" | "connecting" | "synced" | "queued" | "offline" | "conflict" | "error";

export type ScorerSyncRecovery = {
  show: boolean;
  title: string;
  detail: string;
  canRetry: boolean;
};

/**
 * Present only what is known. An HTTP/Realtime connection is not proof that
 * every on-device event was accepted by the cloud.
 */
export function describeScorerSyncRecovery(
  status: ScorerSyncStatus,
  pendingEvents: number,
  queueUnreadable = false,
): ScorerSyncRecovery {
  const pending = Number.isSafeInteger(pendingEvents) && pendingEvents > 0 ? pendingEvents : 0;
  const count = `${pending} scoring ${pending === 1 ? "change" : "changes"}`;
  if (queueUnreadable) {
    return {
      show: true,
      title: "Saved offline scoring queue needs recovery",
      detail:
        "The saved queue cannot be read. Original storage was not cleared. " +
        "Export a match backup and ask a club administrator to recover unsent deliveries.",
      canRetry: false,
    };
  }
  if (status === "conflict") {
    return {
      show: false,
      title: "Scorer versions need review",
      detail: "Only a lead-scorer reconciliation can resolve this conflict.",
      canRetry: false,
    };
  }
  if (status === "offline") {
    return {
      show: true,
      title: "Offline — keep scoring, it's saved on this phone",
      detail: pending
        ? `${count} waiting to sync. They'll be sent in order as soon as you're back online, even if you close and reopen the scorer.`
        : "Everything so far reached the cloud. New balls are saved on this phone and sent when you're back online.",
      canRetry: false,
    };
  }
  if (status === "error") {
    return {
      show: true,
      title: pending ? "Not sent yet — trying again automatically" : "Cloud sync needs attention",
      detail: pending
        ? `${count} waiting to sync. They're kept on this phone and sent in order when the signal holds. You can keep scoring or tap Retry.`
        : "Cloud status could not be verified. Check the score and export a backup.",
      canRetry: pending > 0,
    };
  }
  if (status === "queued" || pending > 0) {
    return {
      show: true,
      title: "Scoring changes awaiting upload",
      detail: pending
        ? `${count} not yet confirmed by the cloud. Your on-device queue is retained.`
        : "Cloud delivery acknowledgement is pending. Check the connection before leaving.",
      canRetry: pending > 0,
    };
  }
  return { show: false, title: "", detail: "", canRetry: false };
}
