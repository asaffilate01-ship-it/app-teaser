import type { CricketMatch, Delivery } from "./cricket";

/**
 * Fielding notes (position, fielder, ball type, catcher) can be added by the bowling & fielding
 * scorer on another phone after a ball is recorded, so they never count as a scoring conflict.
 */
function scoringPart(delivery: Delivery): unknown {
  const {
    fieldZone: _zone,
    fielderId: _fielder,
    deliveryStyle: _style,
    dismissal,
    ...rest
  } = delivery;
  if (!dismissal) return rest;
  const { fielderId: _catcher, catchZone: _catchZone, ...out } = dismissal;
  return { ...rest, dismissal: out };
}

/** JSON object property order is not score data. PostgREST JSONB may reorder keys. */
function sameSnapshotValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameSnapshotValue(value, right[index]))
    );
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const a = Object.entries(left).filter(([, value]) => value !== undefined);
  const b = Object.entries(right).filter(([, value]) => value !== undefined);
  return (
    a.length === b.length &&
    a.every(([key, value]) =>
      b.some(([otherKey, otherValue]) => key === otherKey && sameSnapshotValue(value, otherValue)),
    )
  );
}

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
  if (!sameSnapshotValue(local.settings, remote.settings)) {
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
    if (!sameSnapshotValue(local.teams[i], remote.teams[i])) {
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
    const localRetirements = onDevice.retirements ?? [];
    const cloudRetirements = fromCloud.retirements ?? [];
    if (
      cloudRetirements.length < localRetirements.length ||
      !localRetirements.every((retirement, index) =>
        sameSnapshotValue(retirement, cloudRetirements[index]),
      )
    ) {
      return reject(`Retirement history in innings ${i + 1} differs between scorers.`);
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
      if (!sameSnapshotValue(scoringPart(deviceDelivery), scoringPart(cloudDelivery))) {
        return reject(`Delivery ${j + 1} of innings ${i + 1} was edited on another scorer.`);
      }
    }
    if (
      fromCloud.deliveries.length === onDevice.deliveries.length &&
      // The bowler and end may be changed by the bowling & fielding scorer between balls.
      (onDevice.strikerId !== fromCloud.strikerId ||
        onDevice.nonStrikerId !== fromCloud.nonStrikerId)
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

/**
 * Reopening a cloud match with unsent changes still on this phone: carry on and send them when
 * the last change the cloud accepted also came from this phone (nobody else scored since), or
 * the cloud has no changes yet. If another device scored in between, keep the lead-scorer review.
 */
export function canResumeQueuedScoring(input: {
  pendingEvents: number;
  hasLocalCopy: boolean;
  thisDeviceId: string;
  latestCloudDeviceId: string | null;
}): boolean {
  if (!input.hasLocalCopy || input.pendingEvents <= 0) return false;
  return input.latestCloudDeviceId === null || input.latestCloudDeviceId === input.thisDeviceId;
}
