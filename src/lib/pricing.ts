export type Region = {
  code: string;
  country: string;
  currency: string;
  clubPrice: string;
  period: string;
  note: string;
  /** Set only where a league price is published; otherwise the page says "Custom". */
  leaguePrice?: string;
  leaguePeriod?: string;
  leagueNote?: string;
  /** Set only where the video add-on is priced; otherwise the page says "quoted per club". */
  addonPrice?: string;
  addonPeriod?: string;
};

// Locally relevant, affordable pricing per market (Club plan, per team / month).
export const regions: Region[] = [
  {
    code: "GB",
    country: "United Kingdom",
    currency: "GBP",
    clubPrice: "£29",
    period: "per team / month",
    note: "Prices exclude VAT.",
  },
  {
    code: "US",
    country: "United States",
    currency: "USD",
    clubPrice: "$35",
    period: "per team / month",
    note: "Prices exclude local sales tax.",
  },
  {
    code: "EU",
    country: "Europe",
    currency: "EUR",
    clubPrice: "€32",
    period: "per team / month",
    note: "Prices exclude VAT.",
  },
  {
    code: "PK",
    country: "Pakistan",
    currency: "PKR",
    clubPrice: "₨25,000",
    period: "per team / year",
    note: "Yearly prices for Pakistan clubs and leagues.",
    leaguePrice: "from ₨15,000",
    leaguePeriod: "per team / year",
    leagueNote:
      "Teams 1–10: ₨20,000 each · teams 11–20: ₨17,500 · teams 21+ (divisions): ₨15,000. Each band is charged only on the teams in it.",
    addonPrice: "₨25,000",
    addonPeriod: "per club team / year (₨50,000 with the Club plan) · ₨20,000 per league team",
  },
  {
    code: "IN",
    country: "India",
    currency: "INR",
    clubPrice: "₹1,499",
    period: "per team / month",
    note: "Local pricing for Indian clubs. GST extra.",
  },
  {
    code: "AE",
    country: "United Arab Emirates",
    currency: "AED",
    clubPrice: "AED 129",
    period: "per team / month",
    note: "Prices exclude 5% VAT.",
  },
  {
    code: "SA",
    country: "Saudi Arabia",
    currency: "SAR",
    clubPrice: "SAR 129",
    period: "per team / month",
    note: "Prices exclude 15% VAT.",
  },
  {
    code: "LK",
    country: "Sri Lanka",
    currency: "LKR",
    clubPrice: "Rs 4,900",
    period: "per team / month",
    note: "Local pricing for Sri Lankan clubs.",
  },
  {
    code: "BD",
    country: "Bangladesh",
    currency: "BDT",
    clubPrice: "৳1,900",
    period: "per team / month",
    note: "Local pricing for Bangladeshi clubs.",
  },
  {
    code: "CA",
    country: "Canada",
    currency: "CAD",
    clubPrice: "C$45",
    period: "per team / month",
    note: "Prices exclude GST/HST.",
  },
  {
    code: "AU",
    country: "Australia",
    currency: "AUD",
    clubPrice: "A$49",
    period: "per team / month",
    note: "Prices exclude GST.",
  },
  {
    code: "NZ",
    country: "New Zealand",
    currency: "NZD",
    clubPrice: "NZ$52",
    period: "per team / month",
    note: "Prices exclude GST.",
  },
  {
    code: "ZA",
    country: "South Africa",
    currency: "ZAR",
    clubPrice: "R349",
    period: "per team / month",
    note: "Local pricing for South African clubs.",
  },
  {
    code: "ZW",
    country: "Zimbabwe",
    currency: "USD",
    clubPrice: "$15",
    period: "per team / month",
    note: "Billed in USD for Zimbabwe clubs.",
  },
  {
    code: "KE",
    country: "Kenya",
    currency: "KES",
    clubPrice: "KSh 2,200",
    period: "per team / month",
    note: "Local pricing for Kenyan clubs.",
  },
  {
    code: "AF",
    country: "Afghanistan",
    currency: "AFN",
    clubPrice: "؋1,200",
    period: "per team / month",
    note: "Local pricing for Afghan clubs.",
  },
];

export const defaultRegion = regions[0]!;

export function findRegion(code: string | null | undefined): Region | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase();
  const direct = regions.find((r) => r.code === upper);
  if (direct) return direct;
  if (EU_COUNTRIES.has(upper)) return regions.find((r) => r.code === "EU");
  return undefined;
}

const EU_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

/** Get the region from a browser language tag without making any network requests. */
export function regionFromLocale(locale: string | null | undefined): string | null {
  if (!locale) return null;
  const parts = locale.replaceAll("_", "-").split("-");
  const region = parts.slice(1).find((part) => /^[A-Za-z]{2}$/.test(part));
  return region ? region.toUpperCase() : null;
}

/**
 * The price list a visitor sees by default.
 * The country comes from our own hosting network (no third-party lookups, nothing stored);
 * only when that is unknown do we fall back to the browser's language setting.
 * Any country not on our list is shown UK prices in GBP.
 */
export function pricingRegionFor(
  networkCountry: string | null | undefined,
  locales: readonly string[] = [],
): Region {
  if (networkCountry) return findRegion(networkCountry) ?? defaultRegion;
  for (const locale of locales) {
    const code = regionFromLocale(locale);
    if (code) return findRegion(code) ?? defaultRegion;
  }
  return defaultRegion;
}

/** Browser language tags, safely (empty during server rendering). */
export function browserLocales(): string[] {
  try {
    if (typeof navigator === "undefined") return [];
    return [navigator.language, ...(navigator.languages ?? [])].filter(Boolean);
  } catch {
    return [];
  }
}

/** Pakistan yearly prices (PKR). Must match the Pakistan entry in `regions`. */
export const pakistanPrices = {
  clubPerTeam: 25_000,
  clubVideoPerTeam: 25_000,
  leagueBands: [
    { upTo: 10, perTeam: 20_000 },
    { upTo: 20, perTeam: 17_500 },
    { upTo: Infinity, perTeam: 15_000 },
  ],
  leagueVideoPerTeam: 20_000,
} as const;

/** A Pakistan club's yearly fee: per team, video doubles it. */
export function pakistanClubFee(teams: number, options: { video?: boolean } = {}): number {
  const count = Math.max(0, Math.floor(teams));
  return (
    count * (pakistanPrices.clubPerTeam + (options.video ? pakistanPrices.clubVideoPerTeam : 0))
  );
}

/** A Pakistan league's yearly fee: each price band applies only to the teams inside it, plus video per team. */
export function pakistanLeagueFee(teams: number, options: { video?: boolean } = {}): number {
  const count = Math.max(0, Math.floor(teams));
  let total = 0;
  let from = 0;
  for (const band of pakistanPrices.leagueBands) {
    const inBand = Math.max(0, Math.min(count, band.upTo) - from);
    total += inBand * band.perTeam;
    from = band.upTo;
    if (count <= from) break;
  }
  return total + (options.video ? count * pakistanPrices.leagueVideoPerTeam : 0);
}
