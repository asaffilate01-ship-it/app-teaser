export type Region = {
  code: string;
  country: string;
  currency: string;
  clubPrice: string;
  period: string;
  note: string;
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
    clubPrice: "₨2,500",
    period: "per team / month",
    note: "Local pricing for Pakistan clubs.",
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
export function pricingRegionFor(networkCountry: string | null | undefined, locales: readonly string[] = []): Region {
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
