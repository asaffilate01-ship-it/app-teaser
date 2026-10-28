import { z } from "zod";
import type { CricketMatch } from "./cricket";
export const scorerStorageKey = "criclume.matches.v1";
const text = z.string();
const count = z.number().int().nonnegative();
const zone = z.enum([
  "Fine leg",
  "Square leg",
  "Mid-wicket",
  "Long on",
  "Straight",
  "Long off",
  "Cover",
  "Point",
  "Third",
  "Keeper",
  "Bowler",
  "Not recorded",
]);
const end = z.enum(["Pavilion", "Far"]);
const team = z.looseObject({
  id: text,
  name: text,
  players: z.array(z.looseObject({ id: text, name: text })),
});
const delivery = z.looseObject({
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
  extras: z.looseObject({ wide: count, noBall: count, bye: count, legBye: count, penalty: count }),
  fieldZone: zone,
  fielderId: text.optional(),
  note: text.optional(),
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
});
const match = z
  .looseObject({
    id: text.min(1),
    createdAt: text,
    updatedAt: text,
    status: z.enum(["live", "innings-break", "completed"]),
    settings: z.looseObject({
      format: z.enum(["T10", "T20", "ODI", "School", "Club", "Multi-day", "Custom"]),
      oversPerInnings: z.number().positive().nullable(),
      inningsPerSide: z.union([z.literal(1), z.literal(2)]),
      ballsPerOver: z.number().int().positive(),
      ground: text,
      weather: text,
      startTime: text,
    }),
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
          m.teams.some((t) => t.id === i.bowlingTeamId),
      ),
  );
const matchesSchema = z
  .array(match)
  .refine((rows) => new Set(rows.map((r) => r.id)).size === rows.length);
/** Validate without discarding unknown fields from a newer scorer version. */
export function parseScorerMatches(raw: string): CricketMatch[] {
  const value: unknown = JSON.parse(raw);
  matchesSchema.parse(value);
  return value as CricketMatch[];
}
