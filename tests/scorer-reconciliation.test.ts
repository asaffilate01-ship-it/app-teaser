import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, currentInnings, recordDelivery } from "../src/lib/cricket.ts";
import {
  reviewCloudBootstrap,
  reviewRemoteScorerSnapshot,
} from "../src/lib/scorer-reconciliation.ts";

function fixture() {
  return createMatch({
    homeTeamName: "North",
    awayTeamName: "South",
    homePlayers: ["A", "B", "C"],
    awayPlayers: ["X", "Y", "Z"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: 20,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "Club",
      weather: "Clear",
      startTime: new Date("2026-11-20T12:00:00Z").toISOString(),
    },
  });
}

function addBall(match: ReturnType<typeof fixture>, runs: number) {
  const innings = currentInnings(match);
  return recordDelivery(match, {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Medium",
    outcome: runs ? "hit" : "hit-no-run",
    batterRuns: runs,
  });
}

test("an identical score and a longer matching cloud score are safe", () => {
  const base = fixture();
  assert.deepEqual(reviewRemoteScorerSnapshot(base, structuredClone(base)), {
    safe: true,
    reason: null,
  });
  const remote = addBall(base, 1);
  assert.equal(reviewRemoteScorerSnapshot(base, remote).safe, true);
});

test("an older cloud snapshot never replaces locally recorded deliveries", () => {
  const base = fixture();
  const scored = addBall(base, 4);
  const checked = reviewRemoteScorerSnapshot(scored, base);
  assert.equal(checked.safe, false);
  assert.match(checked.reason ?? "", /missing recorded deliveries/i);
});

test("two devices that recorded different deliveries require review", () => {
  const base = fixture();
  const first = addBall(base, 1);
  const second = addBall(base, 4);
  const checked = reviewRemoteScorerSnapshot(first, second);
  assert.equal(checked.safe, false);
  assert.match(checked.reason ?? "", /differs between scorers/i);
});

test("same delivery identity but a different result is not silently accepted", () => {
  const first = addBall(fixture(), 2);
  const second = structuredClone(first);
  second.innings[0]!.deliveries[0]!.batterRuns = 6;
  const checked = reviewRemoteScorerSnapshot(first, second);
  assert.equal(checked.safe, false);
  assert.match(checked.reason ?? "", /edited on another scorer/i);
});

test("different teams, match identity or innings structure require review", () => {
  const base = fixture();
  const wrongMatch = structuredClone(base);
  wrongMatch.id = "unrelated";
  assert.equal(reviewRemoteScorerSnapshot(base, wrongMatch).safe, false);
  const wrongTeam = structuredClone(base);
  wrongTeam.teams[0].id = "different";
  assert.equal(reviewRemoteScorerSnapshot(base, wrongTeam).safe, false);
  const noInnings = structuredClone(base);
  noInnings.innings = [];
  assert.equal(reviewRemoteScorerSnapshot(base, noInnings).safe, false);
});

test("cloud bootstrap never erases unsent offline scoring, even if the remote snapshot matches", () => {
  const local = addBall(fixture(), 4);
  const remote = structuredClone(local);
  const review = reviewCloudBootstrap(local, remote, 2);
  assert.equal(review.safe, false);
  assert.match(review.reason ?? "", /unsent scoring/i);
  assert.equal(reviewCloudBootstrap(undefined, remote, 1).safe, false);
  assert.equal(reviewCloudBootstrap(undefined, remote, 0).safe, true);
});

test("cloud bootstrap requires review for a divergent score instead of overwriting a device", () => {
  const first = addBall(fixture(), 1);
  const other = structuredClone(first);
  other.innings[0]!.deliveries[0]!.batterRuns = 6;
  assert.equal(reviewCloudBootstrap(first, other, 0).safe, false);
});

test("a remote snapshot cannot silently change rules, rosters or completed status", () => {
  const local = fixture();
  const rules = structuredClone(local);
  rules.settings.ballsPerOver = 8;
  assert.match(reviewRemoteScorerSnapshot(local, rules).reason ?? "", /rules or setup/);
  const players = structuredClone(local);
  players.teams[0]!.players[0]!.name = "Different player";
  assert.match(reviewRemoteScorerSnapshot(local, players).reason ?? "", /registered players/);
  const completed = structuredClone(local);
  completed.status = "completed";
  assert.match(reviewRemoteScorerSnapshot(completed, local).reason ?? "", /reopen a match/);
});

test("bowling side changes, innings regression and silent striker swaps require review", () => {
  const local = fixture();
  const swapped = structuredClone(local);
  swapped.innings[0]!.bowlingTeamId = local.innings[0]!.battingTeamId;
  assert.match(reviewRemoteScorerSnapshot(local, swapped).reason ?? "", /bowling sides/);
  const reordered = structuredClone(local);
  reordered.innings[0]!.strikerId = local.innings[0]!.nonStrikerId;
  assert.match(reviewRemoteScorerSnapshot(local, reordered).reason ?? "", /Scorer assignments/);
  const completed = structuredClone(local);
  completed.innings[0]!.status = "completed";
  assert.match(reviewRemoteScorerSnapshot(completed, local).reason ?? "", /reopen innings/);
});

test("reopening with unsent changes carries on only when no other phone scored since", async () => {
  const { canResumeQueuedScoring } = await import("../src/lib/scorer-reconciliation.ts");
  const base = { pendingEvents: 3, hasLocalCopy: true, thisDeviceId: "phone-a" };
  assert.equal(canResumeQueuedScoring({ ...base, latestCloudDeviceId: "phone-a" }), true);
  assert.equal(canResumeQueuedScoring({ ...base, latestCloudDeviceId: null }), true);
  assert.equal(canResumeQueuedScoring({ ...base, latestCloudDeviceId: "phone-b" }), false);
  assert.equal(canResumeQueuedScoring({ ...base, pendingEvents: 0, latestCloudDeviceId: "phone-a" }), false);
  assert.equal(canResumeQueuedScoring({ ...base, hasLocalCopy: false, latestCloudDeviceId: "phone-a" }), false);
});
