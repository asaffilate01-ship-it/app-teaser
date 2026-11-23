/**
 * Where a club plays: country → province/state → region/district → town/city.
 * Place lists come from the open GeoNames data set, one file per country in /public/geo,
 * fetched only when a country is picked. Anything not listed can be typed in.
 */
import { liveCountryCodes } from "@/lib/live-centre";

export interface GeoRegion {
  n: string;
  t: string[];
}
export interface GeoProvince {
  n: string;
  r: GeoRegion[];
  /** Towns not tied to a region (or the province has no regions). */
  t: string[];
}
export interface GeoCountry {
  v: 1;
  p: GeoProvince[];
}

export interface PlaceValue {
  country: string;
  province: string;
  district: string;
  town: string;
}

export const emptyPlace: PlaceValue = { country: "", province: "", district: "", town: "" };

/** Countries with a place list (same list clubs pick from on Live scores). */
export const geoCountryCodes: readonly string[] = liveCountryCodes;

const cache = new Map<string, Promise<GeoCountry | null>>();

export function loadCountryPlaces(code: string): Promise<GeoCountry | null> {
  if (!/^[A-Z]{2}$/.test(code) || !geoCountryCodes.includes(code)) return Promise.resolve(null);
  let pending = cache.get(code);
  if (!pending) {
    pending = fetch(`/geo/${code}.json`)
      .then((response) => (response.ok ? (response.json() as Promise<GeoCountry>) : null))
      .catch(() => null);
    pending.then((value) => {
      if (!value) cache.delete(code);
    });
    cache.set(code, pending);
  }
  return pending;
}

export function provinceNames(country: GeoCountry | null): string[] {
  return country ? country.p.map((province) => province.n) : [];
}

function findProvince(country: GeoCountry | null, province: string): GeoProvince | undefined {
  return country?.p.find((item) => item.n === province);
}

/** Regions inside a province; empty when the province has none (then towns come straight after). */
export function regionNames(country: GeoCountry | null, province: string): string[] {
  return findProvince(country, province)?.r.map((region) => region.n) ?? [];
}

/** Towns for the chosen province and region. */
export function townNames(country: GeoCountry | null, province: string, district: string): string[] {
  const found = findProvince(country, province);
  if (!found) return [];
  if (found.r.length === 0) return found.t;
  const region = found.r.find((item) => item.n === district);
  return region ? region.t : [];
}

/** What to call each level in a country ("State" in India, "County" in the US…). */
export function placeLabels(country: string): { province: string; district: string; town: string } {
  const province: Record<string, string> = {
    IN: "State", US: "State", AU: "State", MY: "State", NG: "State", DE: "State",
    GB: "Nation", IE: "Province", CA: "Province", PK: "Province", ZA: "Province", LK: "Province",
    AE: "Emirate", NZ: "Region", KE: "County", BD: "Division", NL: "Province", FR: "Region",
  };
  const district: Record<string, string> = {
    GB: "County or area", US: "County", IE: "County", IN: "District", PK: "District", BD: "District",
    LK: "District", NP: "District", AF: "District", ZA: "District", AU: "Area", CA: "Area",
  };
  return {
    province: province[country] ?? "Province or state",
    district: district[country] ?? "Region or district",
    town: "Town or city",
  };
}

/** Trimmed, length-capped place ready to save (matches the database limits). */
export function cleanPlace(value: PlaceValue): PlaceValue {
  return {
    country: /^[A-Z]{2}$/.test(value.country) ? value.country : "",
    province: value.province.trim().slice(0, 60),
    district: value.district.trim().slice(0, 80),
    town: value.town.trim().slice(0, 80),
  };
}

/** "Model Town, Lahore, Punjab" — most specific first, blanks skipped, repeats dropped. */
export function placeLine(value: Partial<PlaceValue>): string {
  const parts = [value.town, value.district, value.province].map((part) => part?.trim() ?? "").filter(Boolean);
  return parts.filter((part, index) => parts.indexOf(part) === index).join(", ");
}
