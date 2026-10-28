import test from "node:test";
import assert from "node:assert/strict";
import { readSection, platformSections, publicSections } from "../src/lib/navigation.ts";

test("only supported section query values reach public and workspace navigation", () => {
  assert.equal(readSection("analysis", platformSections), "analysis");
  assert.equal(readSection("screens", publicSections), "screens");
  for (const value of [
    undefined,
    null,
    "",
    "ANALYSIS",
    "unknown",
    ["analysis"],
    { section: "analysis" },
    1,
  ]) {
    assert.equal(readSection(value, platformSections), undefined);
  }
  assert.equal(readSection("operations", publicSections), undefined);
});
