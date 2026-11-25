import type { CricketMatch, DeliveryEnd, DeliveryStyle, FieldZone } from "./cricket.ts";
import { allFieldZones } from "./field-positions.ts";

/**
 * Per-match scoring duties. The database (`my_match_duties`, `append_match_event`,
 * `tag_delivery_v1`) is the real gate; these helpers only decide what each screen shows.
 */
export type ScoringDuty = "lead" | "batting" | "bowling" | "video";

export const scoringDuties: { id: ScoringDuty; label: string; detail: string }[] = [
  {
    id: "lead",
    label: "Lead scorer",
    detail: "Everything: balls, bowling, fielding, corrections and video.",
  },
  {
    id: "batting",
    label: "Batting & runs",
    detail: "Records every ball: runs, extras, wickets and who's on strike.",
  },
  {
    id: "bowling",
    label: "Bowling & fielding",
    detail: "Picks the bowler and adds fielder, fielding position and ball type.",
  },
  {
    id: "video",
    label: "Video feed",
    detail: "Runs the camera room and phones. Can't change the score.",
  },
];

export function dutyLabel(duty: ScoringDuty): string {
  return scoringDuties.find((item) => item.id === duty)?.label ?? duty;
}

export function isScoringDuty(value: unknown): value is ScoringDuty {
  return value === "lead" || value === "batting" || value === "bowling" || value === "video";
}

export interface DutyAccess {
  /** Record, undo and correct balls; start innings; match settings. */
  recordBalls: boolean;
  /** Choose the bowler and add fielding details to recorded balls. */
  bowlingFielding: boolean;
  /** Run the camera room. */
  video: boolean;
  /** On the match's scoring team at all. */
  onTeam: boolean;
}

export function dutyAccess(duties: readonly string[]): DutyAccess {
  const has = (duty: ScoringDuty) => duties.includes("lead") || duties.includes(duty);
  const recordBalls = has("batting");
  const bowlingFielding = has("bowling");
  const video = has("video");
  return { recordBalls, bowlingFielding, video, onTeam: recordBalls || bowlingFielding || video };
}

export interface ScoringTeamMember {
  userId: string;
  name: string;
  clubRole: string;
  duties: ScoringDuty[];
  /** Club owners/admins: always every duty. */
  alwaysFull: boolean;
}

/**
 * Should this person's ball screen leave the bowler and fielding to someone else?
 * Only when another team member was named for "Bowling & fielding" and this person wasn't
 * (a lead who wants both jobs back gives themselves the duty, or removes it from the helper).
 */
export function bowlingHandledByOther(
  team: readonly ScoringTeamMember[],
  myUserId: string | null,
): boolean {
  const mine = team.find((member) => member.userId === myUserId);
  if (mine?.duties.includes("bowling")) return false;
  return team.some((member) => member.userId !== myUserId && member.duties.includes("bowling"));
}

/* ---------- Bowling & fielding notes that travel between phones ---------- */

export interface DeliveryTag {
  fieldZone?: FieldZone | undefined;
  /** Who fielded the ball ("" or null clears it). */
  fielderId?: string | null | undefined;
  /** Catcher / run-out fielder on a wicket ball. */
  dismissalFielderId?: string | null | undefined;
  deliveryStyle?: DeliveryStyle | undefined;
  /** Internal derived catch location used when compacting accepted patches. */
  catchZone?: FieldZone | undefined;
}

export type ScoringPatch =
  | {
      kind: "delivery.tagged";
      sequence: number;
      occurredAt: string;
      inningsId: string;
      deliveryId: string;
      tag: DeliveryTag;
    }
  | {
      kind: "bowling.updated";
      sequence: number;
      occurredAt: string;
      inningsId: string;
      bowlerId: string;
      end?: DeliveryEnd | undefined;
    };

export const patchEventTypes = ["delivery.tagged", "bowling.updated"] as const;

export function isPatchEventType(eventType: string): boolean {
  return (patchEventTypes as readonly string[]).includes(eventType);
}

const styles: readonly DeliveryStyle[] = [
  "Fast",
  "Medium",
  "Off spin",
  "Leg spin",
  "Left-arm spin",
  "Other",
];

function readTag(value: unknown): DeliveryTag | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const tag: DeliveryTag = {};
  if (raw["fieldZone"] !== undefined) {
    if (!(allFieldZones as readonly unknown[]).includes(raw["fieldZone"])) return null;
    tag.fieldZone = raw["fieldZone"] as FieldZone;
  }
  for (const key of ["fielderId", "dismissalFielderId"] as const) {
    const id = raw[key];
    if (id === undefined) continue;
    if (id !== null && typeof id !== "string") return null;
    tag[key] = id || null;
  }
  if (raw["deliveryStyle"] !== undefined) {
    if (!styles.includes(raw["deliveryStyle"] as DeliveryStyle)) return null;
    tag.deliveryStyle = raw["deliveryStyle"] as DeliveryStyle;
  }
  return tag;
}

/** Reads a received bowling/fielding event; anything malformed is ignored. */
export function readPatchEvent(event: {
  eventType: string;
  sequence: number;
  occurredAt?: string | undefined;
  payload: Record<string, unknown>;
}): ScoringPatch | null {
  if (
    !Number.isSafeInteger(event.sequence) ||
    event.sequence < 1 ||
    !event.payload ||
    typeof event.payload !== "object" ||
    Array.isArray(event.payload)
  )
    return null;
  const inningsId = event.payload["inningsId"];
  if (typeof inningsId !== "string" || !inningsId) return null;
  const occurredAt = event.occurredAt ?? new Date(0).toISOString();
  if (!Number.isFinite(Date.parse(occurredAt))) return null;
  if (event.eventType === "delivery.tagged") {
    const deliveryId = event.payload["deliveryId"];
    const tag = readTag(event.payload["tag"]);
    if (typeof deliveryId !== "string" || !deliveryId || !tag) return null;
    return {
      kind: "delivery.tagged",
      sequence: event.sequence,
      occurredAt,
      inningsId,
      deliveryId,
      tag,
    };
  }
  if (event.eventType === "bowling.updated") {
    const bowlerId = event.payload["bowlerId"];
    const end = event.payload["end"];
    if (typeof bowlerId !== "string" || !bowlerId) return null;
    if (end !== undefined && end !== "Pavilion" && end !== "Far") return null;
    return {
      kind: "bowling.updated",
      sequence: event.sequence,
      occurredAt,
      inningsId,
      bowlerId,
      ...(end ? { end: end as DeliveryEnd } : {}),
    };
  }
  return null;
}

/** Adds fielding notes to one recorded ball. Unknown balls or players are ignored. */
export function applyDeliveryTag(
  match: CricketMatch,
  inningsId: string,
  deliveryId: string,
  tag: DeliveryTag,
): CricketMatch {
  const inningsIndex = match.innings.findIndex((innings) => innings.id === inningsId);
  const innings = match.innings[inningsIndex];
  if (!innings) return match;
  const fielding = match.teams.find((team) => team.id === innings.bowlingTeamId);
  const fielder = (id: string | null | undefined) =>
    id ? fielding?.players.some((player) => player.id === id) : true;
  if (!fielder(tag.fielderId) || !fielder(tag.dismissalFielderId)) return match;
  let changed = false;
  const deliveries = innings.deliveries.map((ball) => {
    if (ball.id !== deliveryId) return ball;
    changed = true;
    const next = { ...ball };
    if (tag.fieldZone !== undefined) next.fieldZone = tag.fieldZone;
    if (tag.fielderId !== undefined) next.fielderId = tag.fielderId || undefined;
    if (tag.deliveryStyle !== undefined) next.deliveryStyle = tag.deliveryStyle;
    if (next.dismissal && tag.dismissalFielderId !== undefined) {
      next.dismissal = {
        ...next.dismissal,
        fielderId: tag.dismissalFielderId || undefined,
        ...(next.dismissal.type === "caught" && tag.fieldZone && tag.fieldZone !== "Not recorded"
          ? { catchZone: tag.fieldZone }
          : {}),
      };
    }
    if (next.dismissal?.type === "caught" && tag.catchZone !== undefined) {
      next.dismissal = { ...next.dismissal, catchZone: tag.catchZone };
    }
    return next;
  });
  if (!changed) return match;
  const allInnings = match.innings.slice();
  allInnings[inningsIndex] = { ...innings, deliveries };
  return { ...match, innings: allInnings };
}

/**
 * Sets the bowler for the next ball. Ignored once a newer ball has been recorded (the change is
 * stale), for innings that aren't being played, or for a player not in the fielding side.
 */
export function applyBowlingUpdate(
  match: CricketMatch,
  inningsId: string,
  bowlerId: string,
  occurredAt: string,
  end?: DeliveryEnd,
): CricketMatch {
  const index = match.innings.length - 1;
  const innings = match.innings[index];
  if (!innings || innings.id !== inningsId || innings.status === "completed") return match;
  const fielding = match.teams.find((team) => team.id === innings.bowlingTeamId);
  if (!fielding?.players.some((player) => player.id === bowlerId)) return match;
  const last = innings.deliveries.at(-1);
  if (last && Date.parse(last.recordedAt) > Date.parse(occurredAt)) return match;
  if (innings.bowlerId === bowlerId && (!end || innings.end === end)) return match;
  const allInnings = match.innings.slice();
  allInnings[index] = { ...innings, bowlerId, ...(end ? { end } : {}) };
  return { ...match, innings: allInnings };
}

export function applyPatch(match: CricketMatch, patch: ScoringPatch): CricketMatch {
  return patch.kind === "delivery.tagged"
    ? applyDeliveryTag(match, patch.inningsId, patch.deliveryId, patch.tag)
    : applyBowlingUpdate(match, patch.inningsId, patch.bowlerId, patch.occurredAt, patch.end);
}

/** Re-applies every known note in the order the cloud accepted them (latest wins). */
export function applyPatches(match: CricketMatch, patches: Iterable<ScoringPatch>): CricketMatch {
  return [...patches]
    .sort((a, b) => a.sequence - b.sequence)
    .reduce((current, patch) => applyPatch(current, patch), match);
}

/** Keep the newest accepted value for each independent field, not merely each ball.
 * A late partial tag must not erase a newer field or unrelated earlier tags.
 * Pending local patches are deliberately not stored in this cloud ledger.
 */
export function rememberScoringPatch(
  ledger: Map<string, ScoringPatch>,
  patch: ScoringPatch,
): ScoringPatch[] {
  if (!Number.isSafeInteger(patch.sequence) || patch.sequence < 1) return [];
  const changed: ScoringPatch[] = [];
  const remember = (key: string, candidate: ScoringPatch) => {
    const previous = ledger.get(key);
    if (previous && previous.sequence >= candidate.sequence) return;
    ledger.set(key, candidate);
    changed.push(candidate);
  };
  if (patch.kind === "delivery.tagged") {
    const prefix = JSON.stringify([patch.inningsId, patch.deliveryId]);
    for (const field of ["fieldZone", "fielderId", "dismissalFielderId", "deliveryStyle"] as const) {
      const value = patch.tag[field];
      if (value === undefined) continue;
      const tag = { [field]: value } as DeliveryTag;
      remember(prefix + ":" + field, { ...patch, tag });
    }
    if (
      patch.tag.dismissalFielderId !== undefined &&
      patch.tag.fieldZone &&
      patch.tag.fieldZone !== "Not recorded"
    ) {
      remember(prefix + ":catchZone", { ...patch, tag: { catchZone: patch.tag.fieldZone } });
    }
  } else {
    // Bowler and end form a single assignment for the next delivery.
    remember(JSON.stringify(["bowler", patch.inningsId]), patch);
  }
  return changed;
}

export function pendingScoringPatches(
  events: readonly {
    eventType: string;
    occurredAt: string;
    payload: Record<string, unknown>;
  }[],
): ScoringPatch[] {
  return events
    .map((event) => readPatchEvent({ ...event, sequence: Number.MAX_SAFE_INTEGER }))
    .filter((patch): patch is ScoringPatch => patch !== null);
}

export const scoringPatchPageSize = 250;
export const scoringPatchMaxPages = 20;

/** Fetch accepted patches in sequence order, with an explicit recovery limit. */
export async function collectScoringPatches(
  afterSequence: number,
  loadPage: (after: number, limit: number) => Promise<readonly ScoringPatch[]>,
): Promise<ScoringPatch[]> {
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0)
    throw new Error("Invalid scoring patch cursor.");
  const patches: ScoringPatch[] = [];
  let cursor = afterSequence;
  for (let page = 0; page < scoringPatchMaxPages; page++) {
    const rows = await loadPage(cursor, scoringPatchPageSize);
    if (rows.length > scoringPatchPageSize) throw new Error("Invalid fielding history page.");
    for (const patch of rows) {
      if (!Number.isSafeInteger(patch.sequence) || patch.sequence <= cursor)
        throw new Error("Fielding history is out of order.");
      cursor = patch.sequence;
      patches.push(patch);
    }
    if (rows.length < scoringPatchPageSize) return patches;
  }
  throw new Error("Fielding history exceeds the recovery limit. Request scorer review.");
}

/** Balls the fielding scorer still needs to look at: newest first, wickets and untagged first. */
export function ballsNeedingFielding(match: CricketMatch, limit = 12) {
  const innings = match.innings.at(-1);
  if (!innings) return [];
  return innings.deliveries
    .slice(-limit)
    .reverse()
    .map((ball) => ({
      ball,
      needsFielding:
        (ball.fieldZone === "Not recorded" &&
          (ball.batterRuns > 0 || ball.extras.bye + ball.extras.legBye > 0)) ||
        (Boolean(ball.dismissal) &&
          ["caught", "run-out", "stumped"].includes(ball.dismissal!.type) &&
          !ball.dismissal!.fielderId),
    }));
}
