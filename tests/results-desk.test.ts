import assert from "node:assert/strict";
import test from "node:test";
import {
  deskState,
  resultProblem,
  resultsAgree,
  sortForAction,
  suggestedResult,
  type InboxFixture,
} from "../src/lib/results-desk.ts";

const now = Date.parse("2026-11-23T12:00:00Z");
const win = {
  winnerTeamId: "home",
  homeRuns: 150,
  awayRuns: 120,
  homeLegalBalls: 120,
  awayLegalBalls: 120,
};
const fixture = (patch: Partial<InboxFixture>): InboxFixture => ({
  fixtureId: "f",
  competitionId: "c",
  competition: "League",
  round: null,
  startsAt: "2026-11-22T10:00:00Z",
  status: "scheduled",
  homeTeamId: "home",
  awayTeamId: "away",
  home: "Riverside",
  away: "Hilltop",
  signedOffAt: null,
  officialResult: null,
  isLeagueAdmin: true,
  myTeamIds: [],
  reports: [],
  suggested: null,
  ...patch,
});
const report = (teamId: string, result: object) => ({
  teamId,
  result,
  note: "",
  submittedAt: "2026-11-22T18:00:00Z",
});

test("both teams matching is ready to sign off; different scores are a dispute", () => {
  assert.equal(
    deskState(fixture({ reports: [report("home", win), report("away", { ...win })] }), now),
    "ready",
  );
  assert.equal(
    deskState(
      fixture({ reports: [report("home", win), report("away", { ...win, awayRuns: 121 })] }),
      now,
    ),
    "disputed",
  );
});

test("a fixture with no report is overdue 48 hours after the start, waiting before that", () => {
  assert.equal(deskState(fixture({ startsAt: "2026-11-21T11:59:00Z" }), now), "overdue");
  assert.equal(deskState(fixture({ startsAt: "2026-11-21T12:01:00Z" }), now), "awaiting-both");
  assert.equal(deskState(fixture({ reports: [report("home", win)] }), now), "awaiting-one");
  assert.equal(deskState(fixture({ signedOffAt: "2026-11-23T09:00:00Z" }), now), "signed-off");
});

test("needs-action list puts disputes first, then overdue, then ready", () => {
  const list = sortForAction(
    [
      fixture({ fixtureId: "ready", reports: [report("home", win), report("away", win)] }),
      fixture({ fixtureId: "overdue", startsAt: "2026-11-01T10:00:00Z" }),
      fixture({
        fixtureId: "disputed",
        reports: [report("home", win), report("away", { ...win, winnerTeamId: "away" })],
      }),
    ],
    now,
  );
  assert.deepEqual(
    list.map((f) => f.fixtureId),
    ["disputed", "overdue", "ready"],
  );
});

test("result checks match the league rules", () => {
  assert.equal(resultProblem(win, "home", "away"), null);
  assert.equal(resultProblem({ noResult: true }, "home", "away"), null);
  assert.match(
    resultProblem({ ...win, tied: true }, "home", "away") ?? "",
    /winner, a tie or no result/,
  );
  assert.match(
    resultProblem({ ...win, homeLegalBalls: 0 }, "home", "away") ?? "",
    /at least one ball/,
  );
  assert.match(resultProblem({ ...win, winnerTeamId: "away" }, "home", "away") ?? "", /fewer runs/);
});

test("suggested result comes from the completed scored match", () => {
  const suggested = {
    matchId: "m",
    homeRuns: 140,
    homeLegalBalls: 120,
    awayRuns: 141,
    awayLegalBalls: 110,
    status: "completed",
    resultText: null,
  };
  assert.equal(suggestedResult(fixture({ suggested }))?.winnerTeamId, "away");
  assert.equal(suggestedResult(fixture({ suggested: { ...suggested, status: "live" } })), null);
  assert.equal(resultsAgree({ ...win, tied: false }, win), true);
});
