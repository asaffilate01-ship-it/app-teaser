/**
 * Scouting report for one player: batting, bowling and fielding analysis from every scored ball,
 * automatic strengths and weaknesses, plus the coach's own notes. The report is a frozen snapshot,
 * so a shared copy never changes after it is sent.
 */
import { isSuperOver, type CricketMatch, type Delivery, type DismissalType, type Innings } from "./cricket.ts";
import { zoneArea } from "./field-positions.ts";
import { playerProfile } from "./player-profile.ts";
import type { BattingStat, BowlingStat, FieldingStat } from "./season-stats.ts";

export type Phase = "powerplay" | "middle" | "death";
export type BowlingType = "Pace" | "Spin";

export interface BattingSplit {
  label: string;
  balls: number;
  runs: number;
  outs: number;
  strikeRate: number | null;
  average: number | null;
  dotPct: number | null;
}

export interface ScoutingReport {
  version: 1;
  generatedAt: string;
  player: { id: string; name: string; team: string };
  matches: number;
  batting: null | {
    stat: BattingStat | null;
    ballsFaced: number;
    dotPct: number;
    boundaryPct: number;
    scoringShotPct: number;
    runsByArea: { area: string; runs: number; pct: number }[];
    sides: { off: number; leg: number; straight: number };
    dismissals: { type: DismissalType; count: number }[];
    vsBowling: BattingSplit[];
    byPhase: BattingSplit[];
  };
  bowling: null | {
    stat: BowlingStat | null;
    balls: number;
    dotPct: number;
    boundaryPct: number;
    extrasPerOver: number;
    wicketTypes: { type: DismissalType; count: number }[];
    byPhase: { label: string; balls: number; runs: number; wickets: number; economy: number | null }[];
    styles: string[];
  };
  fielding: null | (FieldingStat & { positions: { position: string; count: number }[] });
  strengths: string[];
  weaknesses: string[];
  coach: CoachNotes;
}

export interface CoachNotes {
  strengths: string;
  weaknesses: string;
  notes: string;
  author: string;
}

const pct = (part: number, whole: number) => (whole ? Math.round((part * 1000) / whole) / 10 : 0);
const regular = (match: CricketMatch) => match.innings.filter((innings) => !isSuperOver(innings));
const spin = new Set(["Off spin", "Leg spin", "Left-arm spin"]);
export const bowlingType = (style: string): BowlingType | null => (spin.has(style) ? "Spin" : style === "Fast" || style === "Medium" ? "Pace" : null);

/** Powerplay = first 30% of the overs, death = last 20%; unlimited-overs matches have no phases. */
export function phaseOf(match: CricketMatch, ball: Delivery): Phase | null {
  const overs = match.settings.oversPerInnings;
  if (!overs) return null;
  const powerplay = Math.max(1, Math.round(overs * 0.3));
  const death = overs - Math.max(1, Math.round(overs * 0.2));
  return ball.over < powerplay ? "powerplay" : ball.over >= death ? "death" : "middle";
}
const phaseLabel: Record<Phase, string> = { powerplay: "Powerplay", middle: "Middle overs", death: "Death overs" };

function split(label: string, balls: Delivery[], playerId: string): BattingSplit {
  const faced = balls.filter((ball) => ball.extras.wide === 0);
  const runs = balls.reduce((sum, ball) => sum + ball.batterRuns, 0);
  const outs = balls.filter((ball) => ball.dismissal?.batterId === playerId).length;
  const dots = faced.filter((ball) => ball.batterRuns === 0).length;
  return {
    label,
    balls: faced.length,
    runs,
    outs,
    strikeRate: faced.length ? Math.round((runs * 1000) / faced.length) / 10 : null,
    average: outs ? Math.round((runs * 10) / outs) / 10 : null,
    dotPct: faced.length ? pct(dots, faced.length) : null,
  };
}

const counted = <T extends string>(items: T[]) =>
  [...items.reduce((map, item) => map.set(item, (map.get(item) ?? 0) + 1), new Map<T, number>()).entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

export function scoutingReport(matches: readonly CricketMatch[], playerId: string, coach: Partial<CoachNotes> = {}, now = new Date()): ScoutingReport | null {
  const profile = playerProfile(matches, playerId);
  if (!profile) return null;
  const faced: { match: CricketMatch; ball: Delivery }[] = [];
  const bowled: { match: CricketMatch; ball: Delivery }[] = [];
  const fieldedDismissals: Delivery[] = [];
  const outsAsBatter: Delivery[] = [];
  for (const match of matches) {
    for (const innings of regular(match) as Innings[]) {
      for (const ball of innings.deliveries) {
        if (ball.strikerId === playerId) faced.push({ match, ball });
        if (ball.bowlerId === playerId) bowled.push({ match, ball });
        if (ball.dismissal?.batterId === playerId) outsAsBatter.push(ball);
        if (ball.dismissal?.fielderId === playerId && ["caught", "stumped", "run-out"].includes(ball.dismissal.type)) fieldedDismissals.push(ball);
      }
    }
  }

  let batting: ScoutingReport["batting"] = null;
  const legalFaced = faced.filter((item) => item.ball.extras.wide === 0);
  if (legalFaced.length) {
    const runs = faced.reduce((sum, item) => sum + item.ball.batterRuns, 0);
    const areaRuns = new Map<string, number>();
    const sides = { off: 0, leg: 0, straight: 0 };
    for (const { ball } of faced) {
      if (!ball.batterRuns) continue;
      const area = zoneArea(ball.fieldZone);
      if (!area || area === "Keeper" || area === "Bowler") continue;
      areaRuns.set(area, (areaRuns.get(area) ?? 0) + ball.batterRuns);
      if (["Fine leg", "Square leg", "Mid-wicket", "Long on"].includes(area)) sides.leg += ball.batterRuns;
      else if (area === "Straight") sides.straight += ball.batterRuns;
      else sides.off += ball.batterRuns;
    }
    const placed = [...areaRuns.values()].reduce((a, b) => a + b, 0);
    const vsBowling = (["Pace", "Spin"] as const)
      .map((type) => split(`v ${type.toLowerCase()}`, faced.filter((item) => bowlingType(item.ball.deliveryStyle) === type).map((item) => item.ball), playerId))
      .filter((item) => item.balls > 0);
    const byPhase = (["powerplay", "middle", "death"] as const)
      .map((phase) => split(phaseLabel[phase], faced.filter((item) => phaseOf(item.match, item.ball) === phase).map((item) => item.ball), playerId))
      .filter((item) => item.balls > 0);
    batting = {
      stat: profile.batting,
      ballsFaced: legalFaced.length,
      dotPct: pct(legalFaced.filter((item) => item.ball.batterRuns === 0).length, legalFaced.length),
      boundaryPct: pct(legalFaced.filter((item) => item.ball.batterRuns === 4 || item.ball.batterRuns === 6).length, legalFaced.length),
      scoringShotPct: pct(legalFaced.filter((item) => item.ball.batterRuns > 0).length, legalFaced.length),
      runsByArea: [...areaRuns.entries()].map(([area, value]) => ({ area, runs: value, pct: pct(value, placed) })).sort((a, b) => b.runs - a.runs),
      sides: { off: pct(sides.off, placed), leg: pct(sides.leg, placed), straight: pct(sides.straight, placed) },
      dismissals: counted(outsAsBatter.map((ball) => ball.dismissal!.type)).map(({ key, count }) => ({ type: key, count })),
      vsBowling,
      byPhase,
    };
    void runs;
  }

  let bowling: ScoutingReport["bowling"] = null;
  const legalBowled = bowled.filter((item) => item.ball.legal);
  if (legalBowled.length) {
    const charged = (ball: Delivery) => ball.batterRuns + ball.extras.wide + ball.extras.noBall;
    const byPhase = (["powerplay", "middle", "death"] as const)
      .map((phase) => {
        const balls = bowled.filter((item) => phaseOf(item.match, item.ball) === phase).map((item) => item.ball);
        const legal = balls.filter((ball) => ball.legal).length;
        const runs = balls.reduce((sum, ball) => sum + charged(ball), 0);
        const ballsPerOver = matches[0]?.settings.ballsPerOver ?? 6;
        return { label: phaseLabel[phase], balls: legal, runs, wickets: balls.filter((ball) => ball.dismissal && ball.dismissal.type !== "run-out").length, economy: legal ? Math.round((runs * ballsPerOver * 100) / legal) / 100 : null };
      })
      .filter((item) => item.balls > 0);
    const extras = bowled.reduce((sum, item) => sum + item.ball.extras.wide + item.ball.extras.noBall, 0);
    bowling = {
      stat: profile.bowling,
      balls: legalBowled.length,
      dotPct: pct(legalBowled.filter((item) => charged(item.ball) === 0).length, legalBowled.length),
      boundaryPct: pct(bowled.filter((item) => item.ball.batterRuns === 4 || item.ball.batterRuns === 6).length, legalBowled.length),
      extrasPerOver: Math.round((extras * 6 * 100) / legalBowled.length) / 100,
      wicketTypes: counted(bowled.filter((item) => item.ball.dismissal && item.ball.dismissal.type !== "run-out").map((item) => item.ball.dismissal!.type)).map(({ key, count }) => ({ type: key, count })),
      byPhase,
      styles: counted(bowled.map((item) => item.ball.deliveryStyle)).filter((item) => item.key !== "Other").map((item) => item.key),
    };
  }

  const fielding: ScoutingReport["fielding"] = profile.fielding
    ? { ...profile.fielding, positions: counted(fieldedDismissals.map((ball) => ball.dismissal?.catchZone || ball.fieldZone).filter((zone) => zone && zone !== "Not recorded") as string[]).map(({ key, count }) => ({ position: key, count })) }
    : null;

  const { strengths, weaknesses } = autoNotes(batting, bowling, fielding);
  return {
    version: 1,
    generatedAt: now.toISOString(),
    player: { id: playerId, name: profile.name, team: profile.team },
    matches: profile.matches,
    batting,
    bowling,
    fielding,
    strengths,
    weaknesses,
    coach: { strengths: coach.strengths?.trim() ?? "", weaknesses: coach.weaknesses?.trim() ?? "", notes: coach.notes?.trim() ?? "", author: coach.author?.trim() ?? "" },
  };
}

const dismissalWord: Record<string, string> = { bowled: "bowled", caught: "caught", lbw: "LBW", stumped: "stumped", "run-out": "run out", "hit-wicket": "hit wicket", "obstructing-the-field": "obstructing" };

/** Plain-English strengths and weaknesses, only when there are enough balls to say so. */
export function autoNotes(batting: ScoutingReport["batting"], bowling: ScoutingReport["bowling"], fielding: ScoutingReport["fielding"]) {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (batting && batting.ballsFaced >= 30) {
    const sr = batting.stat?.strikeRate ?? 0;
    if (sr >= 130) strengths.push(`Scores quickly — strike rate ${sr.toFixed(0)}`);
    if (batting.dotPct >= 55) weaknesses.push(`Lots of dot balls (${batting.dotPct}% of balls faced)`);
    else if (batting.dotPct <= 35) strengths.push(`Rotates the strike well (only ${batting.dotPct}% dot balls)`);
    const top = batting.runsByArea[0];
    if (top && top.pct >= 30) strengths.push(`Main scoring area: ${top.area} (${top.pct}% of runs)`);
    if (batting.sides.off >= 65) weaknesses.push(`Rarely scores on the leg side (${batting.sides.leg}% of runs)`);
    if (batting.sides.leg >= 65) weaknesses.push(`Rarely scores on the off side (${batting.sides.off}% of runs)`);
    const [pace, spinSplit] = [batting.vsBowling.find((item) => item.label === "v pace"), batting.vsBowling.find((item) => item.label === "v spin")];
    if (pace && spinSplit && pace.balls >= 18 && spinSplit.balls >= 18 && pace.strikeRate != null && spinSplit.strikeRate != null) {
      const gap = spinSplit.strikeRate - pace.strikeRate;
      if (gap >= 25) { strengths.push(`Strong against spin (SR ${spinSplit.strikeRate} v ${pace.strikeRate} against pace)`); weaknesses.push("Slower against pace"); }
      if (gap <= -25) { strengths.push(`Strong against pace (SR ${pace.strikeRate} v ${spinSplit.strikeRate} against spin)`); weaknesses.push("Slower against spin"); }
    }
    const outs = batting.dismissals.reduce((sum, item) => sum + item.count, 0);
    const often = batting.dismissals[0];
    if (often && outs >= 3 && often.count / outs >= 0.5) weaknesses.push(`Often out ${dismissalWord[often.type] ?? often.type} (${often.count} of ${outs} dismissals)`);
    const death = batting.byPhase.find((item) => item.label === "Death overs");
    if (death && death.balls >= 18 && (death.strikeRate ?? 0) >= 150) strengths.push(`Finisher — strike rate ${death.strikeRate} at the death`);
  }
  if (bowling && bowling.balls >= 60) {
    if (bowling.dotPct >= 50) strengths.push(`Builds pressure (${bowling.dotPct}% dot balls)`);
    if (bowling.extrasPerOver >= 1) weaknesses.push(`Gives away extras (${bowling.extrasPerOver} wides/no-balls an over)`);
    if (bowling.boundaryPct >= 15) weaknesses.push(`Hit for boundaries often (${bowling.boundaryPct}% of balls)`);
    const wickets = bowling.wicketTypes.reduce((sum, item) => sum + item.count, 0);
    const stumps = bowling.wicketTypes.filter((item) => item.type === "bowled" || item.type === "lbw").reduce((sum, item) => sum + item.count, 0);
    if (wickets >= 4 && stumps / wickets >= 0.5) strengths.push(`Attacks the stumps (${stumps} of ${wickets} wickets bowled or LBW)`);
    const death = bowling.byPhase.find((item) => item.label === "Death overs");
    if (death && death.balls >= 24 && death.economy != null && bowling.stat?.economy != null && death.economy <= bowling.stat.economy) strengths.push(`Holds up at the death (economy ${death.economy})`);
  }
  if (fielding) {
    if (fielding.catches >= 3) strengths.push(`Reliable catcher (${fielding.catches} catches)`);
    if (fielding.runOuts >= 2) strengths.push(`Sharp in the field (${fielding.runOuts} run outs)`);
    if (fielding.stumpings >= 2) strengths.push(`Quick hands behind the stumps (${fielding.stumpings} stumpings)`);
  }
  return { strengths, weaknesses };
}
