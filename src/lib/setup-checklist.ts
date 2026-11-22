export type SetupStepId = "club" | "teams" | "players" | "team" | "match";

export interface SetupStep {
  id: SetupStepId;
  title: string;
  detail: string;
  done: boolean;
  section: "overview" | "players" | "operations";
}

export interface SetupCounts {
  teams: number;
  players: number;
  members: number;
  matches: number;
}

/**
 * First-run checklist for a new club or league. A match needs two teams with
 * at least two registered players each, so "teams" needs 2 and "players" 4.
 */
export function buildSetupChecklist(counts: SetupCounts): SetupStep[] {
  return [
    { id: "club", title: "Create your club", detail: "Done — you are the owner.", done: true, section: "overview" },
    {
      id: "teams",
      title: "Add two teams",
      detail: "Your XI and the opposition, so a match can be set up.",
      done: counts.teams >= 2,
      section: "players",
    },
    {
      id: "players",
      title: "Register players",
      detail: "At least two players in each team.",
      done: counts.players >= 4,
      section: "players",
    },
    {
      id: "team",
      title: "Invite a scorer or coach",
      detail: "Share the work on match day.",
      done: counts.members >= 2,
      section: "operations",
    },
    {
      id: "match",
      title: "Start your first match",
      detail: "Pick the teams and format, then score ball by ball.",
      done: counts.matches >= 1,
      section: "overview",
    },
  ];
}

export function setupProgress(steps: SetupStep[]): { done: number; total: number; percent: number } {
  const done = steps.filter((step) => step.done).length;
  return { done, total: steps.length, percent: Math.round((done / steps.length) * 100) };
}
