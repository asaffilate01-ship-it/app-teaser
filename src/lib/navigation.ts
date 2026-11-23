export const publicSections = ["home", "features", "screens", "pricing", "faq", "login"] as const;
export const platformSections = [
  "overview",
  "office",
  "training",
  "messages",
  "leaguedesk",
  "board",
  "competitions",
  "league",
  "website",
  "capture",
  "players",
  "academy",
  "safety",
  "analysis",
  "intelligence",
  "operations",
] as const;
export function readSection<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : undefined;
}
