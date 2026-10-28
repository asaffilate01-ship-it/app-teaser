import test from "node:test";
import assert from "node:assert/strict";
import { defaultEvidenceFilters, evidencePageRequest } from "../src/lib/evidence-library.ts";
test("evidence pages fetch one sentinel row without skipping a displayed item", () => {
  assert.deepEqual(evidencePageRequest(defaultEvidenceFilters, 0), {
    from: 0,
    to: 24,
    pattern: null,
  });
  assert.deepEqual(evidencePageRequest(defaultEvidenceFilters, 1), {
    from: 24,
    to: 48,
    pattern: null,
  });
  assert.equal(evidencePageRequest(defaultEvidenceFilters, 5).from, 120);
  for (const page of [-1, 0.5, NaN, Infinity, 100001])
    assert.throws(() => evidencePageRequest(defaultEvidenceFilters, page));
});
test("filenames are literal substrings, including SQL pattern characters", () => {
  assert.equal(
    evidencePageRequest({ ...defaultEvidenceFilters, search: "  shot_50%\\take  " }, 0).pattern,
    "%shot\\_50\\%\\\\take%",
  );
  assert.equal(evidencePageRequest({ ...defaultEvidenceFilters, search: "   " }, 0).pattern, null);
  assert.throws(() =>
    evidencePageRequest({ ...defaultEvidenceFilters, search: "x".repeat(151) }, 0),
  );
  assert.throws(() =>
    evidencePageRequest({ ...defaultEvidenceFilters, kind: "invalid" as "image" }, 0),
  );
  assert.throws(() =>
    evidencePageRequest({ ...defaultEvidenceFilters, people: "invalid" as "adult" }, 0),
  );
});
