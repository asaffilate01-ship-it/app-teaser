import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedDismissals,
  createMatch,
  currentInnings,
  declareInnings,
  endCurrentInnings,
  inningsWicketLimit,
  matchResult,
  nextBallIsFreeHit,
  nextInningsPlan,
  recordDelivery,
  startNextInnings,
  summarizeInnings,
  targetForCurrentInnings,
  type CricketMatch,
  type MatchRules,
  type RecordDeliveryInput,
} from "../src/lib/cricket.ts";

function makeMatch(
  rules: MatchRules,
  overs: number | null = 2,
  inningsPerSide: 1 | 2 = 1,
  players = 4,
): CricketMatch {
  const names = (side: string) => Array.from({ length: players }, (_, i) => `${side} ${i + 1}`);
  return createMatch({
    homeTeamName: "Home XI",
    awayTeamName: "Away XI",
    homePlayers: names("Home"),
    awayPlayers: names("Away"),
    battingFirst: "home",
    settings: {
      format: inningsPerSide === 2 ? "Multi-day" : "T20",
      oversPerInnings: overs,
      inningsPerSide,
      ballsPerOver: 6,
      ground: "Test Ground",
      weather: "Clear",
      startTime: "2026-11-23T10:00:00Z",
      rules,
    },
  });
}

function ball(
  match: CricketMatch,
  overrides: Partial<RecordDeliveryInput> = {},
): RecordDeliveryInput {
  const innings = currentInnings(match);
  return {
    strikerId: innings.strikerId,
    nonStrikerId: innings.nonStrikerId,
    bowlerId: innings.bowlerId,
    end: innings.end,
    deliveryStyle: "Medium",
    outcome: "hit-no-run",
    batterRuns: 0,
    ...overrides,
  };
}

const wicket = (match: CricketMatch) =>
  recordDelivery(
    match,
    ball(match, {
      outcome: "wicket",
      dismissal: { type: "bowled", batterId: currentInnings(match).strikerId },
    }),
  );

/** Score `runs` then end the innings by hand. */
function scoreAndEnd(match: CricketMatch, runs: number): CricketMatch {
  let next = match;
  for (let left = runs; left > 0; left -= Math.min(6, left)) {
    next = recordDelivery(next, ball(next, { outcome: "hit", batterRuns: Math.min(6, left) }));
    if (next.status !== "live") return next;
  }
  return endCurrentInnings(next);
}

test("ball after a no-ball is a free hit; a wide on the free hit carries it on", () => {
  let match = makeMatch({ freeHit: true });
  assert.equal(nextBallIsFreeHit(match), false);
  match = recordDelivery(match, ball(match, { extras: { noBall: 1 } }));
  assert.equal(nextBallIsFreeHit(match), true);
  match = recordDelivery(match, ball(match, { extras: { wide: 1 } }));
  assert.equal(nextBallIsFreeHit(match), true);
  match = recordDelivery(match, ball(match));
  assert.equal(currentInnings(match).deliveries.at(-1)?.freeHit, true);
  assert.equal(nextBallIsFreeHit(match), false);
});

test("free hits are off unless the match rules switch them on", () => {
  let match = makeMatch({});
  match = recordDelivery(match, ball(match, { extras: { noBall: 1 } }));
  assert.equal(nextBallIsFreeHit(match), false);
});

test("on a free hit the batter can only be run out (or obstructing the field)", () => {
  let match = makeMatch({ freeHit: true });
  match = recordDelivery(match, ball(match, { extras: { noBall: 1 } }));
  assert.deepEqual(allowedDismissals(match), ["run-out", "obstructing-the-field"]);
  const bowled = wicket(match);
  assert.equal(bowled, match, "a bowled dismissal on a free hit is not recorded");
  const runOut = recordDelivery(
    match,
    ball(match, {
      outcome: "wicket",
      dismissal: { type: "run-out", batterId: currentInnings(match).strikerId },
    }),
  );
  assert.equal(summarizeInnings(currentInnings(runOut)).wickets, 1);
});

test("last man stands: the last batter bats alone and keeps the strike", () => {
  let match = makeMatch({ lastManStands: true }, 5, 1, 3);
  assert.equal(inningsWicketLimit(match, currentInnings(match)), 3);
  match = wicket(match);
  match = wicket(match);
  const innings = currentInnings(match);
  assert.equal(match.status, "live");
  assert.equal(innings.strikerId, innings.nonStrikerId);
  const alone = innings.strikerId;
  match = recordDelivery(match, ball(match, { outcome: "hit", batterRuns: 1 }));
  assert.equal(currentInnings(match).strikerId, alone, "a single does not change the strike");
  match = wicket(match);
  assert.equal(match.status, "innings-break");
});

test("without last man stands, the innings ends one wicket earlier", () => {
  let match = makeMatch({}, 5, 1, 3);
  match = wicket(match);
  match = wicket(match);
  assert.equal(match.status, "innings-break");
});

test("a tie with Super Overs on goes to a one-over, two-wicket Super Over; team batting second bats first", () => {
  let match = makeMatch({ superOver: true });
  match = scoreAndEnd(match, 10);
  match = startNextInnings(match);
  match = scoreAndEnd(match, 10);
  const plan = nextInningsPlan(match);
  assert.equal(plan.kind, "super-over");
  const awayId = match.teams[1].id;
  assert.equal(plan.kind === "super-over" && plan.battingTeamId, awayId);
  assert.equal(matchResult(match), null, "no result while a Super Over is due");

  match = startNextInnings(match);
  assert.equal(currentInnings(match).kind, "super-over");
  assert.equal(inningsWicketLimit(match, currentInnings(match)), 2);
  // One over only.
  for (let i = 0; i < 6; i += 1)
    match = recordDelivery(match, ball(match, i === 0 ? { outcome: "hit", batterRuns: 6 } : {}));
  assert.equal(match.status, "innings-break");
  match = startNextInnings(match);
  assert.equal(targetForCurrentInnings(match), 7);
  match = recordDelivery(match, ball(match, { outcome: "hit", batterRuns: 6 }));
  match = recordDelivery(match, ball(match, { outcome: "hit", batterRuns: 1 }));
  assert.equal(match.status, "innings-break");
  const result = matchResult(match);
  assert.equal(result?.winnerTeamId, match.teams[0].id);
  assert.equal(result?.text, "Home XI won the Super Over");
});

test("a tie with Super Overs off is a tie", () => {
  let match = makeMatch({});
  match = scoreAndEnd(match, 8);
  match = startNextInnings(match);
  match = scoreAndEnd(match, 8);
  assert.equal(nextInningsPlan(match).kind, "complete");
  assert.equal(matchResult(match)?.text, "Match tied");
});

test("one-innings results read by runs and by wickets with balls left", () => {
  let match = makeMatch({});
  match = scoreAndEnd(match, 12);
  match = startNextInnings(match);
  match = recordDelivery(match, ball(match, { outcome: "hit", batterRuns: 6 }));
  match = recordDelivery(match, ball(match, { outcome: "hit", batterRuns: 6 }));
  match = recordDelivery(match, ball(match, { outcome: "hit", batterRuns: 1 }));
  assert.equal(matchResult(match)?.text, "Away XI won by 3 wickets (9 balls left)");

  let other = makeMatch({});
  other = scoreAndEnd(other, 12);
  other = startNextInnings(other);
  other = scoreAndEnd(other, 7);
  assert.equal(matchResult(other)?.text, "Home XI won by 5 runs");
});

test("declarations are only allowed in two-innings matches", () => {
  const limited = makeMatch({});
  assert.equal(declareInnings(limited), limited);
  const long = makeMatch({ followOnLead: 150 }, null, 2);
  const declared = declareInnings(long);
  assert.equal(declared.status, "innings-break");
  assert.equal(currentInnings(declared).declared, true);
});

test("follow-on can be enforced when the first-innings lead reaches the threshold", () => {
  let match = makeMatch({ followOnLead: 150 }, null, 2);
  match = scoreAndEnd(match, 200);
  match = startNextInnings(match);
  match = scoreAndEnd(match, 49);
  const plan = nextInningsPlan(match);
  assert.equal(plan.kind === "regular" && plan.lead, 151);
  assert.equal(plan.kind === "regular" && plan.followOnTeamId, match.teams[1].id);
  match = startNextInnings(match, { followOn: true });
  assert.equal(currentInnings(match).battingTeamId, match.teams[1].id);
  assert.equal(currentInnings(match).followOn, true);
  // Still behind after following on: lose by an innings.
  match = scoreAndEnd(match, 100);
  assert.equal(nextInningsPlan(match).kind, "complete");
  assert.equal(matchResult(match)?.text, "Home XI won by an innings and 51 runs");
});

test("no follow-on below the threshold", () => {
  let match = makeMatch({ followOnLead: 150 }, null, 2);
  match = scoreAndEnd(match, 200);
  match = startNextInnings(match);
  match = scoreAndEnd(match, 51);
  const plan = nextInningsPlan(match);
  assert.equal(plan.kind === "regular" && plan.followOnTeamId, null);
  const next = startNextInnings(match, { followOn: true });
  assert.equal(currentInnings(next).battingTeamId, match.teams[0].id);
});

test("the fourth innings is a chase that ends when the target is reached", () => {
  let match = makeMatch({}, null, 2);
  match = scoreAndEnd(match, 30); // Home 30
  match = startNextInnings(match);
  match = scoreAndEnd(match, 20); // Away 20
  match = startNextInnings(match);
  match = scoreAndEnd(match, 10); // Home 40 total
  match = startNextInnings(match);
  assert.equal(targetForCurrentInnings(match), 21);
  match = recordDelivery(match, ball(match, { outcome: "hit", batterRuns: 6 }));
  match = recordDelivery(match, ball(match, { outcome: "hit", batterRuns: 6 }));
  match = recordDelivery(match, ball(match, { outcome: "hit", batterRuns: 6 }));
  assert.equal(match.status, "live");
  match = recordDelivery(match, ball(match, { outcome: "hit", batterRuns: 3 }));
  assert.equal(match.status, "innings-break");
  assert.equal(matchResult(match)?.text, "Away XI won by 3 wickets");
});

test("an unfinished fourth innings is a draw", () => {
  let match = makeMatch({}, null, 2);
  match = scoreAndEnd(match, 30);
  match = startNextInnings(match);
  match = scoreAndEnd(match, 20);
  match = startNextInnings(match);
  match = scoreAndEnd(match, 10);
  match = startNextInnings(match);
  match = scoreAndEnd(match, 5);
  assert.equal(matchResult(match)?.text, "Match drawn");
});
