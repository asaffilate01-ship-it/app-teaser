import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, ClipboardCheck, LoaderCircle, ShieldAlert } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { checkEligibility, type EligibilityData } from "@/lib/eligibility";
import { Empty, OfficeCard, OfficeField, Pill, day, fromLocal } from "@/components/office/ui";
import { attempt, isClubAdmin, isLeagueAdmin, isTeamManager, money, must, toMinor, type DeskProps } from "./shared";

interface Settings { competition_id: string; open: boolean; closes_at: string | null; team_fee_minor: number; player_fee_minor: number; currency: string; payment_instructions: string | null; overseas_limit: number | null; played_down_limit: number | null; registered_only: boolean }
interface Registration { id: string; competition_id: string; team_id: string; club_id: string; status: string; fee_minor: number; currency: string; payment_reference: string | null; paid_confirmed_at: string | null; note: string | null; created_at: string; teams?: { name: string } | null; competitions?: { name: string } | null }
interface OpenComp { competitionId: string; competition: string; league: string; closesAt: string | null; teamFeeMinor: number; playerFeeMinor: number; currency: string; paymentInstructions: string | null; overseasLimit: number | null; playedDownLimit: number | null; registeredOnly: boolean }
interface PlayerReg { id: string; competition_id: string; team_id: string; player_id: string; overseas: boolean; status: string }

export function RegistrationPanel(props: DeskProps) {
  return isLeagueAdmin(props) ? <LeagueRegistrations {...props} /> : <ClubRegistrations {...props} />;
}

function LeagueRegistrations({ organisationId, club }: DeskProps) {
  const db = getCloudClient();
  const [settings, setSettings] = useState<Settings[]>([]);
  const [regs, setRegs] = useState<Registration[] | null>(null);
  const [players, setPlayers] = useState<PlayerReg[]>([]);
  const load = useCallback(async () => {
    const [s, r, p] = await Promise.all([
      db.from("competition_registration_settings").select("*").eq("organisation_id", organisationId),
      db.from("competition_registrations").select("*,teams(name),competitions(name)").eq("league_id", organisationId).order("created_at", { ascending: false }),
      db.from("competition_player_registrations").select("id,competition_id,team_id,player_id,overseas,status").eq("league_id", organisationId),
    ]);
    setSettings((s.data ?? []) as Settings[]);
    setRegs((r.data ?? []) as unknown as Registration[]);
    setPlayers((p.data ?? []) as PlayerReg[]);
  }, [db, organisationId]);
  useEffect(() => void load(), [load]);
  if (!regs) return <p className="office-meta flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" /> Loading registrations…</p>;
  const decide = (id: string, decision: "approve" | "reject" | "paid") =>
    attempt(() => must(db.rpc("decide_team_registration", { p_id: id, p_decision: decision })), decision === "approve" ? "Team accepted into the competition" : decision === "paid" ? "Payment confirmed" : "Registration declined", load);
  return (
    <div className="space-y-4">
      {club.competitions.length === 0 && <Empty>Create a competition first, then open registration for it here.</Empty>}
      {club.competitions.map((comp) => (
        <CompetitionSettings key={comp.id} name={comp.name} competitionId={comp.id} organisationId={organisationId} current={settings.find((s) => s.competition_id === comp.id)} onSaved={load} />
      ))}
      <OfficeCard title="Team registrations" description="Approve a team to add it to the competition. Confirm the fee once it has reached your account.">
        {regs.length === 0 ? <Empty>No teams have registered yet.</Empty> : (
          <ul className="space-y-2">
            {regs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <span className="min-w-0 flex-1"><strong>{r.teams?.name ?? "Team"}</strong> → {r.competitions?.name ?? "Competition"}
                  <small className="office-meta block">{money(r.fee_minor, r.currency)}{r.payment_reference ? ` · ref ${r.payment_reference}` : " · no payment reference yet"}{r.note ? ` · “${r.note}”` : ""}</small>
                </span>
                <Pill tone={r.status === "approved" ? "good" : r.status === "pending" ? "warn" : "bad"}>{r.status}</Pill>
                {r.paid_confirmed_at ? <Pill tone="good">Paid</Pill> : r.fee_minor > 0 && <button type="button" className="app-chip-button" onClick={() => void decide(r.id, "paid")}>Mark paid</button>}
                {r.status === "pending" && <>
                  <button type="button" className="action-secondary" onClick={() => void decide(r.id, "approve")}>Approve</button>
                  <button type="button" className="app-chip-button" onClick={() => void decide(r.id, "reject")}>Decline</button>
                </>}
              </li>
            ))}
          </ul>
        )}
      </OfficeCard>
      <OfficeCard title="Registered players" description={`${players.filter((p) => p.status === "registered").length} registered · tap to reject or restore`}>
        {players.length === 0 ? <Empty>Clubs register their players once their team is accepted.</Empty> : (
          <p className="office-meta">Player names stay with their clubs. {players.filter((p) => p.overseas).length} marked overseas; {players.filter((p) => p.status === "rejected").length} rejected.</p>
        )}
      </OfficeCard>
    </div>
  );
}

function CompetitionSettings({ name, competitionId, organisationId, current, onSaved }: { name: string; competitionId: string; organisationId: string; current: Settings | undefined; onSaved: () => Promise<void> }) {
  const db = getCloudClient();
  const [open, setOpen] = useState(current?.open ?? false);
  const [closes, setCloses] = useState(current?.closes_at ? current.closes_at.slice(0, 16) : "");
  const [teamFee, setTeamFee] = useState(current ? String(current.team_fee_minor / 100) : "0");
  const [playerFee, setPlayerFee] = useState(current ? String(current.player_fee_minor / 100) : "0");
  const [currency, setCurrency] = useState(current?.currency ?? "GBP");
  const [instructions, setInstructions] = useState(current?.payment_instructions ?? "");
  const [overseas, setOverseas] = useState(current?.overseas_limit != null ? String(current.overseas_limit) : "");
  const [down, setDown] = useState(current?.played_down_limit != null ? String(current.played_down_limit) : "");
  const [registeredOnly, setRegisteredOnly] = useState(current?.registered_only ?? false);
  const [expanded, setExpanded] = useState(false);
  const save = () => attempt(() => must(db.from("competition_registration_settings").upsert({
    competition_id: competitionId, organisation_id: organisationId, open, closes_at: fromLocal(closes),
    team_fee_minor: toMinor(teamFee), player_fee_minor: toMinor(playerFee), currency: currency.toUpperCase().slice(0, 3),
    payment_instructions: instructions.trim() || null, overseas_limit: overseas === "" ? null : Number(overseas),
    played_down_limit: down === "" ? null : Number(down), registered_only: registeredOnly, updated_at: new Date().toISOString(),
  })), "Registration settings saved", onSaved);
  return (
    <OfficeCard title={name} description={current?.open ? `Registration open${current.closes_at ? ` until ${day(current.closes_at)}` : ""}` : "Registration closed"}
      action={<button type="button" className="app-chip-button" onClick={() => setExpanded(!expanded)}>{expanded ? "Hide" : "Registration & rules"}</button>}>
      {expanded && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> Open for clubs to register teams</label>
          <OfficeField label="Closes"><input type="datetime-local" className="scorer-input" value={closes} onChange={(e) => setCloses(e.target.value)} /></OfficeField>
          <OfficeField label="Team fee"><input className="scorer-input" inputMode="decimal" value={teamFee} onChange={(e) => setTeamFee(e.target.value)} /></OfficeField>
          <OfficeField label="Fee per player"><input className="scorer-input" inputMode="decimal" value={playerFee} onChange={(e) => setPlayerFee(e.target.value)} /></OfficeField>
          <OfficeField label="Currency"><input className="scorer-input" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></OfficeField>
          <OfficeField label="Overseas players allowed per match"><input className="scorer-input" inputMode="numeric" placeholder="No limit" value={overseas} onChange={(e) => setOverseas(e.target.value.replace(/\D/g, ""))} /></OfficeField>
          <OfficeField label="Games for a higher team before they can't play down"><input className="scorer-input" inputMode="numeric" placeholder="No rule" value={down} onChange={(e) => setDown(e.target.value.replace(/\D/g, ""))} /></OfficeField>
          <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" checked={registeredOnly} onChange={(e) => setRegisteredOnly(e.target.checked)} /> Only registered players (or players with a permit) may play</label>
          <OfficeField label="How to pay (bank / Raast / Easypaisa / JazzCash details)" className="sm:col-span-3"><textarea className="scorer-input min-h-16" maxLength={1000} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></OfficeField>
          <button type="button" className="action-primary sm:col-span-3 sm:w-fit" onClick={() => void save()}>Save</button>
        </div>
      )}
    </OfficeCard>
  );
}

function ClubRegistrations(props: DeskProps) {
  const { organisationId, club } = props;
  const db = getCloudClient();
  const admin = isClubAdmin(props);
  const manager = isTeamManager(props);
  const [open, setOpen] = useState<OpenComp[] | null>(null);
  const [mine, setMine] = useState<Registration[]>([]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const ownTeams = club.teams.filter((t) => !t.external);
  const load = useCallback(async () => {
    const [o, m] = await Promise.all([
      db.rpc("open_registrations"),
      db.from("competition_registrations").select("*,teams(name),competitions(name)").eq("club_id", organisationId).order("created_at", { ascending: false }),
    ]);
    setOpen(((o.data ?? []) as unknown as OpenComp[]));
    setMine((m.data ?? []) as unknown as Registration[]);
  }, [db, organisationId]);
  useEffect(() => void load(), [load]);
  if (!open) return <p className="office-meta flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" /> Loading…</p>;
  const accepted = mine.filter((r) => r.status === "approved");
  return (
    <div className="space-y-4">
      <OfficeCard title="Competitions open for entries" description="Enter a team; the league approves it.">
        {open.length === 0 ? <Empty>No leagues are taking entries right now.</Empty> : (
          <ul className="space-y-2">
            {open.map((c) => (
              <li key={c.competitionId} className="rounded-lg border border-border p-3 text-sm">
                <strong>{c.competition}</strong> <span className="office-meta">· {c.league}{c.closesAt ? ` · closes ${day(c.closesAt)}` : ""}</span>
                <p className="office-meta">Team fee {money(c.teamFeeMinor, c.currency)}{c.playerFeeMinor ? ` · ${money(c.playerFeeMinor, c.currency)} per player` : ""}{c.overseasLimit != null ? ` · ${c.overseasLimit} overseas per match` : ""}{c.registeredOnly ? " · registered players only" : ""}</p>
                {c.paymentInstructions && <p className="office-meta mt-1 whitespace-pre-wrap">How to pay: {c.paymentInstructions}</p>}
                {admin && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select className="scorer-input w-auto" value={picked[c.competitionId] ?? ""} onChange={(e) => setPicked({ ...picked, [c.competitionId]: e.target.value })} aria-label="Team to enter">
                      <option value="">Choose a team</option>
                      {ownTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button type="button" className="action-secondary" disabled={!picked[c.competitionId]} onClick={() => void attempt(() => must(db.rpc("register_team", { p_competition_id: c.competitionId, p_team_id: picked[c.competitionId]! })), "Entry sent to the league", load)}>Enter team</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </OfficeCard>
      <OfficeCard title="Your entries">
        {mine.length === 0 ? <Empty>No entries yet.</Empty> : (
          <ul className="space-y-2">
            {mine.map((r) => <EntryRow key={r.id} reg={r} canEdit={admin || props.role === "treasurer"} onSaved={load} />)}
          </ul>
        )}
      </OfficeCard>
      {manager && accepted.length > 0 && <PlayerRegistration club={club} entries={accepted} onSaved={load} />}
    </div>
  );
}

function EntryRow({ reg, canEdit, onSaved }: { reg: Registration; canEdit: boolean; onSaved: () => Promise<void> }) {
  const db = getCloudClient();
  const [ref, setRef] = useState(reg.payment_reference ?? "");
  return (
    <li className="rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1"><strong>{reg.teams?.name}</strong> → {reg.competitions?.name} <small className="office-meta">· {money(reg.fee_minor, reg.currency)}</small></span>
        <Pill tone={reg.status === "approved" ? "good" : reg.status === "pending" ? "warn" : "bad"}>{reg.status}</Pill>
        {reg.paid_confirmed_at && <Pill tone="good">Paid</Pill>}
      </div>
      {canEdit && reg.status === "pending" && reg.fee_minor > 0 && (
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void attempt(() => must(db.from("competition_registrations").update({ payment_reference: ref.trim() || null }).eq("id", reg.id)), "Payment reference saved", onSaved); }}>
          <input className="scorer-input min-w-0 flex-1" maxLength={120} placeholder="Transfer reference you used" value={ref} onChange={(e) => setRef(e.target.value)} />
          <button className="app-chip-button">Save</button>
        </form>
      )}
    </li>
  );
}

function PlayerRegistration({ club, entries, onSaved }: { club: DeskProps["club"]; entries: Registration[]; onSaved: () => Promise<void> }) {
  const db = getCloudClient();
  const [entryId, setEntryId] = useState(entries[0]!.id);
  const entry = entries.find((e) => e.id === entryId) ?? entries[0]!;
  const team = club.teams.find((t) => t.id === entry.team_id);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overseas, setOverseas] = useState<Set<string>>(new Set());
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const loadEligibility = useCallback(async () => {
    const { data } = await db.rpc("team_eligibility_data", { p_competition_id: entry.competition_id, p_team_id: entry.team_id });
    const value = data as unknown as EligibilityData | null;
    setEligibility(value && "registrations" in value ? value : null);
  }, [db, entry.competition_id, entry.team_id]);
  useEffect(() => void loadEligibility(), [loadEligibility]);
  const squad = club.players.filter((p) => team?.playerIds.includes(p.id) ?? true);
  const registered = new Set(eligibility?.registrations.filter((r) => r.status === "registered").map((r) => r.playerId));
  const toggle = (set: Set<string>, id: string, update: (s: Set<string>) => void) => { const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); update(next); };
  const issues = eligibility ? checkEligibility([...selected], eligibility, (id) => club.players.find((p) => p.id === id)?.name ?? "Player") : [];
  return (
    <OfficeCard title="Register players & check eligibility" description="Tick players to register them, or tick a match XI to check it against the league's rules.">
      <OfficeField label="Entry"><select className="scorer-input max-w-sm" value={entryId} onChange={(e) => setEntryId(e.target.value)}>{entries.map((e) => <option key={e.id} value={e.id}>{e.teams?.name} · {e.competitions?.name}</option>)}</select></OfficeField>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {squad.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(selected, p.id, setSelected)} aria-label={`Pick ${p.name}`} />
            <span className="flex-1 truncate">{p.name}</span>
            {registered.has(p.id) && <BadgeCheck className="size-4 text-success" aria-label="Registered" />}
            <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={overseas.has(p.id)} onChange={() => toggle(overseas, p.id, setOverseas)} /> Overseas</label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="action-primary" disabled={!selected.size} onClick={() => void attempt(() => must(db.rpc("register_players", { p_competition_id: entry.competition_id, p_team_id: entry.team_id, p_player_ids: [...selected], p_overseas: [...overseas] })), `${selected.size} players registered`, async () => { await loadEligibility(); await onSaved(); })}>
          <ClipboardCheck className="size-4" /> Register ticked players
        </button>
      </div>
      {selected.size > 0 && eligibility && (
        <div className="mt-3 rounded-lg border border-border p-3" role="status">
          {issues.length === 0 ? <p className="flex items-center gap-2 text-sm text-success"><BadgeCheck className="size-4" /> These {selected.size} players are all eligible.</p> : (
            <ul className="space-y-1 text-sm">{issues.map((i, n) => <li key={n} className="flex items-start gap-2"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" /> {i.message}</li>)}</ul>
          )}
        </div>
      )}
    </OfficeCard>
  );
}
