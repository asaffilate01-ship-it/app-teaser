import test from "node:test";
import assert from "node:assert/strict";
import { parseFieldPlan, maxFieldPlanBytes } from "../src/lib/field-plan.ts";
import { initialField } from "../src/lib/spatial-analysis.ts";
const plan = { type: "criclume-field-plan", version: 1, schematic: true, positions: initialField };
test("export format reopens as fresh whitelisted positions without touching evidence", () => {
  const parsed = parseFieldPlan(
    JSON.stringify({
      ...plan,
      positions: initialField.map((p) => ({ ...p, name: ` ${p.name} `, delivery_id: "ignore" })),
    }),
  );
  assert.deepEqual(parsed, initialField);
  parsed[0]!.name = "Changed";
  assert.notEqual(initialField[0]!.name, "Changed");
  assert.equal("delivery_id" in parsed[0]!, false);
});
test("rejects unsupported format, truncated plans, invalid JSON and oversized uploads", () => {
  for (const value of [
    null,
    [],
    {},
    { ...plan, version: 2 },
    { ...plan, schematic: false },
    { ...plan, positions: initialField.slice(1) },
  ])
    assert.throws(() => parseFieldPlan(JSON.stringify(value)));
  assert.throws(() => parseFieldPlan("{"));
  assert.throws(() => parseFieldPlan(" ".repeat(maxFieldPlanBytes + 1)), /64 KB/);
});
test("rejects unnamed positions, nonnumeric/nonfinite coordinates and positions outside boundary", () => {
  for (const bad of [
    { name: "" },
    { name: "x".repeat(61) },
    { x: "2" },
    { x: null },
    { x: 40, z: 1 },
    { x: NaN },
    { x: Infinity },
  ])
    assert.throws(() =>
      parseFieldPlan(
        JSON.stringify({
          ...plan,
          positions: initialField.map((p, i) => (i === 0 ? { ...p, ...bad } : p)),
        }),
      ),
    );
  assert.throws(() => parseFieldPlan(JSON.stringify(plan).replace('"x":-21', '"x":1e999')));
});
test("boundary position and fractional coordinates are accepted without reinterpretation", () => {
  const p = initialField.map((f, i) =>
    i === 0 ? { ...f, x: 24, z: 32 } : i === 1 ? { ...f, x: 1.25, z: -2.5 } : f,
  );
  assert.deepEqual(parseFieldPlan(JSON.stringify({ ...plan, positions: p })), p);
});
