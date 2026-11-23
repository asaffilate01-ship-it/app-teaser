import assert from "node:assert/strict";
import test from "node:test";
import { ballsToPassNrr, marginToPassNrr, netRunRate, qualificationReport, type QualTableRow } from "../src/lib/qualification.ts";

const row = (teamId: string, points: number, extra: Partial<QualTableRow> = {}): QualTableRow => ({
  teamId, points, runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0, ...extra,
});

test("a team 8 points clear of 3rd with one game left (4 per win) is through for top 2", () => {
  const report = qualificationReport({
    rows: [row("A", 16), row("B", 12), row("C", 8), row("D", 4)],
    remaining: [{ homeTeamId: "A", awayTeamId: "D" }, { homeTeamId: "B", awayTeamId: "C" }],
    teamId: "A", spots: 2, winPoints: 4,
  });
  assert.equal(report.status, "through");
  assert.equal(report.qualifies, report.scenarios);
});

test("a team that cannot reach the cut-off points is out", () => {
  const report = qualificationReport({
    rows: [row("A", 16), row("B", 16), row("C", 0)],
    remaining: [{ homeTeamId: "C", awayTeamId: "A" }],
    teamId: "C", spots: 2, winPoints: 4,
  });
  assert.equal(report.status, "out");
  assert.equal(report.maxPoints, 4);
  assert.equal(report.winsNeeded, null);
});

test("win and you're level with the cut-off: net run rate decides", () => {
  // B on 12, C on 8; C plays B. If C wins, both on 12 for the last spot.
  const report = qualificationReport({
    rows: [row("A", 20), row("B", 12), row("C", 8)],
    remaining: [{ homeTeamId: "C", awayTeamId: "B" }],
    teamId: "C", spots: 2, winPoints: 4,
  });
  assert.equal(report.ifWinAll, "nrr");
  assert.equal(report.status, "needs-help");
  assert.equal(report.winsNeeded, 1);
});

test("in your own hands: winning both remaining games is always enough", () => {
  const report = qualificationReport({
    rows: [row("A", 8), row("B", 8), row("C", 4), row("D", 0)],
    remaining: [{ homeTeamId: "A", awayTeamId: "C" }, { homeTeamId: "A", awayTeamId: "D" }, { homeTeamId: "B", awayTeamId: "C" }],
    teamId: "A", spots: 2, winPoints: 4,
  });
  assert.equal(report.ifWinAll, "through");
});

test("net run rate: 300 for in 50 overs and 250 against in 50 overs is +1.00", () => {
  assert.equal(netRunRate({ runsFor: 300, ballsFaced: 300, runsAgainst: 250, ballsBowled: 300 }).toFixed(2), "1.00");
});

test("NRR targets: margin when batting first and how fast to chase", () => {
  const team = row("A", 8, { runsFor: 300, ballsFaced: 240, runsAgainst: 300, ballsBowled: 240 }); // NRR 0 over 40 overs
  // Score 150 in 20 overs; to go above +0.50 the margin m must satisfy 450/60 - (450-m)/60 > 0.5 → m > 30.
  assert.equal(marginToPassNrr(team, 0.5, 150, 20), 31);
  // Chase 151 (they made 150 in 20): 451/(240+b)*6 - 450/360*6 > 0.5.
  const balls = ballsToPassNrr(team, 0.5, 151, 20)!;
  assert.ok(balls < 120);
  const after = (b: number) => netRunRate({ runsFor: 451, ballsFaced: 240 + b, runsAgainst: 450, ballsBowled: 360 });
  assert.ok(after(balls) > 0.5 && after(balls + 1) <= 0.5);
});
