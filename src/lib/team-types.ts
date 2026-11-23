/** Kinds of team a club can run: senior XIs, women's, juniors and veterans. Stored on teams.category. */
export interface TeamCategory {
  id: string;
  label: string;
  group: "Senior" | "Women and girls" | "Juniors" | "Veterans and more";
  /** Saved as the team's age group so older screens keep working. */
  ageGroup: string;
}

const youth = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map(
  (age): TeamCategory => ({ id: `u${age}`, label: `Under ${age}s`, group: "Juniors", ageGroup: `U${age}` }),
);

export const teamCategories: TeamCategory[] = [
  { id: "first_xi", label: "1st XI", group: "Senior", ageGroup: "Open" },
  { id: "second_xi", label: "2nd XI", group: "Senior", ageGroup: "Open" },
  { id: "third_xi", label: "3rd XI", group: "Senior", ageGroup: "Open" },
  { id: "fourth_xi", label: "4th XI", group: "Senior", ageGroup: "Open" },
  { id: "sunday_xi", label: "Sunday XI", group: "Senior", ageGroup: "Open" },
  { id: "midweek_xi", label: "Midweek XI", group: "Senior", ageGroup: "Open" },
  { id: "t20", label: "T20 side", group: "Senior", ageGroup: "Open" },
  { id: "women", label: "Women / Ladies 1st XI", group: "Women and girls", ageGroup: "Open" },
  { id: "women_2nd", label: "Women / Ladies 2nd XI", group: "Women and girls", ageGroup: "Open" },
  { id: "girls", label: "Girls", group: "Women and girls", ageGroup: "Junior" },
  ...youth,
  { id: "over_40", label: "Over 40s / Veterans", group: "Veterans and more", ageGroup: "O40" },
  { id: "over_50", label: "Over 50s", group: "Veterans and more", ageGroup: "O50" },
  { id: "over_60", label: "Over 60s", group: "Veterans and more", ageGroup: "O60" },
  { id: "disability", label: "Disability cricket", group: "Veterans and more", ageGroup: "Open" },
  { id: "softball", label: "Softball / tape-ball", group: "Veterans and more", ageGroup: "Open" },
  { id: "other", label: "Other", group: "Veterans and more", ageGroup: "Open" },
];

export function teamCategory(id: string | null | undefined): TeamCategory | undefined {
  return teamCategories.find((item) => item.id === id);
}

/** "Riverside Cricket Club" + 2nd XI → "Riverside CC 2nd XI". */
export function suggestedTeamName(clubName: string, categoryId: string): string {
  const club = clubName.trim().replace(/\bcricket club\b/i, "CC").replace(/\s+/g, " ");
  const category = teamCategory(categoryId);
  if (!category || category.id === "other") return club;
  const label = category.id.startsWith("u") ? `U${category.id.slice(1)}` : category.label.replace(" / Ladies", "");
  return `${club} ${label}`.trim().slice(0, 120);
}

/** Short code for the team badge, e.g. "RIV2". */
export function suggestedShortName(teamName: string, categoryId: string): string {
  const letters = teamName.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  const suffix: Record<string, string> = {
    second_xi: "2", third_xi: "3", fourth_xi: "4", women: "W", women_2nd: "W2", girls: "G",
    sunday_xi: "S", midweek_xi: "M", t20: "T", over_40: "V", over_50: "50", over_60: "60",
  };
  const code = categoryId.startsWith("u") && /^u\d+$/.test(categoryId) ? categoryId.slice(1) : (suffix[categoryId] ?? "");
  return `${letters}${code}`.slice(0, 12);
}

export interface TeamAllowance {
  /** null = no limit. */
  limit: number | null;
  used: number;
}

export function canAddTeam(allowance: TeamAllowance): boolean {
  return allowance.limit === null || allowance.used < allowance.limit;
}
