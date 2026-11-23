import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, ClipboardCheck, Coins, Gavel, LoaderCircle, Plus, Settings2, UserPlus, Users } from "lucide-react";
import { can } from "@/lib/platform";
import {
  appointmentStatusLabels,

  expiringSoon,
  feeFor,
  formatMinor,
  gradeLabels,
  gradeOrder,
  missingChecks,
  moneyTotals,
  paymentStatusLabels,
  positionLabels,
  rankUmpires,
  toMinor,
  type AppointmentStatus,
  type PanelRules,
  type PaymentStatus,
  type UmpireGrade,
  type UmpirePosition,
} from "@/lib/umpires";
import { friendlyUmpire, loadUmpirePanel, umpireOffice, type AppointmentRow, type UmpirePanelData, type UmpireRow } from "@/lib/umpires-cloud";
import { Empty, OfficeCard, OfficeField, Pill, currencies, day, fromLocal, when, type OfficeProps } from "./ui";
import { UmpireReportsDesk } from "@/components/umpire/UmpireReports";

type View = "appointments" | "panel" | "payments" | "rules" | "reports";
type Act = (action: () => Promise<void>, done?: string) => Promise<boolean>;

interface Slot {
  key: string;
  title: string;
  startsAt: string;
  timezone: string;
  venue: string;
  fixtureId: string | null;
}

const statusTone: Record<AppointmentStatus, "good" | "warn" | "bad" | undefined> = {
  offered: "warn",
  accepted: "good",
  declined: "bad",
  withdrawn: "bad",
  completed: undefined,
};
const payTone: Record<PaymentStatus, "good" | "warn" | "bad" | undefined> = {
  not_due: undefined,
  due: "warn",
  approved: "warn",
  paid: "good",
  not_applicable: undefined,
};
const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};
const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const major = (minor: number) => (minor / 100).toFixed(2).replace(/\.00$/, "");

export function UmpiresPanel({ organisationId, role, club }: OfficeProps) {
  const manager = can(role, "umpires.manage");
  const [view, setView] = useState<View>(manager ? "appointments" : "payments");
  const [data, setData] = useState<UmpirePanelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    try {
      const next = await loadUmpirePanel(organisationId);
      if (id === request.current) {
        setData(next);
        setError(null);
      }
    } catch (reason) {
      if (id === request.current) setError(reason instanceof Error ? reason.message : "The umpire panel could not load.");
    }
  }, [organisationId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const act = useCallback<Act>(
    async (action, done) => {
      try {
        await action();
        if (done) toast.success(done);
        await reload();
        return true;
      } catch (reason) {
        toast.error(reason instanceof Error ? friendlyUmpire(reason.message) : "That didn't work.");
        await reload();
        return false;
      }
    },
    [reload],
  );

  const views: [View, string, typeof Gavel][] = [
    ...(manager ? ([["appointments", "Appointments", CalendarCheck], ["panel", "Panel", Users]] as [View, string, typeof Gavel][]) : []),
    ["payments", "Payments", Coins],
    ...(manager ? ([["reports", "Reports", ClipboardCheck], ["rules", "Rules", Settings2]] as [View, string, typeof Gavel][]) : []),
  ];

  if (error && !data)
    return (
      <div className="office-card">
        <p className="office-meta">{error}</p>
        <button type="button" className="action-secondary mt-3" onClick={() => void reload()}>
          Try again
        </button>
      </div>
    );
  if (!data)
    return (
      <div className="office-card flex items-center gap-2 text-sm">
        <LoaderCircle className="size-4 animate-spin" /> Loading umpires…
      </div>
    );

  const active = data.umpires.filter((row) => row.status === "active").length;
  const offered = data.appointments.filter((row) => row.status === "offered" && new Date(row.starts_at).getTime() > Date.now()).length;
  return (
    <div className="space-y-4">
      <OfficeCard
        title="Umpires"
        description="Build your panel, appoint umpires to matches, share travel details and pay them. Umpires reply and set their availability at criclume.com/umpire."
      >
        <span className="flex flex-wrap gap-1.5">
          <Pill tone="good">{active} active umpire{active === 1 ? "" : "s"}</Pill>
          {offered > 0 && <Pill tone="warn">{offered} waiting for a reply</Pill>}
          {!data.hasRules && manager && <Pill tone="warn">Set your panel rules</Pill>}
        </span>
      </OfficeCard>
      <div className="office-tabs" role="tablist" aria-label="Umpires">
        {views.map(([value, label, Icon]) => (
          <button key={value} type="button" role="tab" aria-selected={view === value} className="office-tab" onClick={() => setView(value)}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      {view === "appointments" && manager && <Appointments data={data} club={club} organisationId={organisationId} act={act} />}
      {view === "panel" && manager && <Panel data={data} club={club} organisationId={organisationId} act={act} />}
      {view === "payments" && <Payments data={data} manager={manager} act={act} />}
      {view === "reports" && manager && <UmpireReportsDesk organisationId={organisationId} umpires={data.umpires} appointments={data.appointments} act={act} />}
      {view === "rules" && manager && <Rules data={data} organisationId={organisationId} act={act} />}
    </div>
  );
}

/* ---------------- Appointments ---------------- */

function Appointments({ data, club, organisationId, act }: { data: UmpirePanelData; club: OfficeProps["club"]; organisationId: string; act: Act }) {
  const [custom, setCustom] = useState<Slot[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [venue, setVenue] = useState("");
  const teamName = (id: string) => club.teams.find((team) => team.id === id)?.name ?? "Team";
  const ground = (id: string | null) => club.grounds.find((item) => item.id === id);

  const slots = useMemo(() => {
    const now = Date.now() - 6 * 3_600_000;
    const horizon = Date.now() + 120 * 86_400_000;
    const list: Slot[] = [];
    for (const fixture of club.fixtures) {
      if (!fixture.startsAt) continue;
      const at = new Date(fixture.startsAt).getTime();
      if (at < now || at > horizon || ["cancelled", "abandoned", "completed"].includes(fixture.status)) continue;
      const g = ground(fixture.groundId);
      list.push({
        key: `f:${fixture.id}`,
        title: `${teamName(fixture.homeTeamId)} v ${teamName(fixture.awayTeamId)}`,
        startsAt: fixture.startsAt,
        timezone: g?.timezone || browserZone(),
        venue: g?.name ?? "",
        fixtureId: fixture.id,
      });
    }
    const seen = new Set(list.map((slot) => slot.key));
    for (const row of data.appointments) {
      if (row.fixture_id && seen.has(`f:${row.fixture_id}`)) continue;
      if (new Date(row.starts_at).getTime() < now) continue;
      const key = row.fixture_id ? `f:${row.fixture_id}` : `c:${row.title}|${row.starts_at}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ key, title: row.title, startsAt: row.starts_at, timezone: row.timezone, venue: row.venue ?? "", fixtureId: row.fixture_id });
    }
    for (const slot of custom) if (!seen.has(slot.key)) list.push(slot);
    return list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club.fixtures, club.grounds, club.teams, data.appointments, custom]);

  const toSignOff = data.appointments.filter((row) => row.status === "accepted" && new Date(row.starts_at).getTime() <= Date.now());

  return (
    <div className="space-y-4">
      {toSignOff.length > 0 && (
        <OfficeCard title="Matches to sign off" description="Mark each one done so the fee and travel can be paid.">
          <div className="space-y-2">
            {toSignOff.map((row) => (
              <div key={row.id} className="office-row">
                <span className="min-w-0">
                  <span className="font-bold">{umpireName(data, row.umpire_id)}</span>
                  <span className="office-meta block">
                    {row.title} · {when(row.starts_at)}
                  </span>
                </span>
                <span className="flex gap-1">
                  <button type="button" className="app-chip-button" onClick={() => void act(() => umpireOffice.updateAppointment(row.id, { status: "completed" }), "Marked done")}>
                    Mark done
                  </button>
                  <button type="button" className="app-chip-button" onClick={() => void act(() => umpireOffice.updateAppointment(row.id, { status: "withdrawn", response_note: "Did not stand" }), "Recorded as not stood")}>
                    Didn't stand
                  </button>
                </span>
              </div>
            ))}
          </div>
        </OfficeCard>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="office-meta">Upcoming fixtures for the next four months, plus any other match you add.</p>
        <button type="button" className="app-chip-button" onClick={() => setAdding(!adding)}>
          <Plus className="size-3.5" /> Another match
        </button>
      </div>
      {adding && (
        <form
          className="office-card grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const iso = fromLocal(startsAt);
            if (!iso || !title.trim()) return;
            setCustom([...custom, { key: `c:${title.trim()}|${iso}`, title: title.trim(), startsAt: iso, timezone: browserZone(), venue: venue.trim(), fixtureId: null }]);
            setAdding(false);
            setTitle("");
            setStartsAt("");
            setVenue("");
          }}
        >
          <OfficeField label="Match">
            <input required maxLength={160} className="scorer-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cup semi-final: Riverside v Hilltop" />
          </OfficeField>
          <OfficeField label="Starts">
            <input required type="datetime-local" className="scorer-input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </OfficeField>
          <OfficeField label="Venue">
            <input maxLength={200} className="scorer-input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Riverside Park" />
          </OfficeField>
          <div className="flex items-end">
            <button className="action-primary w-full">Add</button>
          </div>
        </form>
      )}
      {slots.length === 0 ? (
        <Empty>No upcoming fixtures. Add fixtures in Competitions, or use “Another match”.</Empty>
      ) : (
        slots.map((slot) => <SlotCard key={slot.key} slot={slot} data={data} organisationId={organisationId} act={act} />)
      )}
    </div>
  );
}

function umpireName(data: UmpirePanelData, id: string) {
  return data.umpires.find((row) => row.id === id)?.display_name ?? "Umpire";
}

function SlotCard({ slot, data, organisationId, act }: { slot: Slot; data: UmpirePanelData; organisationId: string; act: Act }) {
  const [picking, setPicking] = useState(false);
  const [logistics, setLogistics] = useState(false);
  const [position, setPosition] = useState<UmpirePosition>("standing");
  const rows = data.appointments.filter((row) =>
    slot.fixtureId ? row.fixture_id === slot.fixtureId : !row.fixture_id && row.title === slot.title && row.starts_at === slot.startsAt,
  );
  const live = rows.filter((row) => row.status !== "declined" && row.status !== "withdrawn");
  const ranked = useMemo(
    () =>
      rankUmpires({
        umpires: data.umpires.filter((umpire) => !live.some((row) => row.umpire_id === umpire.id)),
        rules: data.rules,
        startsAt: slot.startsAt,
        timeZone: slot.timezone,
        appointments: data.appointments,
        availability: data.availability,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, slot.startsAt, slot.timezone, live.length],
  );
  const first = live[0];
  return (
    <OfficeCard
      title={slot.title}
      description={`${when(slot.startsAt)}${slot.venue ? ` · ${slot.venue}` : ""}`}
      action={
        <span className="flex flex-wrap gap-1">
          {live.length > 0 && (
            <button type="button" className="app-chip-button" onClick={() => setLogistics(!logistics)}>
              {logistics ? "Close" : "Travel details"}
            </button>
          )}
          <button type="button" className="app-chip-button" onClick={() => setPicking(!picking)}>
            <UserPlus className="size-3.5" /> {picking ? "Close" : "Appoint"}
          </button>
        </span>
      }
    >
      {rows.length === 0 ? (
        <p className="office-meta">No umpires appointed yet.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <AppointmentLine key={row.id} row={row} data={data} act={act} />
          ))}
        </div>
      )}
      {logistics && first && <LogisticsForm rows={live} first={first} act={act} onDone={() => setLogistics(false)} />}
      {picking && (
        <div className="mt-3 space-y-2 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="office-label">Best fit first — available, fewest matches this season, then grade</span>
            <select aria-label="Position" className="scorer-input w-auto" value={position} onChange={(e) => setPosition(e.target.value as UmpirePosition)}>
              {Object.entries(positionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {ranked.length === 0 && <Empty>Add umpires in the Panel tab first.</Empty>}
          {ranked.map(({ umpire, blockers, availability, seasonCount }) => {
            const fee = feeFor(umpire, data.rules);
            return (
              <div key={umpire.id} className="office-row">
                <span className="min-w-0">
                  <span className="font-bold">{umpire.display_name}</span>{" "}
                  <Pill>{gradeLabels[umpire.grade as UmpireGrade] ?? umpire.grade}</Pill>{" "}
                  {availability === "available" && <Pill tone="good">Available</Pill>}
                  {availability === "maybe" && <Pill tone="warn">Maybe</Pill>}
                  {availability === "unknown" && <Pill>{umpire.user_id ? "Not answered" : "Not signed in yet"}</Pill>}
                  <span className="office-meta block">
                    {seasonCount} match{seasonCount === 1 ? "" : "es"} this year · {umpire.pay_basis === "voluntary" ? "Voluntary" : formatMinor(fee, data.rules.currency)}
                    {umpire.home_area ? ` · ${umpire.home_area}` : ""}
                    {blockers.length ? ` · ${blockers.join(", ")}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="app-chip-button"
                  disabled={blockers.length > 0}
                  onClick={() =>
                    void act(
                      () =>
                        umpireOffice.appoint({
                          organisation_id: organisationId,
                          umpire_id: umpire.id,
                          fixture_id: slot.fixtureId,
                          title: slot.title,
                          starts_at: slot.startsAt,
                          timezone: slot.timezone,
                          venue: slot.venue || null,
                          position,
                          pay_basis: umpire.pay_basis === "voluntary" ? "voluntary" : "paid",
                          fee_minor: fee,
                          currency: data.rules.currency,
                          report_at: first?.report_at ?? null,
                          meet_point: first?.meet_point ?? null,
                          travel_notes: first?.travel_notes ?? null,
                          contact_name: first?.contact_name ?? null,
                          contact_phone: first?.contact_phone ?? null,
                        }),
                      `${umpire.display_name} offered the match`,
                    )
                  }
                >
                  Offer
                </button>
              </div>
            );
          })}
        </div>
      )}
    </OfficeCard>
  );
}

function AppointmentLine({ row, data, act }: { row: AppointmentRow; data: UmpirePanelData; act: Act }) {
  const status = row.status as AppointmentStatus;
  return (
    <div className="office-row">
      <span className="min-w-0">
        <span className="font-bold">{umpireName(data, row.umpire_id)}</span> <Pill tone={statusTone[status]}>{appointmentStatusLabels[status]}</Pill>
        <span className="office-meta block">
          {positionLabels[row.position as UmpirePosition] ?? row.position} · {row.pay_basis === "voluntary" ? "Voluntary" : formatMinor(row.fee_minor, row.currency)}
          {row.response_note ? ` · “${row.response_note}”` : ""}
        </span>
      </span>
      {(status === "offered" || status === "declined" || status === "withdrawn") && (
        <button type="button" className="app-chip-button" onClick={() => void act(() => umpireOffice.removeAppointment(row.id), "Removed")}>
          Remove
        </button>
      )}
      {status === "accepted" && new Date(row.starts_at).getTime() > Date.now() && (
        <button type="button" className="app-chip-button" onClick={() => void act(() => umpireOffice.updateAppointment(row.id, { status: "withdrawn", response_note: "Stood down by the club" }), "Stood down")}>
          Stand down
        </button>
      )}
    </div>
  );
}

function LogisticsForm({ rows, first, act, onDone }: { rows: AppointmentRow[]; first: AppointmentRow; act: Act; onDone: () => void }) {
  const [reportAt, setReportAt] = useState(toLocalInput(first.report_at));
  const [meet, setMeet] = useState(first.meet_point ?? "");
  const [venue, setVenue] = useState(first.venue ?? "");
  const [contact, setContact] = useState(first.contact_name ?? "");
  const [phone, setPhone] = useState(first.contact_phone ?? "");
  const [notes, setNotes] = useState(first.travel_notes ?? "");
  return (
    <form
      className="mt-3 grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        const patch = {
          report_at: fromLocal(reportAt),
          meet_point: meet.trim() || null,
          venue: venue.trim() || null,
          contact_name: contact.trim() || null,
          contact_phone: phone.trim() || null,
          travel_notes: notes.trim() || null,
        };
        void act(async () => {
          for (const row of rows) await umpireOffice.updateAppointment(row.id, patch);
        }, "Travel details sent to the umpires").then((ok) => ok && onDone());
      }}
    >
      <OfficeField label="Report by">
        <input type="datetime-local" className="scorer-input" value={reportAt} onChange={(e) => setReportAt(e.target.value)} />
      </OfficeField>
      <OfficeField label="Ground / address">
        <input maxLength={200} className="scorer-input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Riverside Park, Mill Lane" />
      </OfficeField>
      <OfficeField label="Meeting point">
        <input maxLength={200} className="scorer-input" value={meet} onChange={(e) => setMeet(e.target.value)} placeholder="Umpires' room, pavilion" />
      </OfficeField>
      <OfficeField label="Contact on the day">
        <input maxLength={120} className="scorer-input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Fixtures secretary" />
      </OfficeField>
      <OfficeField label="Contact phone">
        <input maxLength={40} className="scorer-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 7700 900123" />
      </OfficeField>
      <OfficeField label="Travel and parking">
        <input maxLength={1000} className="scorer-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Park by the nets; lift from the station at 9:30" />
      </OfficeField>
      <div className="sm:col-span-2 lg:col-span-3">
        <button className="action-primary">Save travel details</button>
      </div>
    </form>
  );
}

/* ---------------- Panel ---------------- */

function Panel({ data, club, organisationId, act }: { data: UmpirePanelData; club: OfficeProps["club"]; organisationId: string; act: Act }) {
  const [editing, setEditing] = useState<UmpireRow | "new" | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const year = today.slice(0, 4);
  const list = data.umpires.filter((row) => row.status !== "left");
  const left = data.umpires.filter((row) => row.status === "left");
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" className="action-primary" onClick={() => setEditing(editing === "new" ? null : "new")}>
          <UserPlus className="size-4" /> Add umpire
        </button>
      </div>
      {editing === "new" && <UmpireForm data={data} club={club} organisationId={organisationId} act={act} onDone={() => setEditing(null)} />}
      {list.length === 0 && editing !== "new" && <Empty>No umpires yet. Add them by email — they see their matches once they sign in with that email.</Empty>}
      {list.map((umpire) =>
        editing !== "new" && editing?.id === umpire.id ? (
          <UmpireForm key={umpire.id} umpire={umpire} data={data} club={club} organisationId={organisationId} act={act} onDone={() => setEditing(null)} />
        ) : (
          <div key={umpire.id} className="office-row office-card">
            <UmpireSummary umpire={umpire} data={data} today={today} year={year} />
            <button type="button" className="app-chip-button" onClick={() => setEditing(umpire)}>
              Edit
            </button>
          </div>
        ),
      )}
      {left.length > 0 && <p className="office-meta">{left.length} former umpire{left.length === 1 ? "" : "s"} kept for past records.</p>}
    </div>
  );
}

function UmpireSummary({ umpire, data, today, year }: { umpire: UmpireRow; data: UmpirePanelData; today: string; year: string }) {
  const missing = missingChecks(umpire, data.rules, today);
  const soon = expiringSoon(umpire, today);
  const games = data.appointments.filter((row) => row.umpire_id === umpire.id && row.starts_at.startsWith(year) && (row.status === "completed" || row.status === "accepted")).length;
  return (
    <span className="min-w-0">
      <span className="font-bold">{umpire.display_name}</span> <Pill>{gradeLabels[umpire.grade as UmpireGrade] ?? umpire.grade}</Pill>{" "}
      <Pill>{umpire.pay_basis === "voluntary" ? "Voluntary" : formatMinor(feeFor(umpire, data.rules), data.rules.currency)}</Pill>{" "}
      {umpire.status === "paused" && <Pill tone="warn">Paused</Pill>}
      {!umpire.user_id && <Pill>{umpire.email ? "Waiting for sign-in" : "No account"}</Pill>}
      <span className="office-meta block">
        {games} match{games === 1 ? "" : "es"} in {year}
        {umpire.qualification ? ` · ${umpire.qualification}` : ""}
        {umpire.home_area ? ` · ${umpire.home_area}` : ""}
        {umpire.max_travel_km ? ` · up to ${umpire.max_travel_km} km` : ""}
      </span>
      <span className="mt-1 flex flex-wrap gap-1">
        {missing.filter((item) => !item.startsWith("Paused")).map((item) => (
          <Pill key={item} tone="bad">
            Needs {item.toLowerCase()}
          </Pill>
        ))}
        {soon.map((item) => (
          <Pill key={item} tone="warn">
            {item} ends soon
          </Pill>
        ))}
        {missing.length === 0 && soon.length === 0 && <Pill tone="good">Ready to appoint</Pill>}
      </span>
    </span>
  );
}

function UmpireForm({
  umpire,
  data,
  club,
  organisationId,
  act,
  onDone,
}: {
  umpire?: UmpireRow;
  data: UmpirePanelData;
  club: OfficeProps["club"];
  organisationId: string;
  act: Act;
  onDone: () => void;
}) {
  const [name, setName] = useState(umpire?.display_name ?? "");
  const [email, setEmail] = useState(umpire?.email ?? "");
  const [member, setMember] = useState(umpire?.user_id ?? "");
  const [phone, setPhone] = useState(umpire?.phone ?? "");
  const [grade, setGrade] = useState(umpire?.grade ?? "club");
  const [qualification, setQualification] = useState(umpire?.qualification ?? "");
  const [qualExpires, setQualExpires] = useState(umpire?.qualification_expires ?? "");
  const [safeguarding, setSafeguarding] = useState(umpire?.safeguarding_expires ?? "");
  const [firstAid, setFirstAid] = useState(umpire?.first_aid_expires ?? "");
  const [kit, setKit] = useState(umpire?.kit_ok ?? false);
  const [payBasis, setPayBasis] = useState(umpire?.pay_basis ?? data.rules.default_pay_basis);
  const [fee, setFee] = useState(umpire?.match_fee_minor != null ? major(umpire.match_fee_minor) : "");
  const [area, setArea] = useState(umpire?.home_area ?? "");
  const [km, setKm] = useState(umpire?.max_travel_km != null ? String(umpire.max_travel_km) : "");
  const [status, setStatus] = useState(umpire?.status ?? "active");
  const [notes, setNotes] = useState(umpire?.notes ?? "");
  const members = club.members.filter((row) => row.status === "active");
  return (
    <form
      className="office-card grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        const feeMinor = fee.trim() ? toMinor(fee) : null;
        if (fee.trim() && feeMinor === null) {
          toast.error("Enter the fee as a number, like 25 or 25.50");
          return;
        }
        const linked = member || null;
        const record = {
          display_name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          grade,
          qualification: qualification.trim() || null,
          qualification_expires: qualExpires || null,
          safeguarding_expires: safeguarding || null,
          first_aid_expires: firstAid || null,
          kit_ok: kit,
          pay_basis: payBasis,
          match_fee_minor: payBasis === "voluntary" ? null : feeMinor,
          home_area: area.trim() || null,
          max_travel_km: km.trim() ? Math.max(0, Math.min(2000, Number(km) || 0)) : null,
          status,
          notes: notes.trim() || null,
        };
        void act(
          () =>
            umpire
              ? umpireOffice.updateUmpire(umpire.id, { ...record, ...(linked !== umpire.user_id && linked ? { user_id: linked } : {}) })
              : umpireOffice.addUmpire({ organisation_id: organisationId, ...record, user_id: linked }),
          umpire ? "Umpire updated" : "Umpire added",
        ).then((ok) => ok && onDone());
      }}
    >
      <OfficeField label="Name">
        <input required maxLength={120} className="scorer-input" value={name} onChange={(e) => setName(e.target.value)} />
      </OfficeField>
      <OfficeField label="Email (they sign in with this)">
        <input type="email" maxLength={254} className="scorer-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="umpire@example.com" />
      </OfficeField>
      <OfficeField label="Or a club member">
        <select className="scorer-input" value={member} onChange={(e) => setMember(e.target.value)} disabled={Boolean(umpire?.user_id)}>
          <option value="">{umpire?.user_id ? "Linked" : "Not a member"}</option>
          {members.map((row) => (
            <option key={row.userId} value={row.userId}>
              {row.displayName}
            </option>
          ))}
        </select>
      </OfficeField>
      <OfficeField label="Phone">
        <input maxLength={40} className="scorer-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </OfficeField>
      <OfficeField label="Grade">
        <select className="scorer-input" value={grade} onChange={(e) => setGrade(e.target.value)}>
          {gradeOrder.map((value) => (
            <option key={value} value={value}>
              {gradeLabels[value]}
            </option>
          ))}
        </select>
      </OfficeField>
      <OfficeField label="Qualification">
        <input maxLength={160} className="scorer-input" value={qualification} onChange={(e) => setQualification(e.target.value)} placeholder="ECB ACO Level 1, PCB Level 2…" />
      </OfficeField>
      <OfficeField label="Qualification valid until">
        <input type="date" className="scorer-input" value={qualExpires} onChange={(e) => setQualExpires(e.target.value)} />
      </OfficeField>
      <OfficeField label="Safeguarding check valid until">
        <input type="date" className="scorer-input" value={safeguarding} onChange={(e) => setSafeguarding(e.target.value)} />
      </OfficeField>
      <OfficeField label="First aid valid until">
        <input type="date" className="scorer-input" value={firstAid} onChange={(e) => setFirstAid(e.target.value)} />
      </OfficeField>
      <OfficeField label="Pay">
        <select className="scorer-input" value={payBasis} onChange={(e) => setPayBasis(e.target.value)}>
          <option value="paid">Paid</option>
          <option value="voluntary">Voluntary (travel only)</option>
        </select>
      </OfficeField>
      <OfficeField label={`Match fee (${data.rules.currency}) — blank uses the panel fee`}>
        <input inputMode="decimal" className="scorer-input" disabled={payBasis === "voluntary"} value={fee} onChange={(e) => setFee(e.target.value)} placeholder={major(data.rules.default_fee_minor)} />
      </OfficeField>
      <OfficeField label="Home area">
        <input maxLength={120} className="scorer-input" value={area} onChange={(e) => setArea(e.target.value)} placeholder="North Lahore" />
      </OfficeField>
      <OfficeField label="Travels up to (km)">
        <input inputMode="numeric" className="scorer-input" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} />
      </OfficeField>
      <OfficeField label="Status">
        <select className="scorer-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="left">Left the panel</option>
        </select>
      </OfficeField>
      <OfficeField label="Notes (the umpire can see these)" className="sm:col-span-2">
        <input maxLength={1000} className="scorer-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </OfficeField>
      <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-4">
        <input type="checkbox" checked={kit} onChange={(e) => setKit(e.target.checked)} /> Kit checked (coat, counters, light meter…)
      </label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
        <button className="action-primary">{umpire ? "Save" : "Add to panel"}</button>
        <button type="button" className="action-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------------- Payments ---------------- */

function Payments({ data, manager, act }: { data: UmpirePanelData; manager: boolean; act: Act }) {
  const [refs, setRefs] = useState<Record<string, string>>({});
  const done = data.appointments.filter((row) => row.status === "completed");
  const open = done.filter((row) => row.payment_status === "due" || row.payment_status === "approved").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const paid = done.filter((row) => row.payment_status === "paid").sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 30);
  const totals = moneyTotals(done);
  const year = new Date().getFullYear().toString();
  const perUmpire = data.umpires
    .map((umpire) => {
      const rows = done.filter((row) => row.umpire_id === umpire.id && row.starts_at.startsWith(year));
      return { umpire, rows, totals: moneyTotals(rows) };
    })
    .filter((item) => item.rows.length > 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(totals).length === 0 && <Empty>No completed matches yet.</Empty>}
        {Object.entries(totals).map(([currency, total]) => (
          <div key={currency} className="office-card sm:col-span-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Owed" value={formatMinor(total.owed, currency)} />
              <Stat label="Approved, not paid" value={formatMinor(total.approved, currency)} />
              <Stat label="Paid" value={formatMinor(total.paid, currency)} />
              <Stat label="Voluntary matches" value={String(total.voluntaryMatches)} />
            </div>
          </div>
        ))}
      </div>
      <OfficeCard title="To pay" description="Fee plus travel the umpire claimed. Pay by bank or wallet transfer, then record the reference.">
        {open.length === 0 ? (
          <Empty>Nothing waiting.</Empty>
        ) : (
          <div className="space-y-2">
            {open.map((row) => (
              <div key={row.id} className="office-row">
                <span className="min-w-0">
                  <span className="font-bold">{umpireName(data, row.umpire_id)}</span>{" "}
                  <Pill tone={payTone[row.payment_status as PaymentStatus]}>{paymentStatusLabels[row.payment_status as PaymentStatus]}</Pill>
                  <span className="office-meta block">
                    {row.title} · {day(row.starts_at)} · fee {formatMinor(row.fee_minor, row.currency)} + travel {formatMinor(row.expenses_minor, row.currency)}
                    {row.travel_km ? ` (${row.travel_km} km)` : ""} = <strong>{formatMinor(row.fee_minor + row.expenses_minor, row.currency)}</strong>
                    {row.expenses_note ? ` · ${row.expenses_note}` : ""}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  {row.payment_status === "due" && (
                    <button type="button" className="app-chip-button" onClick={() => void act(() => umpireOffice.setPayment(row.id, "approved"), "Approved")}>
                      Approve
                    </button>
                  )}
                  <input
                    aria-label="Transfer reference"
                    className="scorer-input h-9 w-32"
                    placeholder="Reference"
                    value={refs[row.id] ?? ""}
                    onChange={(e) => setRefs({ ...refs, [row.id]: e.target.value })}
                  />
                  <button type="button" className="app-chip-button" onClick={() => void act(() => umpireOffice.setPayment(row.id, "paid", refs[row.id] ?? ""), "Marked paid")}>
                    Mark paid
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </OfficeCard>
      {perUmpire.length > 0 && (
        <OfficeCard title={`Each umpire in ${year}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-2">Umpire</th>
                  <th className="py-2 pr-2">Matches</th>
                  <th className="py-2 pr-2">Owed</th>
                  <th className="py-2 pr-2">Paid</th>
                </tr>
              </thead>
              <tbody>
                {perUmpire.map(({ umpire, rows, totals: t }) => (
                  <tr key={umpire.id} className="border-t border-border/60">
                    <td className="py-2 pr-2 font-semibold">{umpire.display_name}</td>
                    <td className="py-2 pr-2">{rows.length}</td>
                    <td className="py-2 pr-2">{Object.entries(t).map(([c, v]) => formatMinor(v.owed + v.approved, c)).join(" · ")}</td>
                    <td className="py-2 pr-2">{Object.entries(t).map(([c, v]) => formatMinor(v.paid, c)).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OfficeCard>
      )}
      {paid.length > 0 && (
        <OfficeCard title="Recently paid">
          <div className="space-y-1.5">
            {paid.map((row) => (
              <div key={row.id} className="office-row">
                <span className="min-w-0">
                  <span className="font-bold">{umpireName(data, row.umpire_id)}</span>
                  <span className="office-meta block">
                    {row.title} · {formatMinor(row.fee_minor + row.expenses_minor, row.currency)} · paid {day(row.paid_on)}
                    {row.payment_reference ? ` · ref ${row.payment_reference}` : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </OfficeCard>
      )}
      {!manager && <p className="office-meta">Appointments and the panel are run by the club or league admins.</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="office-label">{label}</p>
      <p className="font-display text-xl font-bold">{value}</p>
    </div>
  );
}

/* ---------------- Rules ---------------- */

function Rules({ data, organisationId, act }: { data: UmpirePanelData; organisationId: string; act: Act }) {
  const [rules, setRules] = useState<PanelRules>(data.rules);
  const [fee, setFee] = useState(major(data.rules.default_fee_minor));
  const [rate, setRate] = useState(major(data.rules.travel_rate_minor));
  const flag = (key: "requires_qualification" | "requires_safeguarding" | "requires_first_aid" | "requires_kit", label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={rules[key]} onChange={(e) => setRules({ ...rules, [key]: e.target.checked })} /> {label}
    </label>
  );
  return (
    <OfficeCard title="Panel rules" description="Umpires missing a required check can't be appointed — the system refuses it, not just the screen.">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const feeMinor = toMinor(fee || "0");
          const rateMinor = toMinor(rate || "0");
          if (feeMinor === null || rateMinor === null) {
            toast.error("Enter money as a number, like 25 or 0.45");
            return;
          }
          void act(() => umpireOffice.saveRules(organisationId, { ...rules, default_fee_minor: feeMinor, travel_rate_minor: rateMinor }), "Panel rules saved");
        }}
      >
        <div className="space-y-2 sm:col-span-2">
          <span className="office-label">Required on match day</span>
          {flag("requires_safeguarding", "Safeguarding / police check")}
          {flag("requires_qualification", "Umpiring qualification")}
          {flag("requires_first_aid", "First aid")}
          {flag("requires_kit", "Kit checked")}
        </div>
        <OfficeField label="Most umpires are">
          <select className="scorer-input" value={rules.default_pay_basis} onChange={(e) => setRules({ ...rules, default_pay_basis: e.target.value === "voluntary" ? "voluntary" : "paid" })}>
            <option value="paid">Paid a match fee</option>
            <option value="voluntary">Volunteers (travel only)</option>
          </select>
        </OfficeField>
        <OfficeField label="Currency">
          <select className="scorer-input" value={rules.currency} onChange={(e) => setRules({ ...rules, currency: e.target.value })}>
            {[...new Set([...currencies, rules.currency])].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </OfficeField>
        <OfficeField label={`Standard match fee (${rules.currency})`}>
          <input inputMode="decimal" className="scorer-input" value={fee} onChange={(e) => setFee(e.target.value)} />
        </OfficeField>
        <OfficeField label={`Travel per km (${rules.currency})`}>
          <input inputMode="decimal" className="scorer-input" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.45" />
        </OfficeField>
        <OfficeField label="Guidance for umpires (dress code, arrival time, match ball, reports…)" className="sm:col-span-2">
          <textarea
            maxLength={2000}
            rows={4}
            className="scorer-input min-h-24"
            value={rules.guidance ?? ""}
            onChange={(e) => setRules({ ...rules, guidance: e.target.value })}
          />
        </OfficeField>
        <div className="sm:col-span-2">
          <button className="action-primary">Save rules</button>
        </div>
      </form>
    </OfficeCard>
  );
}


