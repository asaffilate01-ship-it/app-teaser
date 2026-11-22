/**
 * Fielding position catalogue for the scorer's field picker.
 * Angles are degrees clockwise from the keeper (0) for a right-handed batter: leg side 0–180, off side 180–360.
 * Each named position also rolls up into one of nine broad areas so charts and old records keep working.
 */

export const fieldAreas = [
  "Fine leg",
  "Square leg",
  "Mid-wicket",
  "Long on",
  "Straight",
  "Long off",
  "Cover",
  "Point",
  "Third",
] as const;
export type FieldArea = (typeof fieldAreas)[number];

/** Inside-the-ring and deep positions, one pair per slice of the ground. */
export const ringSectors = [
  { start: 0, end: 33, area: "Fine leg", inner: "Short fine leg", innerLabel: ["Short", "fine"], deep: "Fine leg", deepLabel: ["Fine", "leg"] },
  { start: 33, end: 66, area: "Square leg", inner: "Backward square leg", innerLabel: ["Back", "square"], deep: "Deep backward square", deepLabel: ["Deep", "back sq"] },
  { start: 66, end: 99, area: "Square leg", inner: "Square leg", innerLabel: ["Square", "leg"], deep: "Deep square leg", deepLabel: ["Deep", "square"] },
  { start: 99, end: 132, area: "Mid-wicket", inner: "Mid-wicket", innerLabel: ["Mid-", "wicket"], deep: "Deep mid-wicket", deepLabel: ["Deep", "mid-wkt"] },
  { start: 132, end: 165, area: "Long on", inner: "Mid-on", innerLabel: ["Mid-on"], deep: "Long on", deepLabel: ["Long", "on"] },
  { start: 165, end: 195, area: "Straight", inner: "Straight", innerLabel: ["Straight"], deep: "Long straight", deepLabel: ["Long", "straight"] },
  { start: 195, end: 228, area: "Long off", inner: "Mid-off", innerLabel: ["Mid-off"], deep: "Long off", deepLabel: ["Long", "off"] },
  { start: 228, end: 261, area: "Cover", inner: "Extra cover", innerLabel: ["Extra", "cover"], deep: "Deep extra cover", deepLabel: ["Deep", "ex cover"] },
  { start: 261, end: 294, area: "Cover", inner: "Cover", innerLabel: ["Cover"], deep: "Deep cover", deepLabel: ["Deep", "cover"] },
  { start: 294, end: 327, area: "Point", inner: "Point", innerLabel: ["Point"], deep: "Deep point", deepLabel: ["Deep", "point"] },
  { start: 327, end: 360, area: "Third", inner: "Gully", innerLabel: ["Gully"], deep: "Third man", deepLabel: ["Third", "man"] },
] as const;

/** Close catchers sit too near the bat to tap on a small drawing, so they are offered as buttons. */
export const closeCatchers = [
  { name: "First slip", label: "1st slip", area: "Third" },
  { name: "Second slip", label: "2nd slip", area: "Third" },
  { name: "Third slip", label: "3rd slip", area: "Third" },
  { name: "Silly point", label: "Silly point", area: "Point" },
  { name: "Silly mid-off", label: "Silly mid-off", area: "Long off" },
  { name: "Silly mid-on", label: "Silly mid-on", area: "Long on" },
  { name: "Short leg", label: "Short leg", area: "Square leg" },
  { name: "Leg slip", label: "Leg slip", area: "Fine leg" },
] as const;

type RingPosition = (typeof ringSectors)[number]["inner" | "deep"];
type ClosePosition = (typeof closeCatchers)[number]["name"];

export type FieldZone = FieldArea | RingPosition | ClosePosition | "Keeper" | "Bowler" | "Not recorded";

export const allFieldZones = Array.from(
  new Set<FieldZone>([
    ...fieldAreas,
    ...ringSectors.flatMap((sector) => [sector.inner, sector.deep]),
    ...closeCatchers.map((catcher) => catcher.name),
    "Keeper",
    "Bowler",
    "Not recorded",
  ]),
) as [FieldZone, ...FieldZone[]];

export type ZoneDepth = "close" | "ring" | "deep" | "centre";

export interface ZoneInfo {
  area: FieldArea | "Keeper" | "Bowler";
  depth: ZoneDepth;
  side: "leg" | "off" | "straight" | "centre";
}

const info = new Map<string, ZoneInfo>();
const sideOf = (start: number): ZoneInfo["side"] => (start === 165 ? "straight" : start < 165 ? "leg" : "off");
for (const sector of ringSectors) {
  info.set(sector.inner.toLowerCase(), { area: sector.area, depth: "ring", side: sideOf(sector.start) });
  info.set(sector.deep.toLowerCase(), { area: sector.area, depth: "deep", side: sideOf(sector.start) });
}
for (const catcher of closeCatchers) {
  const side = ["Third", "Point", "Long off"].includes(catcher.area) ? "off" : "leg";
  info.set(catcher.name.toLowerCase(), { area: catcher.area, depth: "close", side });
}
info.set("keeper", { area: "Keeper", depth: "centre", side: "centre" });
info.set("bowler", { area: "Bowler", depth: "centre", side: "centre" });
// Older records saved only the broad area.
info.set("third", { area: "Third", depth: "deep", side: "off" });

/** Depth, side and broad area for a saved position name (case-insensitive). Unknown names return undefined. */
export function zoneInfo(zone: string | null | undefined): ZoneInfo | undefined {
  return info.get((zone ?? "").trim().replace(/\s+/g, " ").toLowerCase());
}

/** The broad area a position belongs to, used by the wagon wheel and analysis ground. */
export function zoneArea(zone: string | null | undefined): ZoneInfo["area"] | undefined {
  return zoneInfo(zone)?.area;
}
