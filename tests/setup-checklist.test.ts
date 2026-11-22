import assert from "node:assert/strict";
import test from "node:test";
import { buildSetupChecklist, setupProgress } from "../src/lib/setup-checklist.ts";

test("a brand-new club has only the club step done", () => {
  const steps = buildSetupChecklist({ teams: 0, players: 0, members: 1, matches: 0 });
  assert.deepEqual(setupProgress(steps), { done: 1, total: 5, percent: 20 });
});

test("the teams step needs two teams", () => {
  assert.equal(buildSetupChecklist({ teams: 1, players: 0, members: 1, matches: 0 })[1]?.done, false);
  assert.equal(buildSetupChecklist({ teams: 2, players: 0, members: 1, matches: 0 })[1]?.done, true);
});

test("the players step needs four players (two per team)", () => {
  assert.equal(buildSetupChecklist({ teams: 2, players: 3, members: 1, matches: 0 })[2]?.done, false);
  assert.equal(buildSetupChecklist({ teams: 2, players: 4, members: 1, matches: 0 })[2]?.done, true);
});

test("the checklist is complete with a second member and a first match", () => {
  const steps = buildSetupChecklist({ teams: 2, players: 4, members: 2, matches: 1 });
  assert.equal(setupProgress(steps).percent, 100);
});
