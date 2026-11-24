import assert from "node:assert/strict";

/** A tiny compatibility bridge for legacy assertion wording.
 * Tests run on node:test, never on an uninstalled Vitest/Bun runner. */
export function expect(actual: unknown) {
  const contains = (value: unknown): boolean => {
    if (typeof actual === "string") return actual.includes(String(value));
    return Array.isArray(actual) && actual.some((entry: unknown) => Object.is(entry, value));
  };
  return {
    toBe(expected: unknown) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected: unknown) {
      assert.deepStrictEqual(actual, expected);
    },
    toContain(value: unknown) {
      assert.equal(contains(value), true);
    },
    toHaveLength(length: number) {
      assert.equal((actual as { length?: number } | null)?.length, length);
    },
    toBeNull() {
      assert.strictEqual(actual, null);
    },
    toBeLessThanOrEqual(limit: number) {
      assert.ok(typeof actual === "number" && actual <= limit);
    },
    not: {
      toContain(value: unknown) {
        assert.equal(contains(value), false);
      },
    },
  };
}
