import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { LocationPicker } from "@/components/club/LocationPicker";
import { loadOrganisationPlace, saveOrganisationPlace } from "@/lib/club-network-cloud";
import { emptyPlace, placeLine, type PlaceValue } from "@/lib/geo";

/** Where the club or league plays: country, province, region and town. Used for Live scores, league search and invitations. */
export function LiveListingPanel({ organisationId }: { organisationId: string }) {
  const [place, setPlace] = useState<PlaceValue>(emptyPlace);
  const [state, setState] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setState("loading");
    loadOrganisationPlace(organisationId)
      .then((value) => {
        if (!active) return;
        setPlace(value);
        setState("idle");
      })
      .catch(() => {
        if (!active) return;
        setError("Couldn't load where you play. Try again shortly.");
        setState("error");
      });
    return () => {
      active = false;
    };
  }, [organisationId]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setState("saving");
    setError(null);
    try {
      setPlace(await saveOrganisationPlace(organisationId, place));
      setState("saved");
    } catch {
      setError("Couldn't save. Only club owners and admins can change this.");
      setState("error");
    }
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10">
      <div className="mb-4 flex items-start gap-3">
        <MapPin className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-bold">Where you play</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Leagues and other clubs find you by this, and your public matches appear under it on{" "}
            <Link to="/live" className="font-bold text-amber-300 underline-offset-2 hover:underline">
              Live scores
            </Link>
            .
          </p>
        </div>
      </div>
      <form onSubmit={(event) => void save(event)} className="space-y-3">
        <LocationPicker
          value={place}
          disabled={state === "loading" || state === "saving"}
          onChange={(next) => {
            setPlace(next);
            setState("idle");
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">{placeLine(place) || "Not set yet"}</p>
          <button type="submit" className="action-primary" disabled={state === "loading" || state === "saving"}>
            {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}
          </button>
        </div>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  );
}
