import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, LoaderCircle, Search, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import {
  decideLeagueLink,
  endLeagueLink,
  loadLeagueLinks,
  loadOrganisationPlace,
  requestLeague,
  searchLeagues,
  type LeagueLink,
  type LeagueOption,
} from "@/lib/club-network-cloud";
import { placeLine } from "@/lib/geo";
import { countryFlag, countryName } from "@/lib/live-centre";

type Kind = "club" | "league" | "school" | "academy";

/** Clubs: join a league. Leagues: approve the clubs asking to join and see member clubs. */
export function LeaguePanel({
  organisationId,
  kind,
  canManage,
}: {
  organisationId: string;
  kind: Kind;
  canManage: boolean;
}) {
  const [links, setLinks] = useState<LeagueLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLinks(await loadLeagueLinks(organisationId));
      setError(null);
    } catch {
      setError("Couldn't load league links. Try again shortly.");
    }
  }, [organisationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const act = async (id: string, action: () => Promise<void>, done: string) => {
    setBusy(id);
    try {
      await action();
      toast.success(done);
      await reload();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const isLeague = kind === "league";
  const pending = (links ?? []).filter((link) => link.status === "pending");
  const approved = (links ?? []).filter((link) => link.status === "approved");

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10" aria-label={isLeague ? "Member clubs" : "Your league"}>
      <div className="mb-4 flex items-start gap-3">
        <Trophy className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-bold">{isLeague ? "Member clubs" : "Your league"}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {isLeague
              ? "Clubs ask to join your league. Approve them, then invite all member clubs to a competition in one tap."
              : "If you play in a league, ask to join it here. The league approves you and can then invite your teams to its competitions."}
          </p>
        </div>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
      {links === null && !error ? (
        <p className="text-sm text-slate-400"><LoaderCircle className="mr-1 inline size-4 animate-spin" /> Loading…</p>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-200">
                {isLeague ? "Waiting for your answer" : "Waiting for the league"}
              </h3>
              <ul className="space-y-2">
                {pending.map((link) => (
                  <LinkRow key={link.id} link={link}>
                    {isLeague && link.side === "league" && canManage ? (
                      <>
                        <button type="button" className="action-primary" disabled={busy === link.id} onClick={() => void act(link.id, () => decideLeagueLink(link.id, true), `${link.otherName} joined your league.`)}>
                          <Check className="size-4" aria-hidden="true" /> Approve
                        </button>
                        <button type="button" className="app-chip-button" disabled={busy === link.id} onClick={() => void act(link.id, () => decideLeagueLink(link.id, false), "Request declined.")}>
                          <X className="size-4" aria-hidden="true" /> Decline
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="office-pill office-pill-warn">Asked</span>
                        {canManage && (
                          <button type="button" className="app-chip-button" disabled={busy === link.id} onClick={() => void act(link.id, () => endLeagueLink(link.id), "Request cancelled.")}>
                            Cancel
                          </button>
                        )}
                      </>
                    )}
                  </LinkRow>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              {isLeague ? `Member clubs (${approved.length})` : "Leagues you're in"}
            </h3>
            {approved.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 p-3 text-center text-sm text-slate-400">
                {isLeague ? "No member clubs yet. Clubs find your league by its name and country." : "Not in a league yet."}
              </p>
            ) : (
              <ul className="space-y-2">
                {approved.map((link) => (
                  <LinkRow key={link.id} link={link}>
                    <span className="office-pill office-pill-good">Member</span>
                    {canManage && (
                      <button
                        type="button"
                        className="app-chip-button"
                        disabled={busy === link.id}
                        onClick={() => {
                          const question = isLeague ? `Remove ${link.otherName} from your league?` : `Leave ${link.otherName}?`;
                          if (window.confirm(question)) void act(link.id, () => endLeagueLink(link.id), isLeague ? "Club removed." : "You left the league.");
                        }}
                      >
                        {isLeague ? "Remove" : "Leave"}
                      </button>
                    )}
                  </LinkRow>
                ))}
              </ul>
            )}
          </div>
          {!isLeague && canManage && <JoinLeague organisationId={organisationId} linkedIds={(links ?? []).map((link) => link.otherId)} onJoined={reload} />}
        </div>
      )}
    </section>
  );
}

function LinkRow({ link, children }: { link: LeagueLink; children: ReactNode }) {
  const where = placeLine({ town: link.town ?? "", district: link.district ?? "", province: link.region ?? "" });
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="min-w-0">
        <p className="truncate font-bold">{link.otherName}</p>
        <p className="truncate text-xs text-slate-400">
          {link.country ? `${countryFlag(link.country)} ` : ""}
          {[where, link.country ? countryName(link.country) : ""].filter(Boolean).join(" · ") || "Location not set"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </li>
  );
}

/** Search leagues in the club's country and ask to join one. */
export function JoinLeague({
  organisationId,
  linkedIds,
  onJoined,
}: {
  organisationId: string;
  linkedIds: string[];
  onJoined: () => Promise<void> | void;
}) {
  const [country, setCountry] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeagueOption[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadOrganisationPlace(organisationId)
      .then((place) => setCountry(place.country))
      .catch(() => setCountry(""));
  }, [organisationId]);

  useEffect(() => {
    if (country === null) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void searchLeagues(query.trim(), country)
        .then((rows) => active && setResults(rows))
        .catch(() => active && setResults([]));
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [country, query]);

  const visible = (results ?? []).filter((league) => !linkedIds.includes(league.id));
  const join = async (league: LeagueOption) => {
    setBusy(true);
    try {
      await requestLeague(organisationId, league.id);
      toast.success(`Request sent to ${league.name}.`);
      await onJoined();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't send the request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <label className="block space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
          Find your league{country ? ` in ${countryName(country)}` : ""}
        </span>
        <span className="flex items-center gap-2">
          <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <input className="scorer-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="League name" />
        </span>
      </label>
      {visible.length > 0 && (
        <ul className="mt-3 space-y-2">
          {visible.slice(0, 8).map((league) => (
            <li key={league.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{league.name}</span>
                <span className="block truncate text-xs text-slate-400">
                  {placeLine({ town: league.town ?? "", district: league.district ?? "", province: league.province ?? "" }) || (league.country ? countryName(league.country) : "")}
                </span>
              </span>
              <button type="button" className="app-chip-button" disabled={busy} onClick={() => void join(league)}>
                Ask to join
              </button>
            </li>
          ))}
        </ul>
      )}
      {results && visible.length === 0 && (
        <p className="mt-2 text-xs text-slate-400">
          {query.trim() ? "No leagues found." : "No other leagues found"}
          {country ? ` in ${countryName(country)}` : ""}. Your league needs a CricLume account before you can join it.
        </p>
      )}
    </div>
  );
}
