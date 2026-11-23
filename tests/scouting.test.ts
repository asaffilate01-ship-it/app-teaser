import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, currentInnings, endCurrentInnings, recordDelivery, startNextInnings, type CricketMatch, type RecordDeliveryInput } from "../src/lib/cricket.ts";
import { phaseOf, scoutingReport } from "../src/lib/scouting.ts";

const base = createMatch({
  homeTeamName: "Lions", awayTeamName: "Tigers",
  homePlayers: ["Ali", "Ben", "Cal", "Dev", "Eli"], awayPlayers: ["Fin", "Gus", "Hal", "Ian", "Jay"],
  battingFirst: "home",
  settings: { format: "T20", oversPerInnings: 20, inningsPerSide: 1, ballsPerOver: 6, ground: "", weather: "", startTime: "2027-05-01T10:00:00Z" },
});
const [lions, tigers] = base.teams as [typeof base.teams[0], typeof base.teams[0]];
const ali = lions.players[0]!.id;
const ben = lions.players[1]!.id;
const ball = (m: CricketMatch, extra: Partial<RecordDeliveryInput> = {}): RecordDeliveryInput => {
  const i = currentInnings(m);
  return { strikerId: i.strikerId, nonStrikerId: i.nonStrikerId, bowlerId: i.bowlerId, end: "Pavilion", deliveryStyle: "Medium", outcome: "hit", batterRuns: 0, ...extra };
};

/** Ali faces 36 balls: v pace he blocks (dots), v spin he hits 4s through Cover. Out caught twice in two matches. */
function play(id: string): CricketMatch {
  let match: CricketMatch = { ...structuredClone(base), id };
  for (let i = 0; i < 18; i++) {
    const spin = i % 2 === 1;
    match = recordDelivery(match, ball(match, { strikerId: ali, nonStrikerId: ben, deliveryStyle: spin ? "Off spin" : "Fast", batterRuns: spin ? 4 : 0, fieldZone: spin ? "Cover" : "Not recorded", outcome: spin ? "hit" : "hit-no-run" }));
  }
  match = recordDelivery(match, ball(match, { strikerId: ali, nonStrikerId: ben, outcome: "wicket", dismissal: { type: "caught", batterId: ali, fielderId: tigers.players[0]!.id } }));
  match = startNextInnings(endCurrentInnings(match));
  return match;
}

test("phases split a 20-over innings into powerplay (1–6), middle and death (17–20)", () => {
  const m = play("p");
  const at = (over: number) => phaseOf(m, { ...m.innings[0]!.deliveries[0]!, over });
  assert.deepEqual([at(0), at(5), at(6), at(15), at(16), at(19)], ["powerplay", "powerplay", "middle", "middle", "death", "death"]);
});

test("scouting report measures scoring areas, pace v spin and dismissals", () => {
  const report = scoutingReport([play("m1"), play("m2")], ali, { strengths: "Good temperament", author: "Coach Imran" })!;
  assert.equal(report.player.name, "Ali");
  assert.equal(report.batting?.ballsFaced, 38);
  assert.equal(report.batting?.runsByArea[0]?.area, "Cover");
  assert.equal(report.batting?.runsByArea[0]?.pct, 100);
  const pace = report.batting!.vsBowling.find((item) => item.label === "v pace")!;
  const spin = report.batting!.vsBowling.find((item) => item.label === "v spin")!;
  assert.equal(spin.strikeRate, 400);
  assert.equal(pace.runs, 0);
  assert.deepEqual(report.batting?.dismissals, [{ type: "caught", count: 2 }]);
  assert.ok(report.strengths.some((line) => line.startsWith("Strong against spin")));
  assert.ok(report.weaknesses.includes("Slower against pace"));
  assert.ok(report.strengths.some((line) => line.startsWith("Main scoring area: Cover")));
  assert.equal(report.coach.author, "Coach Imran");
});

test("a player with too few balls gets no automatic verdicts", () => {
  let match: CricketMatch = { ...structuredClone(base), id: "short" };
  match = recordDelivery(match, ball(match, { strikerId: ali, nonStrikerId: ben, batterRuns: 0 }));
  const report = scoutingReport([match], ali)!;
  assert.deepEqual(report.strengths, []);
  assert.deepEqual(report.weaknesses, []);
});
