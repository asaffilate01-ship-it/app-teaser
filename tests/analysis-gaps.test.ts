import assert from "node:assert/strict";
import test from "node:test";
import {
  createMatch,
  currentInnings,
  recordDelivery,
  type CricketMatch,
  type RecordDeliveryInput,
} from "../src/lib/cricket.ts";
import { lengthBand, lineBand, pitchBreakdown } from "../src/lib/ball-track.ts";
import { bowlingTypeSplits, phaseOf, phaseOvers, phaseSplits } from "../src/lib/phase-splits.ts";
import { csvCell } from "../src/lib/stats-export.ts";

const make = () =>
  createMatch({
    homeTeamName: "Lions",
    awayTeamName: "Tigers",
    homePlayers: ["Ali", "Ben", "Cal"],
    awayPlayers: ["Fin", "Gus", "Hal"],
    battingFirst: "home",
    settings: {
      format: "T20",
      oversPerInnings: 20,
      inningsPerSide: 1,
      ballsPerOver: 6,
      ground: "",
      weather: "",
      startTime: "2027-05-01T10:00:00Z",
    },
  });
const ball = (m: CricketMatch, extra: Partial<RecordDeliveryInput> = {}): RecordDeliveryInput => {
  const i = currentInnings(m);
  return {
    strikerId: i.strikerId,
    nonStrikerId: i.nonStrikerId,
    bowlerId: i.bowlerId,
    end: "Pavilion",
    deliveryStyle: "Fast",
    outcome: "hit",
    batterRuns: 0,
    ...extra,
  };
};

test("T20 powerplay is overs 1-6 and the death is overs 16-20", () => {
  assert.deepEqual(phaseOvers(20), { powerplay: 6, death: 5 });
  assert.equal(phaseOf(5, 20), "Powerplay");
  assert.equal(phaseOf(6, 20), "Middle");
  assert.equal(phaseOf(15, 20), "Death");
});

test("one-day powerplay is the first 10 overs and the death the last 10", () => {
  assert.deepEqual(phaseOvers(50), { powerplay: 10, death: 10 });
});

test("multi-day innings have no phases", () => {
  assert.equal(phaseOvers(null), null);
});

test("phase splits add runs to the right phase", () => {
  let m = make();
  for (let i = 0; i < 36; i += 1) m = recordDelivery(m, ball(m, { batterRuns: i < 6 ? 4 : 1 }));
  const rows = phaseSplits(m, currentInnings(m));
  assert.equal(rows[0]!.label, "Powerplay");
  assert.equal(rows[0]!.runs, 6 * 4 + 30);
  assert.equal(rows[0]!.boundaries, 6);
});

test("pace and spin are split by bowling type", () => {
  let m = make();
  m = recordDelivery(m, ball(m, { batterRuns: 4, deliveryStyle: "Fast" }));
  m = recordDelivery(m, ball(m, { batterRuns: 1, deliveryStyle: "Leg spin" }));
  const rows = bowlingTypeSplits(currentInnings(m).deliveries);
  assert.equal(rows.find((r) => r.label === "Pace")!.runs, 4);
  assert.equal(rows.find((r) => r.label === "Spin")!.runs, 1);
});

test("pitch lengths: under 2 m is a yorker, 6-8 m is a good length", () => {
  assert.equal(lengthBand({ x: 0.5, y: 0.1 }), "Yorker");
  assert.equal(lengthBand({ x: 0.5, y: 0.7 }), "Good");
  assert.equal(lengthBand({ x: 0.5, y: 0.9 }), "Short");
});

test("line flips for a left-hander", () => {
  assert.equal(lineBand({ x: 0.2, y: 0.5 }), "Wide outside off");
  assert.equal(lineBand({ x: 0.2, y: 0.5 }, true), "Leg side");
});

test("pitch breakdown counts only tapped balls", () => {
  let m = make();
  m = recordDelivery(m, ball(m, { batterRuns: 0, pitch: { x: 0.5, y: 0.7 } }));
  m = recordDelivery(m, ball(m, { batterRuns: 2 }));
  const result = pitchBreakdown(currentInnings(m).deliveries);
  assert.equal(result.tracked, 1);
  assert.equal(result.byLength.find((r) => r.band === "Good")!.dots, 1);
});

test("spreadsheet cells can't run as formulas", () => {
  assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(csvCell("-3"), "-3");
  assert.equal(csvCell('Ali "the wall"'), '"Ali ""the wall"""');
});

import { comparePlayers, economy, rankPlayers, rankingPoints } from "../src/lib/rankings.ts";

test("ranking points: a run is 1, a wicket 20, a catch 10", () => {
  assert.equal(rankingPoints({ runs: 50, wickets: 2, catches: 1 }), 100);
});

test("economy ranking ignores bowlers with under 60 balls and puts the cheapest first", () => {
  const rows = [
    { ref: "a", ballsBowled: 30, runsConceded: 5 },
    { ref: "b", ballsBowled: 120, runsConceded: 160 },
    { ref: "c", ballsBowled: 120, runsConceded: 100 },
  ];
  assert.deepEqual(
    rankPlayers(rows, "economy").map((r) => r.ref),
    ["c", "b"],
  );
  assert.equal(economy(rows[2]!), 5);
});

test("compare marks the lower economy as better", () => {
  const line = comparePlayers(
    { ballsBowled: 60, runsConceded: 40 },
    { ballsBowled: 60, runsConceded: 60 },
  ).find((l) => l.label === "Economy")!;
  assert.equal(line.better, "a");
});
