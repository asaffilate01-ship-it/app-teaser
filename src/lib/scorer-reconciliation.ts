import type { CricketMatch, Delivery } from "./cricket";

export type ScorerSnapshotReview = { safe: true; reason: null } | { safe: false; reason: string };

/**
 * A received scoreboard snapshot may be ahead of the on-device copy, but it
 * must never silently erase or rewrite an already-recorded local delivery.
 *
 * This is a client-side safety check, not server-side conflict arbitration.
 * A two-device official-score handover still needs an authoritative revision
 * protocol and end-to-end testing before it can be considered complete.
 */
export function reviewRemoteScorerSnapshot(
  local: CricketMatch,
  remote: CricketMatch,
): ScorerSnapshotReview {
  const reject = (reason: string): ScorerSnapshotReview => ({ safe: false, reason });
  if (local.id !== remote.id) return reject("The incoming score belongs to a different match.");
  if (JSON.stringify(local.settings) !== JSON.stringify(remote.settings)) {
    return reject("The match rules or setup differ between this device and the cloud.");
  }
  if (local.status === "completed" && remote.status !== "completed") {
    return reject("The cloud copy would reopen a match completed on this device.");
  }
  if (local.teams.length !== remote.teams.length) {
    return reject("The incoming score has a different team structure.");
  }
  for (let i = 0; i < local.teams.length; i += 1) {
    if (local.teams[i]?.id !== remote.teams[i]?.id) {
      return reject("The incoming score refers to different teams.");
    }
    if (JSON.stringify(local.teams[i]) !== JSON.stringify(remote.teams[i])) {
      return reject("A team's identity or registered players differ between scorers.");
    }
  }
  if (remote.innings.length < local.innings.length) {
    return reject("The cloud score is missing an innings recorded on this device.");
  }
  for (let i = 0; i < local.innings.length; i += 1) {
    const onDevice = local.innings[i]!;
    const fromCloud = remote.innings[i];
    if (!fromCloud || onDevice.id !== fromCloud.id || onDevice.number !== fromCloud.number) {
      return reject(`Innings ${i + 1} differs between the device and the cloud.`);
    }
    if (
      onDevice.battingTeamId !== fromCloud.battingTeamId ||
      onDevice.bowlingTeamId !== fromCloud.bowlingTeamId
    ) {
      return reject(`Innings ${i + 1} has conflicting batting or bowling sides.`);
    }
    if (onDevice.status === "completed" && fromCloud.status !== "completed") {
      return reject(`The cloud copy would reopen innings ${i + 1}.`);
    }
    if (fromCloud.deliveries.length < onDevice.deliveries.length) {
      return reject(`The cloud copy is missing recorded deliveries from innings ${i + 1}.`);
    }
    for (let j = 0; j < onDevice.deliveries.length; j += 1) {
      const deviceDelivery: Delivery = onDevice.deliveries[j]!;
      const cloudDelivery: Delivery | undefined = fromCloud.deliveries[j];
      if (!cloudDelivery || deviceDelivery.id !== cloudDelivery.id) {
        return reject(`Delivery ${j + 1} of innings ${i + 1} differs between scorers.`);
      }
      if (JSON.stringify(deviceDelivery) !== JSON.stringify(cloudDelivery)) {
        return reject(`Delivery ${j + 1} of innings ${i + 1} was edited on another scorer.`);
      }
    }
    if (
      fromCloud.deliveries.length === onDevice.deliveries.length &&
      (onDevice.strikerId !== fromCloud.strikerId ||
        onDevice.nonStrikerId !== fromCloud.nonStrikerId ||
        onDevice.bowlerId !== fromCloud.bowlerId ||
        onDevice.end !== fromCloud.end)
    ) {
      return reject(`Scorer assignments in innings ${i + 1} were changed without a new delivery.`);
    }
  }
  return { safe: true, reason: null };
}

/**
 * Never replace the on-device match while queued offline events are unresolved.
 * Queue recovery and any disputed result need an explicit lead-scorer decision.
 */
export function reviewCloudBootstrap(
  local: CricketMatch | undefined,
  remote: CricketMatch,
  pendingEvents: number,
): ScorerSnapshotReview {
  if (pendingEvents > 0) {
    return {
      safe: false,
      reason: `${pendingEvents} unsent scoring event(s) are still on this device. The cloud copy was not applied.`,
    };
  }
  return local ? reviewRemoteScorerSnapshot(local, remote) : { safe: true, reason: null };
}
