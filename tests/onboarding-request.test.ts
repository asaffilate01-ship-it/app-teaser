import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readOrganisationDraft,
  storeOrganisationDraft,
  onboardingKey,
} from "../src/lib/onboarding-request.ts";
const draft = {
  requestId: "a9000000-0000-4000-8000-000000000001",
  name: "Retry Club",
  kind: "club" as const,
};
test("pending creation survives reload and remains account scoped", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  assert.equal(storeOrganisationDraft(storage, "a", draft), true);
  assert.deepEqual(readOrganisationDraft(storage, "a"), draft);
  assert.equal(readOrganisationDraft(storage, "b"), null);
  for (const value of [
    "bad-json",
    "null",
    JSON.stringify({ ...draft, requestId: "invalid" }),
    JSON.stringify({ ...draft, kind: "invalid" }),
    JSON.stringify({ ...draft, name: " " }),
  ]) {
    data.set(onboardingKey("a"), value);
    assert.equal(readOrganisationDraft(storage, "a"), null);
  }
});
test("blocked browser storage reports unavailable persistence without throwing", () => {
  const storage = {
    getItem: () => {
      throw Error("blocked");
    },
    setItem: () => {
      throw Error("blocked");
    },
  };
  assert.equal(readOrganisationDraft(storage, "a"), null);
  assert.equal(storeOrganisationDraft(storage, "a", draft), false);
});
