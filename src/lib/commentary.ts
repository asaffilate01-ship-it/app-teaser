import type { Delivery, Innings } from "./cricket.ts";
import { zoneInfo } from "./field-positions.ts";

export type CommentaryTone = "wicket" | "six" | "four" | "extra" | "dot" | "run" | "over";

export interface CommentaryLine {
  id: string;
  /** "12.3" for a ball, "End of over 12" for a summary line. */
  over: string;
  text: string;
  tone: CommentaryTone;
}

export interface CommentaryNames {
  /** Resolve a player id to a display name. Return undefined to fall back to the role. */
  player?: ((id: string | undefined) => string | undefined) | undefined;
  battingTeam?: string | undefined;
  /** The match plays free hits after no-balls. */
  freeHits?: boolean | undefined;
}

const roles = { striker: "the batter", bowler: "the bowler", fielder: "the fielder", nonStriker: "the non-striker" };

function hash(text: string) {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) value = (value * 31 + text.charCodeAt(index)) >>> 0;
  return value;
}

const pick = <T,>(options: readonly T[], seed: string) => options[hash(seed) % options.length]!;

const where = (zone: Delivery["fieldZone"]) => {
  if (zone === "Not recorded") return "";
  const info = zoneInfo(zone);
  if (zone === "Keeper") return " to the keeper";
  if (zone === "Bowler") return " back to the bowler";
  return info?.depth === "close" ? ` to ${zone.toLowerCase()}` : ` towards ${zone.toLowerCase()}`;
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Plain-English line for one delivery. Without a name resolver it only uses roles, so it is safe to show publicly. */
export function describeBall(ball: Delivery, names: CommentaryNames = {}): CommentaryLine {
  const name = (id: string | undefined, role: string) => names.player?.(id) ?? role;
  const batter = name(ball.strikerId, roles.striker);
  const bowler = name(ball.bowlerId, roles.bowler);
  const fielder = ball.fielderId ? names.player?.(ball.fielderId) : undefined;
  const lead = `${capital(bowler)} to ${batter}`;
  const place = where(ball.fieldZone);
  const overLabel = `${ball.over}.${ball.ball}`;
  const seed = ball.id;
  const base = { id: ball.id, over: overLabel };

  if (ball.dismissal) {
    const out = ball.dismissal.batterId === ball.strikerId ? batter : name(ball.dismissal.batterId, roles.nonStriker);
    const catcher = name(ball.dismissal.fielderId, roles.fielder);
    const catchAt = ball.dismissal.catchZone && ball.dismissal.catchZone !== "Not recorded" ? ` at ${ball.dismissal.catchZone.toLowerCase()}` : "";
    const text = {
      bowled: pick([`BOWLED! ${capital(bowler)} knocks back the stumps. ${capital(out)} has to go.`, `BOWLED him! Through the gate, and ${out} is gone.`], seed),
      caught: pick([`OUT! Caught by ${catcher}${catchAt}. ${capital(out)} has to go.`, `CAUGHT! ${capital(out)} picks out ${catcher}${catchAt}.`], seed),
      lbw: `OUT, LBW! ${capital(bowler)} traps ${out} in front.`,
      stumped: `STUMPED! ${capital(out)} is out of the crease and ${catcher} whips off the bails.`,
      "run-out": `RUN OUT! ${capital(out)} is short of the crease${ball.dismissal.fielderId ? `, ${catcher} with the throw` : ""}.`,
      "hit-wicket": `HIT WICKET! ${capital(out)} treads on the stumps.`,
      "obstructing-the-field": `OUT, obstructing the field. ${capital(out)} has to go.`,
    }[ball.dismissal.type];
    return { ...base, text: `${ball.freeHit ? "Free hit. " : ""}${lead}. ${text}`, tone: "wicket" };
  }

  const { wide, noBall, bye, legBye, penalty } = ball.extras;
  if (wide) {
    const extra = wide - 1;
    return { ...base, text: `${lead}. Wide${extra > 0 ? `, and they run ${extra} more` : ""}. ${wide} added to the total.`, tone: "extra" };
  }
  if (noBall) {
    const hit = ball.batterRuns === 6 ? "SIX off it!" : ball.batterRuns === 4 ? "FOUR off it!" : ball.batterRuns ? `${ball.batterRuns} off the bat.` : "";
    return { ...base, text: `${lead}. No-ball, overstepped. ${hit}${names.freeHits ? " Free hit to come." : ""}`.replace(/\s+/g, " ").trim(), tone: "extra" };
  }
  if (bye || legBye) {
    const runs = bye || legBye;
    return { ...base, text: `${lead}. ${runs} ${bye ? "bye" : "leg bye"}${runs === 1 ? "" : "s"}.`, tone: "extra" };
  }
  if (penalty) return { ...base, text: `${lead}. ${penalty} penalty runs awarded.`, tone: "extra" };

  if (ball.batterRuns === 6) {
    return { ...base, text: `${ball.freeHit ? "Free hit! " : ""}${lead}. ${pick(["SIX! Launched", "SIX! Clean strike, sent", "SIX! That's huge, deposited"], seed)}${place || " into the crowd"}.`, tone: "six" };
  }
  if (ball.batterRuns === 4) {
    return { ...base, text: `${ball.freeHit ? "Free hit! " : ""}${lead}. ${pick(["FOUR! Timed beautifully", "FOUR! Finds the gap", "FOUR! Races away"], seed)}${place}.`, tone: "four" };
  }
  if (ball.batterRuns > 0) {
    const run = ball.batterRuns === 1 ? "single" : ball.batterRuns === 2 ? "couple" : `${ball.batterRuns} runs`;
    const verb = pick(["worked", "pushed", "nudged", "driven"], seed);
    return { ...base, text: `${lead}. ${capital(ball.batterRuns === 1 ? "a single" : ball.batterRuns === 2 ? "two runs" : run)}, ${verb}${place}${fielder ? `, ${fielder} fields` : ""}.`, tone: "run" };
  }
  const dot =
    ball.freeHit && ball.batterRuns === 0
      ? "Free hit, but no run from it."
      : ball.outcome === "left"
      ? "Left alone outside off."
      : ball.outcome === "missed"
        ? pick(["Beaten! Plays and misses.", "Past the edge."], seed)
        : `No run, ${pick(["defended", "blocked", "pushed"], seed)}${place}${fielder ? `, ${fielder} stops it` : ""}.`;
  return { ...base, text: `${lead}. ${dot}`, tone: "dot" };
}

/** Commentary for an innings, newest first, with an "end of over" summary after each completed over. */
export function commentaryFeed(innings: Innings, ballsPerOver: number, names: CommentaryNames = {}, limit?: number): CommentaryLine[] {
  const lines: CommentaryLine[] = [];
  let runs = 0;
  let wickets = 0;
  let legal = 0;
  let overRuns = 0;
  let overWickets = 0;
  for (const ball of innings.deliveries) {
    const total = ball.batterRuns + ball.extras.wide + ball.extras.noBall + ball.extras.bye + ball.extras.legBye + ball.extras.penalty;
    runs += total;
    overRuns += total;
    if (ball.dismissal) {
      wickets += 1;
      overWickets += 1;
    }
    lines.push(describeBall(ball, names));
    if (ball.legal) {
      legal += 1;
      if (legal % ballsPerOver === 0) {
        const team = names.battingTeam ?? "Batting side";
        lines.push({
          id: `${ball.id}-over`,
          over: `End of over ${legal / ballsPerOver}`,
          text: `${overRuns === 0 ? "Maiden over" : `${overRuns} run${overRuns === 1 ? "" : "s"}`}${overWickets ? `, ${overWickets} wicket${overWickets === 1 ? "" : "s"}` : ""}. ${team} ${runs}/${wickets}.`,
          tone: "over",
        });
        overRuns = 0;
        overWickets = 0;
      }
    }
  }
  const newest = lines.reverse();
  return limit ? newest.slice(0, limit) : newest;
}
