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
  if (local.teams.length !== remote.teams.length) {
    return reject("The incoming score has a different team structure.");
  }
  for (let i = 0; i < local.teams.length; i += 1) {
    if (local.teams[i]?.id !== remote.teams[i]?.id) {
      return reject("The incoming score refers to different teams.");
    }
  }
  if (remote.innings.length < local.innings.length) {
    return reject("The cloud score is missing an innings recorded on this device.");
  }
  for (let i = 0; i < local.innings.length; i += 1) {
    const onDevice = local.innings[i]!;
    const fromCloud = remote.innings[i];
    if (!fromCloud || onDevice.id !== fromCloud.id) {
      return reject(`Innings ${i + 1} differs between the device and the cloud.`);
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
  }
  return { safe: true, reason: null };
}
