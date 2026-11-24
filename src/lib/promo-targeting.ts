/**
 * Pure rules for CricLume ad banners: who sees which ad (by place) and the order they rotate in.
 * Shared by the server (choosing ads) and the staff desk (previewing a place).
 */
export type PromoSlot = "top" | "side";
export type PromoSurface = "ground" | "scoreboard" | "app";
export type PromoKind = "image" | "video" | "house";
/** Who placed an advert: CricLume-sold (earns clubs a share), the club itself, or iTechLounge's own house adverts. */
export type PromoSource = "paid" | "club" | "house";

export interface VisitorPlace {
  country: string | null;
  region: string | null;
  regionCode: string | null;
  city: string | null;
}

export interface PromoTarget {
  countries: string[];
  regions: string[];
  cities: string[];
}

/** What a screen receives for one banner. */
export interface PromoItem {
  creativeId: string;
  slot: PromoSlot;
  kind: PromoKind;
  url: string;
  durationSeconds: number;
  advertiser: string;
  alt: string;
  clickUrl: string | null;
  /** Missing on older payloads: treat as a paid CricLume advert. */
  source?: PromoSource;
  /** Text card for house adverts (no media file). */
  card?: { headline: string; line: string; cta: string };
}

export const noPlace: VisitorPlace = { country: null, region: null, regionCode: null, city: null };

/** Recommended artwork sizes (shown on the staff desk). */
export const slotArtwork: Record<PromoSlot, { label: string; size: string; ratio: string }> = {
  top: { label: "Top banner", size: "1600 × 200 px", ratio: "8 / 1" },
  side: { label: "Side banner", size: "600 × 1200 px", ratio: "1 / 2" },
};

const blankCountries = new Set(["", "XX", "T1"]);

/** Lower-case, trim and strip accents so "Lahore", " lahore " and "Láhore" match. */
export function normalisePlace(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** "Lahore, Karachi;  Islamabad" -> ["Lahore", "Karachi", "Islamabad"] (no blanks or repeats). */
export function parsePlaceList(input: string, options: { countryCodes?: boolean } = {}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,;\n]/)) {
    const value = options.countryCodes ? raw.trim().toUpperCase() : raw.trim().replace(/\s+/g, " ");
    if (!value) continue;
    if (options.countryCodes && !/^[A-Z]{2}$/.test(value)) continue;
    const key = normalisePlace(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value.slice(0, 80));
  }
  return out;
}

/** Location from the edge network's request details (country / region / city); unknown parts stay null. */
export function readVisitorPlace(
  header: (name: string) => string | null | undefined,
  cf?: Record<string, unknown> | null,
): VisitorPlace {
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  const country = (text(cf?.["country"]) ?? text(header("cf-ipcountry")) ?? "").toUpperCase();
  return {
    country: blankCountries.has(country) || !/^[A-Z]{2}$/.test(country) ? null : country,
    region: text(cf?.["region"]) ?? text(header("cf-region")),
    regionCode: text(cf?.["regionCode"]) ?? text(header("cf-region-code")),
    city: text(cf?.["city"]) ?? text(header("cf-ipcity")),
  };
}

/** An ad with no places runs everywhere; each list that is filled in must match the visitor. */
export function matchesTarget(target: PromoTarget, place: VisitorPlace): boolean {
  if (target.countries.length > 0) {
    if (!place.country || !target.countries.some((code) => code.toUpperCase() === place.country))
      return false;
  }
  if (target.regions.length > 0) {
    const mine = [normalisePlace(place.region), normalisePlace(place.regionCode)].filter(Boolean);
    if (
      mine.length === 0 ||
      !target.regions.some((region) => mine.includes(normalisePlace(region)))
    )
      return false;
  }
  if (target.cities.length > 0) {
    const city = normalisePlace(place.city);
    if (!city || !target.cities.some((value) => normalisePlace(value) === city)) return false;
  }
  return true;
}

/** How local an ad is: city-targeted ads come before region, country and everywhere ads. */
export function targetSpecificity(target: PromoTarget): number {
  if (target.cities.length > 0) return 3;
  if (target.regions.length > 0) return 2;
  if (target.countries.length > 0) return 1;
  return 0;
}

/**
 * Rotation order for one banner: an ad with weight 3 shows three times as often as weight 1,
 * spread out rather than back to back. Ties keep the given order.
 */
export function buildRotation<T extends { weight: number }>(items: T[]): T[] {
  const remaining = items.map((item) => Math.max(1, Math.min(10, Math.round(item.weight))));
  const total = remaining.reduce((sum, value) => sum + value, 0);
  const credit = items.map(() => 0);
  const order: T[] = [];
  // Smooth weighted round-robin.
  for (let step = 0; step < total; step++) {
    let best = -1;
    for (let index = 0; index < items.length; index++) {
      if (remaining[index]! <= 0) continue;
      credit[index]! += remaining[index]!;
      if (best === -1 || credit[index]! > credit[best]!) best = index;
    }
    if (best === -1) break;
    credit[best]! -= total;
    order.push(items[best]!);
  }
  return order.length > 0 ? order : items;
}

/** Choose and order the ads a visitor in `place` should see, most local first, then by weight. */
export function choosePromos<T extends PromoTarget & { weight: number; slot: PromoSlot }>(
  candidates: T[],
  place: VisitorPlace,
  limitPerSlot = 12,
): Record<PromoSlot, T[]> {
  const fitting = candidates
    .filter((item) => matchesTarget(item, place))
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        targetSpecificity(b.item) - targetSpecificity(a.item) ||
        b.item.weight - a.item.weight ||
        a.index - b.index,
    )
    .map(({ item }) => item);
  const pick = (slot: PromoSlot) =>
    buildRotation(fitting.filter((item) => item.slot === slot).slice(0, limitPerSlot));
  return { top: pick("top"), side: pick("side") };
}

/** How long one ad stays on screen: images use their set time; videos play through, capped at a minute. */
export function promoDwellMs(item: Pick<PromoItem, "kind" | "durationSeconds">): number {
  const seconds = Math.max(3, Math.min(60, Math.round(item.durationSeconds || 10)));
  return (item.kind === "video" ? 60 : seconds) * 1000;
}

/**
 * Fill each banner in order: paid CricLume adverts always win; when none are booked the club's
 * own adverts run; when the club has none either, iTechLounge's house adverts run.
 */
export function fillPromoSlots(
  paid: Record<PromoSlot, PromoItem[]>,
  club: Record<PromoSlot, PromoItem[]>,
  house: Record<PromoSlot, PromoItem[]>,
): Record<PromoSlot, PromoItem[]> {
  const pick = (slot: PromoSlot) =>
    paid[slot].length > 0 ? paid[slot] : club[slot].length > 0 ? club[slot] : house[slot];
  return { top: pick("top"), side: pick("side") };
}

/** Only CricLume-sold adverts are counted; club and house adverts earn no revenue share. */
export function countsTowardShare(item: Pick<PromoItem, "source">): boolean {
  return (item.source ?? "paid") === "paid";
}
