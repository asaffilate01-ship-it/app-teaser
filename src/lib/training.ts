/** Training helpers: drill library, attendance rates and fitness progress. */
export interface Drill {
  id: string;
  name: string;
  skill: "Batting" | "Bowling" | "Fielding" | "Keeping" | "Fitness" | "Game sense";
  minutes: number;
  detail: string;
}

export const drillLibrary: readonly Drill[] = [
  { id: "warm-up", name: "Dynamic warm-up", skill: "Fitness", minutes: 10, detail: "Jog, lunges, leg swings, high knees, quick feet." },
  { id: "throwdowns-front", name: "Throwdowns: front foot drive", skill: "Batting", minutes: 15, detail: "Full balls on off stump; head over the ball, high elbow, check the follow-through." },
  { id: "throwdowns-short", name: "Throwdowns: pull and hook", skill: "Batting", minutes: 15, detail: "Short balls with a tennis or incrediball; roll the wrists, keep it down." },
  { id: "running", name: "Running between the wickets", skill: "Batting", minutes: 10, detail: "Calling, turning on the bat, sliding the bat in. Pairs race to 3." },
  { id: "spot-bowling", name: "Target bowling", skill: "Bowling", minutes: 15, detail: "Cone on a good length outside off; score 2 for a hit, 1 near it. Six-ball sets." },
  { id: "yorkers", name: "Death bowling: yorkers", skill: "Bowling", minutes: 15, detail: "Shoe at the crease as a target; mix in a slower ball each over." },
  { id: "spin-loop", name: "Spin: flight and loop", skill: "Bowling", minutes: 15, detail: "Bowl over a raised rope at 2 m to get loop and dip." },
  { id: "high-catches", name: "High catches", skill: "Fielding", minutes: 10, detail: "Catches from a bat or machine; fingers up, soft hands, call early." },
  { id: "slip-cordon", name: "Slip cordon", skill: "Fielding", minutes: 10, detail: "Edges off a angled bat; low, ready, watch the ball off the bat." },
  { id: "pick-up-throw", name: "Pick-up and throw", skill: "Fielding", minutes: 10, detail: "Attack the ball, one-handed pick-up, throw at one stump. Time it." },
  { id: "keeping-takes", name: "Keeping: takes and stumpings", skill: "Keeping", minutes: 15, detail: "Up to the stumps for spinners; stay low, rise with the ball." },
  { id: "middle-practice", name: "Middle practice", skill: "Game sense", minutes: 30, detail: "Match scenario: 30 needed off 4 overs with 5 wickets left." },
  { id: "sprints", name: "Repeat sprints", skill: "Fitness", minutes: 10, detail: "6 × 20 m sprints, walk back recovery." },
  { id: "cool-down", name: "Cool-down and stretch", skill: "Fitness", minutes: 10, detail: "Easy jog, then hamstrings, quads, hip flexors and shoulders." },
];

export interface FitnessTest {
  id: string;
  name: string;
  unit: string;
  /** Faster times are better for sprints and the 2 km run. */
  lowerIsBetter: boolean;
}

export const fitnessTests: readonly FitnessTest[] = [
  { id: "sprint_20m", name: "20 m sprint", unit: "s", lowerIsBetter: true },
  { id: "run_a_three", name: "Run-a-three", unit: "s", lowerIsBetter: true },
  { id: "yoyo_ir1", name: "Yo-Yo IR1 level", unit: "level", lowerIsBetter: false },
  { id: "beep", name: "Beep test level", unit: "level", lowerIsBetter: false },
  { id: "run_2k", name: "2 km run", unit: "min", lowerIsBetter: true },
  { id: "vertical_jump", name: "Vertical jump", unit: "cm", lowerIsBetter: false },
  { id: "plank", name: "Plank hold", unit: "s", lowerIsBetter: false },
];

export const fitnessTest = (id: string) => fitnessTests.find((t) => t.id === id);

/** Share of sessions attended (present or late), as a whole percent; excused sessions don't count against. */
export function attendanceRate(statuses: readonly string[]): number | null {
  const counted = statuses.filter((s) => s !== "excused");
  if (!counted.length) return null;
  return Math.round((counted.filter((s) => s === "present" || s === "late").length / counted.length) * 100);
}

export interface FitnessPoint { recorded_on: string; value: number }

/** Oldest-first results and whether the latest is an improvement on the first. */
export function fitnessProgress(points: readonly FitnessPoint[], testId: string) {
  const sorted = [...points].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on));
  const first = sorted[0];
  const last = sorted.at(-1);
  const lower = fitnessTest(testId)?.lowerIsBetter ?? false;
  const change = first && last && sorted.length > 1 ? Math.round((last.value - first.value) * 100) / 100 : null;
  return { points: sorted, change, improved: change === null ? null : lower ? change < 0 : change > 0 };
}

export const planMinutes = (plan: readonly { minutes: number }[]) => plan.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
