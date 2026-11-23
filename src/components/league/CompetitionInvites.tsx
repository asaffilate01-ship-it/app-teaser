import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, Mail, Search, Send, Trophy, Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  answerInvite,
  findClubsToInvite,
  inviteClubs,
  inviteLeagueClubs,
  loadInvitesOverview,
  loadOrganisationPlace,
  withdrawInvite,
  type InvitableClub,
  type InvitesOverview,
  type ReceivedInvite,
} from "@/lib/club-network-cloud";
import { placeLine } from "@/lib/geo";
import { countryFlag, countryName, liveCountryCodes } from "@/lib/live-centre";
import { can, type PlatformRole } from "@/lib/platform";
import type { PlatformDashboardData } from "@/lib/platform-cloud";

type Kind = "club" | "league" | "school" | "academy";

const formatLabel: Record<string, string> = {
  league: "League",
  groups: "Groups",
  knockout: "Knockout",
  round_robin_knockout: "Round robin + knockout",
  friendly: "Friendlies",
};

const statusTone: Record<string, string> = {
  pending: "office-pill-warn",
  accepted: "office-pill-good",
  declined: "office-pill-bad",
  withdrawn: "",
};
const statusText: Record<string, string> = {
  pending: "Invited",
  accepted: "Entered",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

/** Invitations to and from this club: answer invites with your teams, and invite other clubs to your competitions. */
export function CompetitionNetwork({
  data,
  kind,
  role,
  onChanged,
}: {
  data: PlatformDashboardData;
  kind: Kind;
  role: PlatformRole;
  onChanged: () => void;
}) {
  const [overview, setOverview] = useState<InvitesOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setOverview(await loadInvitesOverview(data.organisationId));
      setError(null);
    } catch {
      setError("Couldn't load invitations. Try again shortly.");
    }
  }, [data.organisationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const changed = async () => {
    await reload();
    onChanged();
  };

  const canAnswer = ["owner", "club_admin", "team_manager"].includes(role);
  const canInvite = can(role, "competition.manage");
  const ownTeams = data.teams.filter((team) => !team.external);

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {overview && (overview.received.length > 0 || kind !== "league") && (
        <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10" aria-label="Invitations to your club">
          <Heading icon={Mail} title="Invitations to your club" detail="Other clubs and leagues invite you to their tournaments and leagues. Accept with the teams you want to enter." />
          {overview.received.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-3 text-center text-sm text-slate-400">No invitations yet.</p>
          ) : (
            <ul className="space-y-3">
              {overview.received.map((invite) => (
                <ReceivedRow key={invite.id} invite={invite} teams={ownTeams} canAnswer={canAnswer} onDone={changed} />
              ))}
            </ul>
          )}
          {overview.entered.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Competitions you're in</h3>
              <ul className="grid gap-2 md:grid-cols-2">
                {overview.entered.map((item) => (
                  <li key={item.competitionId} className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <p className="font-bold">{item.competition}</p>
                    <p className="text-xs text-slate-400">
                      Run by {item.hostName} · {formatLabel[item.format] ?? item.format} · {item.season}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      {item.teams.join(", ")} · {item.fixtures} fixture{item.fixtures === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-400">Send your results from the results desk above once each match is played.</p>
            </div>
          )}
        </section>
      )}
      {overview && canInvite && data.competitions.length > 0 && (
        <InviteClubs data={data} kind={kind} overview={overview} onDone={changed} />
      )}
    </div>
  );
}

function Heading({ icon: Icon, title, detail }: { icon: typeof Mail; title: string; detail: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden="true" />
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function ReceivedRow({
  invite,
  teams,
  canAnswer,
  onDone,
}: {
  invite: ReceivedInvite;
  teams: PlatformDashboardData["teams"];
  canAnswer: boolean;
  onDone: () => Promise<void>;
}) {
  const [picked, setPicked] = useState<string[]>(() => (teams.length === 1 && teams[0] ? [teams[0].id] : []));
  const [busy, setBusy] = useState(false);
  const host = placeLine({ town: invite.hostTown ?? "", province: invite.hostRegion ?? "" });
  const answer = async (accept: boolean) => {
    setBusy(true);
    try {
      await answerInvite(invite.id, accept, accept ? picked : []);
      toast.success(accept ? `You're in ${invite.competition}.` : "Invitation declined.");
      await onDone();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const enteredNames = teams.filter((team) => invite.teamIds.includes(team.id)).map((team) => team.name);
  return (
    <li className="rounded-xl border border-white/10 bg-black/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold">{invite.competition}</p>
          <p className="text-xs text-slate-400">
            {formatLabel[invite.format] ?? invite.format} · {invite.season} · from {invite.hostName}
            {host ? ` (${host})` : ""}
          </p>
        </div>
        <span className={`office-pill ${statusTone[invite.status] ?? ""}`}>{statusText[invite.status]}</span>
      </div>
      {invite.message && <p className="mt-2 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-slate-200">“{invite.message}”</p>}
      {invite.status === "accepted" ? (
        <p className="mt-2 text-sm text-emerald-200">Entered: {enteredNames.join(", ") || "your teams"}</p>
      ) : canAnswer ? (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Which teams are entering?</p>
          {teams.length === 0 ? (
            <p className="mt-1 text-sm text-slate-400">Register a team under Players first.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  aria-pressed={picked.includes(team.id)}
                  className="builder-team"
                  onClick={() =>
                    setPicked((current) => (current.includes(team.id) ? current.filter((id) => id !== team.id) : [...current, team.id]))
                  }
                >
                  {team.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="action-primary" disabled={busy || picked.length === 0} onClick={() => void answer(true)}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" aria-hidden="true" />} Accept and enter {picked.length || ""} team{picked.length === 1 ? "" : "s"}
            </button>
            <button type="button" className="app-chip-button" disabled={busy} onClick={() => void answer(false)}>
              <X className="size-4" aria-hidden="true" /> Decline
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-400">Your club's owner, admins or team managers can answer this.</p>
      )}
    </li>
  );
}

function InviteClubs({
  data,
  kind,
  overview,
  onDone,
}: {
  data: PlatformDashboardData;
  kind: Kind;
  overview: InvitesOverview;
  onDone: () => Promise<void>;
}) {
  const [competitionId, setCompetitionId] = useState(data.competitions[0]?.id ?? "");
  const [country, setCountry] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<InvitableClub[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadOrganisationPlace(data.organisationId)
      .then((place) => setCountry((current) => current || place.country))
      .catch(() => undefined);
  }, [data.organisationId]);

  const search = useCallback(async () => {
    if (!competitionId || (query.trim().length < 2 && !country)) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await findClubsToInvite(competitionId, query.trim(), country));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [competitionId, country, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void search(), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      await onDone();
      await search();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const sent = overview.sent.filter((invite) => invite.competitionId === competitionId);
  const competition = data.competitions.find((item) => item.id === competitionId);

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10" aria-label="Invite clubs">
      <Heading
        icon={Send}
        title="Invite clubs to your competition"
        detail="Find clubs by name or town. They accept with the teams they want to enter, then their teams appear in your fixture builder and tables."
      />
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block space-y-2">
          <span className="builder-label">Competition</span>
          <select className="scorer-input" value={competitionId} onChange={(event) => setCompetitionId(event.target.value)}>
            {data.competitions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.seasonName}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="builder-label">Country</span>
          <select className="scorer-input" value={country} onChange={(event) => setCountry(event.target.value)}>
            <option value="">Any country</option>
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
          <span className="builder-label">Club or town</span>
          <span className="flex items-center gap-2">
            <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input className="scorer-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Kingsmead or Lahore" />
          </span>
        </label>
        <label className="block space-y-2 md:col-span-3">
          <span className="builder-label">Message with the invitation (optional)</span>
          <input className="scorer-input" maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Saturday T20s from May, £150 entry per team" />
        </label>
      </div>
      {kind === "league" && competition && (
        <button
          type="button"
          className="action-secondary mt-3"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const count = await inviteLeagueClubs(competition.id, message);
              if (count === 0) throw new Error("Every member club is already invited (or you have no approved member clubs yet).");
            }, "Member clubs invited.")
          }
        >
          <Users className="size-4" aria-hidden="true" /> Invite all member clubs
        </button>
      )}
      <div className="mt-4">
        {searching ? (
          <p className="text-sm text-slate-400"><LoaderCircle className="mr-1 inline size-4 animate-spin" /> Searching…</p>
        ) : results.length > 0 ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {results.map((club) => {
              const where = placeLine({ town: club.town ?? "", district: club.district ?? "", province: club.province ?? "" });
              const invited = club.inviteStatus === "pending" || club.inviteStatus === "accepted";
              return (
                <li key={club.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/10 p-3">
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{club.name}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {club.country ? `${countryFlag(club.country)} ` : ""}
                      {where || (club.country ? countryName(club.country) : "Location not set")}
                      {club.inLeague ? " · member club" : ""}
                    </span>
                  </span>
                  {invited ? (
                    <span className={`office-pill ${statusTone[club.inviteStatus ?? ""] ?? ""}`}>{statusText[club.inviteStatus ?? ""]}</span>
                  ) : (
                    <button type="button" className="app-chip-button shrink-0" disabled={busy} onClick={() => void run(() => inviteClubs(competitionId, [club.id], message), `${club.name} invited.`)}>
                      Invite
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">
            {query.trim().length < 2 && !country ? "Pick a country or type at least two letters." : "No clubs found."}
          </p>
        )}
      </div>
      <div className="mt-5">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
          <Trophy className="size-3.5" aria-hidden="true" /> Invited to {competition?.name ?? "this competition"} ({sent.length})
        </h3>
        {sent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-3 text-center text-sm text-slate-400">No clubs invited yet.</p>
        ) : (
          <ul className="space-y-2">
            {sent.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/10 p-3">
                <span className="min-w-0">
                  <span className="block truncate font-bold">{invite.clubName}</span>
                  <span className="block truncate text-xs text-slate-400">
                    {invite.status === "accepted" && invite.teams.length > 0
                      ? `Entered: ${invite.teams.join(", ")}`
                      : placeLine({ town: invite.clubTown ?? "", province: invite.clubRegion ?? "" }) || "—"}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`office-pill ${statusTone[invite.status] ?? ""}`}>{statusText[invite.status]}</span>
                  {invite.status === "pending" && (
                    <button type="button" className="app-chip-button" disabled={busy} onClick={() => void run(() => withdrawInvite(invite.id), "Invitation withdrawn.")}>
                      Withdraw
                    </button>
                  )}
                  {(invite.status === "declined" || invite.status === "withdrawn") && (
                    <button type="button" className="app-chip-button" disabled={busy} onClick={() => void run(() => inviteClubs(competitionId, [invite.clubId], message), `${invite.clubName} invited again.`)}>
                      Invite again
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
