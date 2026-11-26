import assert from "node:assert/strict";
import test from "node:test";
import { canManageMember, confirmedMemberChange } from "../src/lib/member-operation.ts";

test("membership controls require a verified actor and permitted target", () => {
  const scorer = { userId: "scorer", role: "scorer" as const };
  const owner = { userId: "owner", role: "owner" as const };
  assert.equal(canManageMember("owner", null, scorer), false);
  assert.equal(canManageMember("owner", "owner", owner), false);
  assert.equal(canManageMember("club_admin", "admin", owner), false);
  assert.equal(canManageMember("coach", "coach", scorer), false);
  assert.equal(canManageMember("club_admin", "admin", scorer), true);
  assert.equal(canManageMember("owner", "owner", scorer), true);
});

test("only a matching returned database record confirms the requested membership change", () => {
  const row = { user_id: "scorer", role: "coach", status: "suspended" };
  assert.equal(confirmedMemberChange(null, "scorer", { role: "coach" }), false);
  assert.equal(confirmedMemberChange(row, "different", { role: "coach" }), false);
  assert.equal(confirmedMemberChange(row, "scorer", {}), false);
  assert.equal(confirmedMemberChange(row, "scorer", { status: "active" }), false);
  assert.equal(confirmedMemberChange(row, "scorer", { role: "coach" }), true);
  assert.equal(confirmedMemberChange(row, "scorer", { role: "coach", status: "suspended" }), true);
});
