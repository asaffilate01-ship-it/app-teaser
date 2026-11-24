import assert from "node:assert/strict";
import test from "node:test";
import {
  battingCard,
  bowlingCard,
  createMatch,
  currentInnings,
  recordDelivery,
  startNextInnings,
  summarizeInnings,
  targetForCurrentInnings,
  undoLastDelivery,
  type CricketMatch,
  type RecordDeliveryInput,
} from "../src/lib/cricket.ts";
import { reviewCloudBootstrap, reviewRemoteScorerSnapshot } from "../src/lib/scorer-reconciliation.ts";
import { createOrderedQueueDrainer } from "../src/lib/offline-queue.ts";

/** A deterministic release-regression simulation; NOT a substitute for two physical phones. */
function fixture() {
  return createMatch({
    homeTeamName: "Club North",
    awayTeamName: "Club South",
    homePlayers: ["A", "B", "C"],
    awayPlayers: ["X", "Y", "Z"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: 1,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "Pilot ground",
      weather: "Dry",
      startTime: "2026-11-24T10:00:00.000Z",
    },
  });
}

function ball(match: CricketMatch, extra: Partial<RecordDeliveryInput> = {}): RecordDeliveryInput {
  const innings = currentInnings(match);
  return {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Medium",
    outcome: "hit-no-run",
    batterRuns: 0,
    ...extra,
  };
}

test("one-over pilot simulates extras, an innings transition, a successful chase and final cards", () => {
  let match = fixture();
  match = recordDelivery(match, ball(match, { batterRuns: 4, outcome: "hit" }));
  match = recordDelivery(match, ball(match, { extras: { wide: 1 }, outcome: "missed" }));
  match = recordDelivery(match, ball(match, { extras: { noBall: 1 }, batterRuns: 1, outcome: "hit" }));
  for (let index = 0; index < 5; index++) match = recordDelivery(match, ball(match));

  const first = currentInnings(match);
  const firstSummary = summarizeInnings(first);
  assert.equal(firstSummary.legalBalls, 6);
  assert.equal(firstSummary.runs, 7);
  assert.equal(firstSummary.overs, "1.0");
  assert.equal(match.status, "innings-break");
  assert.ok(battingCard(match, first).length >= 2);
  assert.ok(bowlingCard(match, first).length >= 1);

  match = startNextInnings(match);
  assert.equal(match.status, "live");
  assert.equal(targetForCurrentInnings(match), 8);
  match = recordDelivery(match, ball(match, { batterRuns: 4, outcome: "hit" }));
  match = recordDelivery(match, ball(match, { batterRuns: 4, outcome: "hit" }));
  assert.equal(match.status, "innings-break");
  assert.equal(summarizeInnings(currentInnings(match)).runs, 8);
  match = startNextInnings(match);
  assert.equal(match.status, "completed");
  assert.equal(match.innings.length, 2);
});

test("offline local work cannot be silently replaced by a different scorer's cloud ball", () => {
  const base = fixture();
  const local = recordDelivery(base, ball(base, { batterRuns: 1, outcome: "hit" }));
  const remote = recordDelivery(base, ball(base, { batterRuns: 4, outcome: "hit" }));
  assert.equal(reviewCloudBootstrap(local, remote, 1).safe, false);
  assert.equal(reviewRemoteScorerSnapshot(local, remote).safe, false);
  assert.equal(reviewRemoteScorerSnapshot(base, local).safe, true);
  const undo = undoLastDelivery(local);
  assert.equal(currentInnings(undo).deliveries.length, 0);
});

test("offline replay maintains idempotency IDs and leaves unknown sends for a retry", async () => {
  let queue = [{ clientEventId: "ball-a" }, { clientEventId: "ball-b" }];
  let unavailable = true;
  const delivered: string[] = [];
  const drain = createOrderedQueueDrainer({
    read: () => queue,
    write: (_match, remaining) => { queue = remaining; },
    send: async (event) => {
      delivered.push(event.clientEventId);
      if (unavailable) throw Error("offline");
      return { sequence: delivered.length };
    },
  });
  const interrupted = await drain("pilot");
  assert.deepEqual(interrupted, { sent: 0, remaining: 2, lastSequence: 0 });
  assert.deepEqual(queue.map((x) => x.clientEventId), ["ball-a", "ball-b"]);
  unavailable = false;
  const replayed = await drain("pilot");
  assert.equal(replayed.sent, 2);
  assert.equal(replayed.remaining, 0);
  assert.deepEqual(delivered, ["ball-a", "ball-a", "ball-b"]);
});
