import type { FieldPosition } from "./spatial-analysis.ts";
export const maxFieldPlanBytes = 64 * 1024;
export function parseFieldPlan(text: string): FieldPosition[] {
  if (new TextEncoder().encode(text).length > maxFieldPlanBytes)
    throw new Error("Field plan must be smaller than 64 KB.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Choose a valid CricLume field-plan JSON file.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid field plan.");
  const plan = value as Record<string, unknown>;
  if (plan["type"] !== "criclume-field-plan" || plan["version"] !== 1 || plan["schematic"] !== true)
    throw new Error("This file is not a supported CricLume schematic field plan.");
  if (!Array.isArray(plan["positions"]) || plan["positions"].length !== 11)
    throw new Error("A field plan must contain exactly 11 positions.");
  return plan["positions"].map((raw: unknown, index: number) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error(`Position ${index + 1} is invalid.`);
    const p = raw as Record<string, unknown>;
    if (typeof p["name"] !== "string" || !p["name"].trim() || p["name"].length > 60)
      throw new Error(`Position ${index + 1} needs a name of 1–60 characters.`);
    if (
      typeof p["x"] !== "number" ||
      typeof p["z"] !== "number" ||
      !Number.isFinite(p["x"]) ||
      !Number.isFinite(p["z"]) ||
      Math.hypot(p["x"], p["z"]) > 40
    )
      throw new Error(`Position ${index + 1} must be inside the field boundary.`);
    return { name: p["name"].trim(), x: p["x"], z: p["z"] };
  });
}
