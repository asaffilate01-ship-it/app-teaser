import assert from "node:assert/strict";
import test from "node:test";
import { buildRoundRobin } from "../src/lib/fixture-builder.ts";

const base = {
  doubleRoundRobin: false,
  firstDate: "2027-05-01",
  startTime: "13:00",
  daysBetweenRounds: 7,
};
const key = (a: string, b: string) => [a, b].sort().join("-");

for (const count of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
  test(`${count} teams: every pair meets exactly once and nobody plays twice in a round`, () => {
    const teams = Array.from({ length: count }, (_, i) => `t${i}`);
    const { fixtures, rounds, byes } = buildRoundRobin({ ...base, teamIds: teams });
    assert.equal(fixtures.length, (count * (count - 1)) / 2);
    assert.equal(rounds, count % 2 === 0 ? count - 1 : count);
    assert.equal(
      new Set(fixtures.map((f) => key(f.homeTeamId, f.awayTeamId))).size,
      fixtures.length,
    );
    for (let round = 1; round <= rounds; round += 1) {
      const playing = fixtures
        .filter((f) => f.round === round)
        .flatMap((f) => [f.homeTeamId, f.awayTeamId]);
      assert.equal(new Set(playing).size, playing.length);
    }
    assert.equal(byes.length, count % 2 === 0 ? 0 : count);
    for (const team of teams) {
      const home = fixtures.filter((f) => f.homeTeamId === team).length;
      const away = fixtures.filter((f) => f.awayTeamId === team).length;
      assert.ok(Math.abs(home - away) <= 1, `${team} home ${home} away ${away}`);
    }
  });
}

test("double round-robin: each pair meets twice with home and away swapped", () => {
  const { fixtures, rounds } = buildRoundRobin({
    ...base,
    teamIds: ["a", "b", "c", "d"],
    doubleRoundRobin: true,
  });
  assert.equal(fixtures.length, 12);
  assert.equal(rounds, 6);
  for (const [x, y] of [
    ["a", "b"],
    ["a", "c"],
    ["c", "d"],
  ] as const) {
    assert.equal(fixtures.filter((f) => f.homeTeamId === x && f.awayTeamId === y).length, 1);
    assert.equal(fixtures.filter((f) => f.homeTeamId === y && f.awayTeamId === x).length, 1);
  }
});

test("rounds are spaced by the chosen number of days at the chosen local time", () => {
  const { fixtures } = buildRoundRobin({ ...base, teamIds: ["a", "b", "c", "d"] });
  const first = new Date(fixtures.find((f) => f.round === 1)!.startsAt!);
  const second = new Date(fixtures.find((f) => f.round === 2)!.startsAt!);
  assert.equal(first.getDate(), 1);
  assert.equal(first.getHours(), 13);
  assert.equal(second.getDate(), 8);
});

test("no first date leaves fixtures undated", () => {
  const { fixtures } = buildRoundRobin({ ...base, firstDate: "", teamIds: ["a", "b"] });
  assert.equal(fixtures[0]?.startsAt, null);
});

test("grounds rotate across matches", () => {
  const { fixtures } = buildRoundRobin({
    ...base,
    teamIds: ["a", "b", "c", "d"],
    groundIds: ["g1", "g2"],
  });
  const round1 = fixtures.filter((f) => f.round === 1).map((f) => f.groundId);
  assert.deepEqual(round1, ["g1", "g2"]);
});
