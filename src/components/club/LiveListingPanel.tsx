import { Link } from "@tanstack/react-router";
import { Globe2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { getCloudClient } from "@/lib/cloud";
import { countryFlag, countryName, liveCountryCodes } from "@/lib/live-centre";

/** Where the club or league plays, so its public matches appear under the right country and region on Live scores. */
export function LiveListingPanel({ organisationId }: { organisationId: string }) {
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [state, setState] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getCloudClient()
      .from("organisations")
      .select("country_code, region")
      .eq("id", organisationId)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) {
          setError("Couldn't load where you play. Try again shortly.");
          setState("error");
          return;
        }
        setCountry((data?.country_code as string | null) ?? "");
        setRegion((data?.region as string | null) ?? "");
        setState("idle");
      });
    return () => {
      active = false;
    };
  }, [organisationId]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const cleanRegion = region.trim().slice(0, 60);
    setState("saving");
    setError(null);
    const { error: saveError } = await getCloudClient()
      .from("organisations")
      .update({ country_code: country || null, region: cleanRegion || null })
      .eq("id", organisationId);
    if (saveError) {
      setError("Couldn't save. Only club owners and admins can change this.");
      setState("error");
      return;
    }
    setRegion(cleanRegion);
    setState("saved");
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10">
      <div className="mb-4 flex items-start gap-3">
        <Globe2 className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-bold">Where you play</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Public matches appear on{" "}
            <Link to="/live" className="font-bold text-amber-300 underline-offset-2 hover:underline">
              Live scores
            </Link>{" "}
            under this country and region, so fans can find them.
          </p>
        </div>
      </div>
      <form onSubmit={(event) => void save(event)} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="block space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Country</span>
          <select className="scorer-input" value={country} disabled={state === "loading"} onChange={(event) => { setCountry(event.target.value); setState("idle"); }}>
            <option value="">Not set</option>
            {[...liveCountryCodes]
              .map((code) => ({ code, name: countryName(code) }))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(({ code, name }) => (
                <option key={code} value={code}>
                  {countryFlag(code)} {name}
                </option>
              ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Region, county or province</span>
          <input
            className="scorer-input"
            value={region}
            maxLength={60}
            disabled={state === "loading"}
            onChange={(event) => { setRegion(event.target.value); setState("idle"); }}
            placeholder="e.g. Punjab, Yorkshire, Gauteng"
          />
        </label>
        <button type="submit" className="action-primary" disabled={state === "loading" || state === "saving"}>
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}
        </button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  );
}
