import { z } from "zod";
import type { CricketMatch } from "./cricket";
import { allFieldZones } from "./field-positions.ts";
import { validateVideoSpeedEvidence } from "./speed-evidence.ts";
export const scorerStorageKey = "criclume.matches.v1";
const text = z.string();
const count = z.number().int().nonnegative();
const zone = z.enum(allFieldZones);
const end = z.enum(["Pavilion", "Far"]);
const positiveCount = z.number().int().positive();
const point = z.looseObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
const rainMethod = z.enum(["arr", "mpo", "dls", "manual"]);
const retirement = z.looseObject({
  batterId: text,
  kind: z.enum(["hurt", "out", "timed-out"]),
  afterBall: count,
  prevStrikerId: text,
  prevNonStrikerId: text,
  replacementId: text.optional(),
  at: text,
});
const rain = z.looseObject({
  method: rainMethod,
  revisedOvers: positiveCount.nullable().optional(),
  officialTarget: count.nullable().optional(),
  officialPar: count.nullable().optional(),
  abandoned: z.boolean().optional(),
  minOversForResult: count.nullable().optional(),
});
const matchDays = z.looseObject({
  current: positiveCount,
  atStumps: z.boolean(),
  closes: z.array(
    z.looseObject({
      day: positiveCount,
      inningsIndex: count,
      battingTeamId: text,
      runs: z.number().int(),
      wickets: count,
      overs: text,
      note: text.optional(),
      at: text,
    }),
  ),
  timeUp: z.boolean().optional(),
});
const team = z.looseObject({
  id: text,
  name: text,
  players: z.array(z.looseObject({ id: text, name: text })),
});
const delivery = z
  .looseObject({
    id: text,
    sequence: count,
    recordedAt: text,
    over: count,
    ball: count,
    legal: z.boolean(),
    strikerId: text,
    nonStrikerId: text,
    bowlerId: text,
    end,
    deliveryStyle: z.enum(["Fast", "Medium", "Off spin", "Leg spin", "Left-arm spin", "Other"]),
    outcome: z.enum(["hit", "hit-no-run", "left", "missed", "wicket"]),
    batterRuns: count,
    extras: z.looseObject({
      wide: count,
      noBall: count,
      bye: count,
      legBye: count,
      penalty: count,
    }),
    fieldZone: zone,
    fielderId: text.optional(),
    note: text.optional(),
    freeHit: z.boolean().optional(),
    speedKph: z.number().nonnegative().optional(),
    speedEvidence: z.unknown().optional(),
    wicketPenalty: count.optional(),
    pitch: point.optional(),
    beehive: point.optional(),
    dismissal: z
      .looseObject({
        type: z.enum([
          "bowled",
          "caught",
          "lbw",
          "stumped",
          "run-out",
          "hit-wicket",
          "obstructing-the-field",
        ]),
        batterId: text,
        fielderId: text.optional(),
        catchZone: zone.optional(),
      })
      .optional(),
  })
  .refine((value) => {
    if (value.speedEvidence === undefined) return true;
    const evidence = validateVideoSpeedEvidence(value.speedEvidence);
    return evidence !== null && evidence.kph === value.speedKph;
  });
const match = z
  .looseObject({
    id: text.min(1),
    createdAt: text,
    updatedAt: text,
    status: z.enum(["live", "innings-break", "completed"]),
    settings: z.looseObject({
      format: z.enum([
        "T10",
        "T20",
        "ODI",
        "The Hundred",
        "Tape-ball",
        "Indoor",
        "School",
        "Club",
        "Multi-day",
        "Custom",
      ]),
      oversPerInnings: z.number().positive().nullable(),
      inningsPerSide: z.union([z.literal(1), z.literal(2)]),
      ballsPerOver: z.number().int().positive(),
      ground: text,
      weather: text,
      startTime: text,
      rules: z
        .looseObject({
          freeHit: z.boolean().optional(),
          superOver: z.boolean().optional(),
          lastManStands: z.boolean().optional(),
          followOnLead: count.nullable().optional(),
          rainMethod: rainMethod.optional(),
          days: positiveCount.optional(),
          youthBowling: z
            .enum(["U13", "U14", "U15", "U16", "U17", "U18", "U19"])
            .nullable()
            .optional(),
          pairs: z
            .looseObject({ oversPerPair: positiveCount, runsPerWicket: count })
            .nullable()
            .optional(),
          endsChangeEvery: positiveCount.nullable().optional(),
        })
        .optional(),
    }),
    rain: rain.optional(),
    days: matchDays.optional(),
    stoppage: z
      .looseObject({ reason: z.enum(["rain", "bad-light", "wet-outfield", "other"]), since: text })
      .nullable()
      .optional(),
    toss: z.looseObject({ winnerTeamId: text, decision: z.enum(["bat", "bowl"]) }).optional(),
    audience: z.looseObject({ commentary: z.boolean().optional() }).optional(),
    conditions: z
      .looseObject({
        pitch: z.enum(["batting", "balanced", "bowling"]),
        outfield: z.enum(["fast", "average", "slow"]),
        weather: z.enum(["clear", "overcast"]),
        dew: z.boolean(),
        edge: z.number().min(-2).max(2),
      })
      .optional(),
    teams: z.tuple([team, team]),
    innings: z
      .array(
        z.looseObject({
          id: text,
          number: count,
          battingTeamId: text,
          bowlingTeamId: text,
          strikerId: text,
          nonStrikerId: text,
          bowlerId: text,
          end,
          status: z.enum(["live", "completed"]),
          deliveries: z.array(delivery),
          kind: z.enum(["regular", "super-over"]).optional(),
          declared: z.boolean().optional(),
          unfinished: z.boolean().optional(),
          followOn: z.boolean().optional(),
          retirements: z.array(retirement).optional(),
        }),
      )
      .min(1),
  })
  .refine(
    (m) =>
      m.teams[0].id !== m.teams[1].id &&
      m.innings.every(
        (i) =>
          i.battingTeamId !== i.bowlingTeamId &&
          m.teams.some((t) => t.id === i.battingTeamId) &&
          m.teams.some((t) => t.id === i.bowlingTeamId) &&
          (i.retirements ?? []).every((item) => item.afterBall <= i.deliveries.length),
      ),
  );
const matchesSchema = z
  .array(match)
  .refine((rows) => new Set(rows.map((r) => r.id)).size === rows.length);
/**
 * Validate an untrusted cloud event before allowing it to replace any local
 * scoreboard data. Preserve versioned unknown fields as the storage parser does.
 * A syntactically plausible object with missing deliveries is never trusted.
 */
export function readScorerSnapshot(value: unknown, matchId: string): CricketMatch | null {
  if (!value || typeof value !== "object") return null;
  if ((value as { id?: unknown }).id !== matchId) return null;
  return match.safeParse(value).success ? (value as CricketMatch) : null;
}

/** Validate without discarding unknown fields from a newer scorer version. */
export function parseScorerMatches(raw: string): CricketMatch[] {
  const value: unknown = JSON.parse(raw);
  matchesSchema.parse(value);
  return value as CricketMatch[];
}

export const maxBackupBytes = 10 * 1024 * 1024;
export const maxBackupMatches = 100;
export function parseScorerBackup(raw: string): CricketMatch[] {
  if (new TextEncoder().encode(raw).byteLength > maxBackupBytes)
    throw new Error("Choose a backup smaller than 10 MB.");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("This file is not valid JSON. Choose a CricLume match export or backup.");
  }
  const rows = Array.isArray(value) ? value : [value];
  if (rows.length === 0 || rows.length > maxBackupMatches)
    throw new Error("Choose a backup containing 1 to 100 matches.");
  if (!matchesSchema.safeParse(rows).success)
    throw new Error(
      "The backup contains incomplete or unsupported match data. Nothing has been imported.",
    );
  return rows as CricketMatch[];
}
/** Copies never reuse a cloud or existing local match identity. */
export function copyBackupMatches(
  matches: CricketMatch[],
  newId: () => string = () => crypto.randomUUID(),
): CricketMatch[] {
  return matches.map((match) => ({ ...structuredClone(match), id: `restored-${newId()}` }));
}

export const scorerWriteLock = "criclume:matches:v1:write";
/** Call while holding the shared browser lock; a stale reader must never overwrite newer data. */
export function commitScorerSnapshot(
  storage: Pick<Storage, "getItem" | "setItem">,
  expected: string | null,
  next: string,
): { saved: true } | { saved: false; current: string | null } {
  const current = storage.getItem(scorerStorageKey);
  if (current !== expected) return { saved: false, current };
  storage.setItem(scorerStorageKey, next);
  return { saved: true };
}
