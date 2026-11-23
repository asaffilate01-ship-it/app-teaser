import { useCallback, useEffect, useState } from "react";
import { Gavel } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { loadLeagueLinks, type LeagueLink } from "@/lib/club-network-cloud";
import { Empty, OfficeCard, OfficeField, Pill, day } from "@/components/office/ui";
import { attempt, isLeagueAdmin, money, must, toMinor, type DeskProps } from "./shared";

interface Case {
  id: string; club_id: string; player_id: string; offence: string; detail: string | null; incident_on: string | null; status: string;
  fine_minor: number; currency: string; fine_paid: boolean; matches_banned: number | null; suspended_from: string | null; suspended_until: string | null; outcome: string | null; created_at: string;
}

/** League discipline: cases, fines and suspensions. A suspended player can't be picked until it ends. */
export function DisciplinePanel(props: DeskProps) {
  const { organisationId, club } = props;
  const league = isLeagueAdmin(props);
  const db = getCloudClient();
  const [cases, setCases] = useState<Case[]>([]);
  const [clubs, setClubs] = useState<LeagueLink[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [clubId, setClubId] = useState("");
  const [players, setPlayers] = useState<{ id: string; display_name: string }[]>([]);
  const [form, setForm] = useState({ playerId: "", offence: "", detail: "", incident: "", fine: "", from: "", until: "", matches: "" });
  const load = useCallback(async () => {
    const query = db.from("discipline_cases").select("*").order("created_at", { ascending: false }).limit(200);
    const { data } = await (league ? query.eq("league_id", organisationId) : query.eq("club_id", organisationId));
    setCases((data ?? []) as Case[]);
    if (league) setClubs((await loadLeagueLinks(organisationId).catch(() => [])).filter((l) => l.side === "league" && l.status === "approved"));
  }, [db, league, organisationId]);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    if (!league || !clubId) return setPlayers([]);
    void db.rpc("league_member_players", { p_league: organisationId, p_club: clubId }).then(({ data }) => {
      const list = (data ?? []) as { id: string; display_name: string }[];
      setPlayers(list);
      setNames((n) => ({ ...n, ...Object.fromEntries(list.map((p) => [p.id, p.display_name])) }));
    });
  }, [clubId, db, league, organisationId]);
  const nameOf = (id: string) => names[id] ?? club.players.find((p) => p.id === id)?.name ?? "Player";
  const clubName = (id: string) => clubs.find((c) => c.otherId === id)?.otherName ?? "Club";
  const today = new Date().toISOString().slice(0, 10);

  const open = () => attempt(() => must(db.from("discipline_cases").insert({
    league_id: organisationId, club_id: clubId, player_id: form.playerId, offence: form.offence.trim(), detail: form.detail.trim() || null,
    incident_on: form.incident || null, fine_minor: toMinor(form.fine), matches_banned: form.matches ? Number(form.matches) : null,
    suspended_from: form.from || null, suspended_until: form.until || null, status: form.from && form.until ? "decided" : "open",
  })), "Case recorded", async () => { setForm({ playerId: "", offence: "", detail: "", incident: "", fine: "", from: "", until: "", matches: "" }); await load(); });

  return (
    <div className="space-y-4">
      {league && (
        <OfficeCard title="Open a case" description="Add the dates of a suspension and the player is blocked from selection for those dates.">
          <div className="grid gap-3 sm:grid-cols-3">
            <OfficeField label="Club"><select className="scorer-input" value={clubId} onChange={(e) => setClubId(e.target.value)}><option value="">Choose</option>{clubs.map((c) => <option key={c.otherId} value={c.otherId}>{c.otherName}</option>)}</select></OfficeField>
            <OfficeField label="Player"><select className="scorer-input" value={form.playerId} onChange={(e) => setForm({ ...form, playerId: e.target.value })}><option value="">Choose</option>{players.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></OfficeField>
            <OfficeField label="Offence"><input className="scorer-input" maxLength={160} value={form.offence} onChange={(e) => setForm({ ...form, offence: e.target.value })} placeholder="Dissent at umpire's decision" /></OfficeField>
            <OfficeField label="Date of incident"><input type="date" className="scorer-input" value={form.incident} onChange={(e) => setForm({ ...form, incident: e.target.value })} /></OfficeField>
            <OfficeField label="Fine"><input className="scorer-input" inputMode="decimal" value={form.fine} onChange={(e) => setForm({ ...form, fine: e.target.value })} placeholder="0" /></OfficeField>
            <OfficeField label="Matches banned"><input className="scorer-input" inputMode="numeric" value={form.matches} onChange={(e) => setForm({ ...form, matches: e.target.value.replace(/\D/g, "") })} /></OfficeField>
            <OfficeField label="Suspended from"><input type="date" className="scorer-input" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></OfficeField>
            <OfficeField label="Suspended until"><input type="date" className="scorer-input" value={form.until} onChange={(e) => setForm({ ...form, until: e.target.value })} /></OfficeField>
            <OfficeField label="Details" className="sm:col-span-3"><textarea className="scorer-input min-h-16" maxLength={2000} value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></OfficeField>
          </div>
          <button type="button" className="action-primary mt-3" disabled={!clubId || !form.playerId || form.offence.trim().length < 2} onClick={() => void open()}><Gavel className="size-4" /> Record case</button>
        </OfficeCard>
      )}
      <OfficeCard title={league ? "Cases" : "Your players' discipline record"}>
        {cases.length === 0 ? <Empty>No discipline cases.</Empty> : (
          <ul className="space-y-2">
            {cases.map((c) => {
              const active = c.suspended_from && c.suspended_until && c.suspended_from <= today && c.suspended_until >= today && (c.status === "decided" || c.status === "appealed");
              return (
                <li key={c.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="flex-1">{nameOf(c.player_id)}{league ? ` · ${clubName(c.club_id)}` : ""} — {c.offence}</strong>
                    {active && <Pill tone="bad">Suspended</Pill>}
                    <Pill tone={c.status === "closed" ? "good" : c.status === "open" ? "warn" : undefined}>{c.status}</Pill>
                  </div>
                  <p className="office-meta">
                    {c.incident_on ? `${day(c.incident_on)} · ` : ""}{c.fine_minor ? `Fine ${money(c.fine_minor, c.currency)}${c.fine_paid ? " (paid)" : ""} · ` : ""}
                    {c.suspended_from && c.suspended_until ? `Suspended ${day(c.suspended_from)} – ${day(c.suspended_until)}` : c.matches_banned ? `${c.matches_banned} match ban` : "No suspension"}
                  </p>
                  {c.detail && <p className="office-meta mt-1 whitespace-pre-wrap">{c.detail}</p>}
                  {league && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(["decided", "appealed", "closed"] as const).filter((s) => s !== c.status).map((s) => (
                        <button key={s} type="button" className="app-chip-button capitalize" onClick={() => void attempt(() => must(db.from("discipline_cases").update({ status: s, updated_at: new Date().toISOString() }).eq("id", c.id)), `Marked ${s}`, load)}>{s}</button>
                      ))}
                      {c.fine_minor > 0 && !c.fine_paid && <button type="button" className="app-chip-button" onClick={() => void attempt(() => must(db.from("discipline_cases").update({ fine_paid: true }).eq("id", c.id)), "Fine marked paid", load)}>Fine paid</button>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </OfficeCard>
    </div>
  );
}
