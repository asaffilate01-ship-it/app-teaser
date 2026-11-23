import assert from "node:assert/strict";
import test from "node:test";
import { parseCsv, planSquadImport } from "../src/lib/squad-import.ts";

const none = { teams: [], players: [] };

test("CSV parsing handles quotes, commas inside quotes and CRLF", () => {
  assert.deepEqual(parseCsv('Team,Player\r\n"Lions, 1st XI","O""Brien"\r\n'), [["Team", "Player"], ["Lions, 1st XI", 'O"Brien']]);
});

test("new teams are created once and players are attached", () => {
  const plan = planSquadImport("Team,Player\nLions,Ali\nLions,Ben\nTigers,Cal\n", none);
  assert.deepEqual(plan.newTeams.map((team) => team.name), ["Lions", "Tigers"]);
  assert.equal(plan.players.length, 3);
});

test("existing teams match by name in any case and existing players are skipped", () => {
  const plan = planSquadImport("Team,Player\nlions,Ali\nLIONS,Dev\n", {
    teams: [{ id: "t1", name: "Lions" }],
    players: [{ name: "Ali", teamIds: ["t1"] }],
  });
  assert.equal(plan.newTeams.length, 0);
  assert.deepEqual(plan.players.map((player) => player.name), ["Dev"]);
  assert.equal(plan.skipped[0]?.line, 2);
});

test("junior players are never given a public profile", () => {
  const plan = planSquadImport("Team,Player,Junior,Public\nU13,Alex,yes,yes\nFirst XI,Sam,no,yes\n", none);
  assert.equal(plan.players[0]?.publicProfile, false);
  assert.equal(plan.players[1]?.publicProfile, true);
});

test("unclear yes/no values are rejected, blanks mean no", () => {
  const plan = planSquadImport("Team,Player,Junior\nU13,Alex,maybe\nU13,Jo,\n", none);
  assert.equal(plan.skipped[0]?.reason, "Junior/Public must be yes or no");
  assert.equal(plan.players[0]?.isJunior, false);
});

test("a sheet without Team and Player columns is refused", () => {
  const plan = planSquadImport("Name,Club\nAli,Lions\n", none);
  assert.equal(plan.players.length, 0);
  assert.equal(plan.skipped[0]?.line, 1);
});
