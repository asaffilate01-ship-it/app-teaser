import { useCallback, useEffect, useState } from "react";
import { History, Mail, UserCheck, UserPlus, X } from "lucide-react";
import { getCloudClient } from "@/lib/cloud";
import { can, type PlatformRole } from "@/lib/platform";
import { inviteMember } from "@/lib/platform-cloud";
import { decideClaim, pendingClaims, type ClaimRow } from "@/lib/player-hub-cloud";
import { Empty, OfficeCard, Pill, nameOfMember, when, type OfficeProps } from "./ui";

interface JoinRequest { id: string; name: string; email: string; phone: string | null; interest: string; junior: boolean; message: string | null; status: string; created_at: string }

/** Role a join request is invited with. Parents and helpers get view-only access; the child is added as a player separately. */
export function roleForJoinRequest(interest: string, junior: boolean): PlatformRole {
  if (junior || interest === "parent") return "viewer";
  if (interest === "player") return "player";
  if (interest === "coach") return "coach";
  return "viewer";
}

/** "Join the club" requests from the club website, and players asking to link their profile. */
export function PeoplePanel({ organisationId, role, club, act }: OfficeProps) {
  const db = getCloudClient();
  const admin = can(role, "members.manage");
  const [requests, setRequests] = useState<JoinRequest[] | null>(null);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const load = useCallback(async () => {
    const [r, c] = await Promise.all([
      db.from("club_join_requests").select("*").eq("organisation_id", organisationId).order("created_at", { ascending: false }).limit(100),
      pendingClaims(organisationId).catch(() => [] as ClaimRow[]),
    ]);
    setRequests((r.data ?? []) as JoinRequest[]);
    setClaims(c);
  }, [db, organisationId]);
  useEffect(() => void load(), [load]);
  const run = async (action: () => Promise<void>, done: string) => {
    await act(action, done);
    await load();
  };
  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  return (
    <div className="space-y-4">
      <OfficeCard title="Join requests" description="From the 'Join the club' form on your website. Accepting sends them an invitation to sign in.">
        {requests === null ? <p className="office-meta">Loading…</p> : pending.length === 0 ? <Empty>No new requests. Publish your club website to start receiving them.</Empty> : (
          <ul className="space-y-2">
            {pending.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="flex-1">{r.name}</strong>
                  <Pill>{r.interest}{r.junior ? " · junior" : ""}</Pill>
                  <span className="office-meta">{when(r.created_at)}</span>
                </div>
                <p className="office-meta"><Mail className="mr-1 inline size-3.5" />{r.email}{r.phone ? ` · ${r.phone}` : ""}</p>
                {r.message && <p className="mt-1 whitespace-pre-wrap">{r.message}</p>}
                {admin && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="action-secondary" onClick={() => void run(async () => {
                      await inviteMember({ organisationId, email: r.email, role: roleForJoinRequest(r.interest, r.junior) });
                      const { error } = await db.from("club_join_requests").update({ status: "accepted", decided_at: new Date().toISOString() }).eq("id", r.id);
                      if (error) throw new Error(error.message);
                    }, r.junior ? "Invited the parent — add the child as a player in Players" : "Invitation sent")}>
                      <UserPlus className="size-4" /> Accept &amp; invite
                    </button>
                    <button type="button" className="app-chip-button" onClick={() => void run(async () => {
                      const { error } = await db.from("club_join_requests").update({ status: "declined", decided_at: new Date().toISOString() }).eq("id", r.id);
                      if (error) throw new Error(error.message);
                    }, "Request declined")}><X className="size-4" /> Decline</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </OfficeCard>
      <OfficeCard title="Profile claims" description="Members saying 'this player is me'. Approving links the player to their account so they see one career across clubs.">
        {claims.length === 0 ? <Empty>No profile claims waiting.</Empty> : (
          <ul className="space-y-2">
            {claims.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <span className="flex-1"><strong>{nameOfMember(club, c.user_id)}</strong> says they are <strong>{c.players?.display_name ?? "a player"}</strong>{c.message ? <small className="office-meta block">“{c.message}”</small> : null}</span>
                {admin && <>
                  <button type="button" className="action-secondary" onClick={() => void run(() => decideClaim(c.id, true), "Profile linked")}><UserCheck className="size-4" /> Approve</button>
                  <button type="button" className="app-chip-button" onClick={() => void run(() => decideClaim(c.id, false), "Claim declined")}>Decline</button>
                </>}
              </li>
            ))}
          </ul>
        )}
      </OfficeCard>
    </div>
  );
}

interface AuditRow { id: number; actor_id: string | null; action: string; entity_table: string; entity_id: string; before_state: Record<string, unknown> | null; after_state: Record<string, unknown> | null; created_at: string }

const tableLabels: Record<string, string> = {
  players: "Player", teams: "Team", club_events: "Event", event_selections: "Team selection", matches: "Match", competitions: "Competition",
  organisation_members: "Member", fee_payments: "Fee payment", fee_charges: "Fee", training_sessions: "Training session", discipline_cases: "Discipline case",
  player_transfers: "Transfer", player_claims: "Profile claim", club_join_requests: "Join request", historic_player_stats: "Imported stats",
  competition_registrations: "Competition entry", organisations: "Club details", umpires: "Umpire", subscriptions: "Plan",
  fee_payment_claims: "Fee payment report", club_payment_accounts: "Payment account", grounds: "Ground", event_availability: "Availability", umpire_appointments: "Umpire appointment", videos: "Video", video_assets: "Video",
};

/** Which fields changed between two saved versions (ignoring timestamps). */
export function changedFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  if (!before || !after) return [];
  return Object.keys(after).filter((key) => !["updated_at", "created_at"].includes(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

const describe = (row: AuditRow) => {
  const state = row.after_state ?? row.before_state ?? {};
  const label = (state["display_name"] ?? state["title"] ?? state["name"] ?? state["player_name"] ?? state["offence"] ?? "") as string;
  return label ? `“${String(label).slice(0, 60)}”` : "";
};

/** Who changed what, and when — for owners, admins and safeguarding officers. */
export function ActivityPanel({ organisationId, role, club }: OfficeProps) {
  const db = getCloudClient();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [table, setTable] = useState("");
  const [page, setPage] = useState(0);
  const allowed = ["owner", "club_admin", "league_admin", "safeguarding_officer"].includes(role);
  useEffect(() => {
    if (!allowed) return;
    let q = db.from("audit_log").select("id,actor_id,action,entity_table,entity_id,before_state,after_state,created_at").eq("organisation_id", organisationId);
    if (table) q = q.eq("entity_table", table);
    void q.order("created_at", { ascending: false }).range(page * 50, page * 50 + 49).then(({ data }) => setRows((data ?? []) as unknown as AuditRow[]));
  }, [allowed, db, organisationId, page, table]);
  if (!allowed) return <Empty>Only owners, admins and safeguarding officers can see the activity history.</Empty>;
  return (
    <OfficeCard title="Activity history" description="Every change to players, teams, events, selections, fees, matches and more." action={
      <select className="scorer-input w-auto" value={table} onChange={(e) => { setPage(0); setTable(e.target.value); }} aria-label="Show">
        <option value="">Everything</option>
        {Object.entries(tableLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    }>
      {rows === null ? <p className="office-meta">Loading…</p> : rows.length === 0 ? <Empty>Nothing recorded yet.</Empty> : (
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const fields = changedFields(row.before_state, row.after_state);
            return (
              <li key={row.id} className="flex flex-wrap items-start gap-2 py-2 text-sm">
                <History className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <strong>{row.actor_id ? nameOfMember(club, row.actor_id) : "System"}</strong>{" "}
                  {row.action === "insert" ? "added" : row.action === "delete" ? "removed" : "changed"} {(tableLabels[row.entity_table] ?? row.entity_table.replaceAll("_", " ")).toLowerCase()} {describe(row)}
                  {fields.length > 0 && <small className="office-meta block">{fields.slice(0, 6).map((f) => f.replaceAll("_", " ")).join(", ")}</small>}
                </span>
                <span className="office-meta">{when(row.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" className="app-chip-button" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</button>
        <button type="button" className="app-chip-button" disabled={(rows?.length ?? 0) < 50} onClick={() => setPage(page + 1)}>Older</button>
      </div>
    </OfficeCard>
  );
}
