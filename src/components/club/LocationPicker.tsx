import { useEffect, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import {
  geoCountryCodes,
  loadCountryPlaces,
  placeLabels,
  provinceNames,
  regionNames,
  townNames,
  type GeoCountry,
  type PlaceValue,
} from "@/lib/geo";
import { countryFlag, countryName } from "@/lib/live-centre";

const OTHER = "__other__";

/**
 * Country → province/state → region/district → town/city, each list filtered by the one before.
 * Every level has a "not listed" choice so no club is ever stuck.
 */
export function LocationPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: PlaceValue;
  onChange: (next: PlaceValue) => void;
  disabled?: boolean;
}) {
  const [places, setPlaces] = useState<GeoCountry | null>(null);
  const [loading, setLoading] = useState(false);
  const [typed, setTyped] = useState({ province: false, district: false, town: false });

  useEffect(() => {
    let active = true;
    setPlaces(null);
    if (!value.country) return;
    setLoading(true);
    void loadCountryPlaces(value.country).then((data) => {
      if (!active) return;
      setPlaces(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [value.country]);

  const provinces = provinceNames(places);
  const regions = regionNames(places, value.province);
  const towns = townNames(places, value.province, value.district);
  const hasProvinces = provinces.length > 0;
  const provinceTyped = typed.province || !hasProvinces || (value.province !== "" && !provinces.includes(value.province));
  const hasRegions = !provinceTyped && regions.length > 0;
  const districtTyped = typed.district || provinceTyped || (value.district !== "" && hasRegions && !regions.includes(value.district));
  const townsListed = !districtTyped && towns.length > 0;
  const townTyped = typed.town || !townsListed || (value.town !== "" && !towns.includes(value.town));
  const labels = placeLabels(value.country);
  const showDistrict = value.province !== "" && (hasRegions || districtTyped);
  const showTown = value.province !== "" && (!hasRegions || value.district !== "" || districtTyped);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Level label="Country">
        <select
          className="scorer-input"
          value={value.country}
          disabled={disabled}
          onChange={(event) => {
            setTyped({ province: false, district: false, town: false });
            onChange({ country: event.target.value, province: "", district: "", town: "" });
          }}
        >
          <option value="">Choose country</option>
          {[...geoCountryCodes]
            .map((code) => ({ code, name: countryName(code) }))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(({ code, name }) => (
              <option key={code} value={code}>
                {countryFlag(code)} {name}
              </option>
            ))}
        </select>
      </Level>

      {value.country !== "" && (
        <Level label={labels.province} busy={loading}>
          {provinceTyped ? (
            <TypedInput
              value={value.province}
              disabled={disabled || loading}
              maxLength={60}
              placeholder={`Type your ${labels.province.toLowerCase()}`}
              onChange={(text) => onChange({ ...value, province: text, district: "", town: "" })}
              onBack={hasProvinces ? () => { setTyped({ province: false, district: false, town: false }); onChange({ ...value, province: "", district: "", town: "" }); } : undefined}
            />
          ) : (
            <select
              className="scorer-input"
              value={value.province}
              disabled={disabled || loading}
              onChange={(event) => {
                const next = event.target.value;
                if (next === OTHER) {
                  setTyped({ province: true, district: true, town: true });
                  onChange({ ...value, province: "", district: "", town: "" });
                  return;
                }
                setTyped({ province: false, district: false, town: false });
                onChange({ ...value, province: next, district: "", town: "" });
              }}
            >
              <option value="">Choose {labels.province.toLowerCase()}</option>
              {provinces.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value={OTHER}>Not listed — type it</option>
            </select>
          )}
        </Level>
      )}

      {showDistrict && (
        <Level label={labels.district}>
          {districtTyped ? (
            <TypedInput
              value={value.district}
              disabled={disabled}
              maxLength={80}
              placeholder={`Type your ${labels.district.toLowerCase()} (optional)`}
              onChange={(text) => onChange({ ...value, district: text, town: value.town })}
              onBack={hasRegions && typed.district ? () => { setTyped({ ...typed, district: false, town: false }); onChange({ ...value, district: "", town: "" }); } : undefined}
            />
          ) : (
            <select
              className="scorer-input"
              value={value.district}
              disabled={disabled}
              onChange={(event) => {
                const next = event.target.value;
                if (next === OTHER) {
                  setTyped({ ...typed, district: true, town: true });
                  onChange({ ...value, district: "", town: "" });
                  return;
                }
                setTyped({ ...typed, town: false });
                onChange({ ...value, district: next, town: "" });
              }}
            >
              <option value="">Choose {labels.district.toLowerCase()}</option>
              {regions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value={OTHER}>Not listed — type it</option>
            </select>
          )}
        </Level>
      )}

      {showTown && (
        <Level label={labels.town}>
          {townTyped ? (
            <TypedInput
              value={value.town}
              disabled={disabled}
              maxLength={80}
              placeholder="Type your town or city"
              onChange={(text) => onChange({ ...value, town: text })}
              onBack={townsListed && typed.town ? () => { setTyped({ ...typed, town: false }); onChange({ ...value, town: "" }); } : undefined}
            />
          ) : (
            <select
              className="scorer-input"
              value={value.town}
              disabled={disabled}
              onChange={(event) => {
                if (event.target.value === OTHER) {
                  setTyped({ ...typed, town: true });
                  onChange({ ...value, town: "" });
                  return;
                }
                onChange({ ...value, town: event.target.value });
              }}
            >
              <option value="">Choose town or city</option>
              {towns.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value={OTHER}>Not listed — type it</option>
            </select>
          )}
        </Level>
      )}
    </div>
  );
}

function Level({ label, busy = false, children }: { label: string; busy?: boolean; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
        {busy && <LoaderCircle className="size-3 animate-spin" aria-label="Loading places" />}
      </span>
      {children}
    </label>
  );
}

function TypedInput({
  value,
  onChange,
  onBack,
  placeholder,
  maxLength,
  disabled,
}: {
  value: string;
  onChange: (text: string) => void;
  onBack?: (() => void) | undefined;
  placeholder: string;
  maxLength: number;
  disabled: boolean;
}) {
  return (
    <span className="flex gap-2">
      <input
        className="scorer-input min-w-0 flex-1"
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {onBack && (
        <button type="button" className="app-chip-button shrink-0" onClick={onBack} disabled={disabled}>
          Pick from list
        </button>
      )}
    </span>
  );
}
