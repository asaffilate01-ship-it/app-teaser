import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { CalendarDays, Car, Clock, Coins, Gavel, LoaderCircle, MapPin, Phone, ShieldCheck, Check, X } from "lucide-react";
import { AppHeader } from "@/components/app-shell/AppHeader";
import { GoogleButton } from "@/components/app-shell/GoogleButton";
import { useCloudSession } from "@/hooks/use-cloud-session";
import { Empty, OfficeCard, OfficeField, Pill, day, when } from "@/components/office/ui";
import {
  addDays,
  appointmentStatusLabels,
  dayIn,
  expiringSoon,
  formatMinor,
  gradeLabels,
  missingChecks,
  moneyTotals,
  nextAvailability,
  paymentStatusLabels,
  positionLabels,
  toMinor,
  travelFor,
  type AppointmentStatus,
  type AvailabilityStatus,
  type PaymentStatus,
  type UmpireGrade,
  type UmpirePosition,
} from "@/lib/umpires";
import { friendlyUmpire, loadMyUmpireWork, umpireSelf, type AppointmentRow, type MyPanel, type MyUmpireData } from "@/lib/umpires-cloud";

export const Route = createFileRoute("/umpire")({
  head: () => ({
    meta: [
      { title: "Umpire dashboard — CricLume" },
      { name: "description", content: "Your umpiring appointments, availability, travel details and payments across every club and league panel." },
      { property: "og:title", content: "Umpire dashboard — CricLume" },
      { property: "og:description", content: "Accept matches, set availability, see travel details and track umpiring payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UmpireDashboard,
});

type Act = (action: () => Promise<void>, done?: string) => Promise<boolean>;

function UmpireDashboard() {
  const { configured, session, loading, requestLink, signOut } = useCloudSession();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader
        area="Umpire"
        right={
          session ? (
            <span className="flex items-center gap-2">
              <Link to="/platform" className="app-chip-button hidden sm:inline-flex">
                My club
              </Link>
              <button type="button" className="app-chip-button" onClick={() => void signOut()}>
                Sign out
              </button>
            </span>
          ) : (
            <Link to="/" className="app-chip-button">
              Back to site
            </Link>
          )
        }
      />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl space-y-5 px-4 py-6 pb-24 md:px-8 md:py-10">
        {!configured || loading ? (
          <p className="office-meta flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" /> Loading…
          </p>
        ) : !session ? (
          <SignIn requestLink={requestLink} />
        ) : (
          <Work key={session.user.id} email={session.user.email ?? ""} />
        )}
      </main>
    </div>
  );
}

function SignIn({ requestLink }: { requestLink: (email: string, redirectTo?: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await requestLink(email.trim(), `${window.location.origin}/umpire`);
      setSent(true);
    } catch {
      toast.error("We couldn't send the link. Check the email and try again.");
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    const { lovable } = await import("@/integrations/lovable");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/umpire` });
    if (result.error) toast.error("Google sign-in didn't finish. Please try again.");
  };
  return (
    <section className="office-card mx-auto max-w-md space-y-4">
      <span className="icon-tile flex size-11 items-center justify-center">
        <Gavel className="size-5 text-gold" />
      </span>
      <h1 className="font-display text-2xl font-bold">Umpire dashboard</h1>
      <p className="office-meta">Sign in with the email your club or league added you with to see your matches, travel details and payments.</p>
      <GoogleButton onClick={() => void google()} />
      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <label className="block">
          <span className="office-label">Email</span>
          <input type="email" required className="scorer-input" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <button type="submit" className="action-primary w-full" disabled={busy}>
          {sent ? "Link sent — check your inbox" : "Email me a sign-in link"}
        </button>
      </form>
    </section>
  );
}

function Work({ email }: { email: string }) {
  const [data, setData] = useState<MyUmpireData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    try {
      const next = await loadMyUmpireWork();
      if (id === request.current) {
        setData(next);
        setError(null);
      }
    } catch (reason) {
      if (id === request.current) setError(reason instanceof Error ? friendlyUmpire(reason.message) : "Your umpiring could not load.");
    }
  }, []);
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
      <p className="office-meta flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" /> Loading your umpiring…
      </p>
    );
  if (data.panels.length === 0)
    return (
      <section className="workspace-empty">
        <h1>You're not on an umpire panel yet</h1>
        <p>
          Ask your club or league's appointments officer to add you with <strong>{email || "your email"}</strong>. Your matches appear here as soon as they do.
        </p>
        <button type="button" className="action-secondary" onClick={() => void reload()}>
          Check again
        </button>
      </section>
    );
  return <Dashboard data={data} act={act} />;
}

function panelOf(data: MyUmpireData, row: AppointmentRow): MyPanel | undefined {
  return data.panels.find((panel) => panel.umpire.id === row.umpire_id);
}

function Dashboard({ data, act }: { data: MyUmpireData; act: Act }) {
  const now = Date.now();
  const offers = data.appointments.filter((row) => row.status === "offered" && new Date(row.starts_at).getTime() > now);
  const upcoming = data.appointments.filter((row) => row.status === "accepted" && new Date(row.starts_at).getTime() > now);
  const toClaim = data.appointments
    .filter((row) => (row.status === "accepted" || row.status === "completed") && new Date(row.starts_at).getTime() <= now && !["approved", "paid"].includes(row.payment_status))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const year = new Date().getFullYear().toString();
  const thisYear = data.appointments.filter((row) => row.starts_at.startsWith(year));
  const totals = moneyTotals(thisYear);
  const done = thisYear.filter((row) => row.status === "completed").length;
  const next = upcoming[0];
  const mainCurrency = Object.keys(totals)[0] ?? data.panels[0]?.rules.currency ?? "GBP";
  const main = totals[mainCurrency] ?? { owed: 0, approved: 0, paid: 0, voluntaryMatches: 0 };
  return (
    <>
      <div>
        <p className="panel-kicker">Umpire</p>
        <h1 className="font-display text-3xl font-bold md:text-4xl">Your umpiring</h1>
        <p className="office-meta mt-1">
          On {data.panels.length} panel{data.panels.length === 1 ? "" : "s"}: {data.panels.map((panel) => panel.organisation.name).join(", ")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
        <Tile icon={Gavel} label="Waiting for your reply" value={String(offers.length)} />
        <Tile icon={CalendarDays} label="Next match" value={next ? new Date(next.starts_at).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—"} />
        <Tile icon={Coins} label={`Owed to you (${year})`} value={formatMinor(main.owed + main.approved, mainCurrency)} />
        <Tile icon={Check} label={`Paid · ${done} match${done === 1 ? "" : "es"}`} value={formatMinor(main.paid, mainCurrency)} />
      </div>

      {offers.length > 0 && (
        <OfficeCard title="Match offers" description="Accept or decline so the appointments officer can plan.">
          <div className="space-y-2">
            {offers.map((row) => (
              <Offer key={row.id} row={row} panel={panelOf(data, row)} act={act} />
            ))}
          </div>
        </OfficeCard>
      )}

      <OfficeCard title="Your matches" description="Travel details come from the club or league. Tap the venue for directions.">
        {upcoming.length === 0 ? <Empty>No accepted matches coming up.</Empty> : <div className="space-y-3">{upcoming.map((row) => <Upcoming key={row.id} row={row} panel={panelOf(data, row)} act={act} />)}</div>}
      </OfficeCard>

      <Availability data={data} act={act} />

      <OfficeCard title="Payments" description="Claim travel after each match. Clubs pay by transfer and record the reference here.">
        {toClaim.length === 0 && thisYear.filter((row) => row.payment_status === "paid").length === 0 ? (
          <Empty>Payments show here after your first match.</Empty>
        ) : (
          <div className="space-y-2">
            {toClaim.map((row) => (
              <Claim key={row.id} row={row} panel={panelOf(data, row)} act={act} />
            ))}
            {thisYear
              .filter((row) => row.payment_status === "paid")
              .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
              .map((row) => (
                <div key={row.id} className="office-row">
                  <span className="min-w-0">
                    <span className="font-bold">{row.title}</span> <Pill tone="good">Paid</Pill>
                    <span className="office-meta block">
                      {panelOf(data, row)?.organisation.name} · {formatMinor(row.fee_minor + row.expenses_minor, row.currency)} · {day(row.paid_on)}
                      {row.payment_reference ? ` · ref ${row.payment_reference}` : ""}
                    </span>
                  </span>
                </div>
              ))}
          </div>
        )}
      </OfficeCard>

      <div className="grid gap-4 md:grid-cols-2">
        {data.panels.map((panel) => (
          <PanelCard key={panel.umpire.id} panel={panel} act={act} />
        ))}
      </div>
    </>
  );
}

function Tile({ icon: Icon, label, value }: { icon: typeof Gavel; label: string; value: string }) {
  return (
    <div className="office-card">
      <Icon className="size-4 text-gold" />
      <p className="mt-2 font-display text-xl font-bold md:text-2xl">{value}</p>
      <p className="office-meta">{label}</p>
    </div>
  );
}

function money(row: AppointmentRow) {
  return row.pay_basis === "voluntary" ? "Voluntary" : formatMinor(row.fee_minor, row.currency);
}

function Offer({ row, panel, act }: { row: AppointmentRow; panel: MyPanel | undefined; act: Act }) {
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="office-row">
      <span className="min-w-0">
        <span className="font-bold">{row.title}</span>
        <span className="office-meta block">
          {panel?.organisation.name} · {when(row.starts_at)}
          {row.venue ? ` · ${row.venue}` : ""} · {positionLabels[row.position as UmpirePosition] ?? row.position} · {money(row)}
        </span>
      </span>
      {declining ? (
        <form
          className="flex w-full flex-wrap gap-1 sm:w-auto"
          onSubmit={(event) => {
            event.preventDefault();
            void act(() => umpireSelf.respond(row.id, false, note), "Declined");
          }}
        >
          <input className="scorer-input h-9 min-w-40 flex-1" maxLength={500} placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="app-chip-button">Decline</button>
        </form>
      ) : (
        <span className="flex gap-1">
          <button type="button" className="action-primary h-9 px-4" onClick={() => void act(() => umpireSelf.respond(row.id, true, ""), "Accepted — see you there")}>
            <Check className="size-4" /> Accept
          </button>
          <button type="button" className="app-chip-button" onClick={() => setDeclining(true)}>
            <X className="size-3.5" /> Decline
          </button>
        </span>
      )}
    </div>
  );
}

function Upcoming({ row, panel, act }: { row: AppointmentRow; panel: MyPanel | undefined; act: Act }) {
  const [pulling, setPulling] = useState(false);
  const [note, setNote] = useState("");
  const maps = row.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.venue)}` : null;
  return (
    <div className="rounded-2xl border border-border p-3 md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold">{row.title}</p>
          <p className="office-meta">
            {panel?.organisation.name} · {positionLabels[row.position as UmpirePosition] ?? row.position} · {money(row)}
          </p>
        </div>
        <Pill tone="good">{appointmentStatusLabels[row.status as AppointmentStatus]}</Pill>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <Detail icon={CalendarDays} label="Starts" value={when(row.starts_at)} />
        <Detail icon={Clock} label="Report by" value={row.report_at ? when(row.report_at) : "Ask the club"} />
        <Detail
          icon={MapPin}
          label="Venue"
          value={
            maps ? (
              <a className="font-semibold text-gold underline-offset-2 hover:underline" href={maps} target="_blank" rel="noreferrer">
                {row.venue}
              </a>
            ) : (
              "Not set yet"
            )
          }
        />
        <Detail icon={MapPin} label="Meet at" value={row.meet_point ?? "—"} />
        <Detail
          icon={Phone}
          label="Contact"
          value={
            row.contact_name || row.contact_phone ? (
              <>
                {row.contact_name}{" "}
                {row.contact_phone && (
                  <a className="font-semibold text-gold" href={`tel:${row.contact_phone.replace(/[^\d+]/g, "")}`}>
                    {row.contact_phone}
                  </a>
                )}
              </>
            ) : (
              "—"
            )
          }
        />
        <Detail icon={Car} label="Travel" value={row.travel_notes ?? "—"} />
      </dl>
      {pulling ? (
        <form
          className="mt-3 flex flex-wrap gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            void act(() => umpireSelf.respond(row.id, false, note), "You've pulled out — the club has been told");
          }}
        >
          <input required className="scorer-input h-9 min-w-48 flex-1" maxLength={500} placeholder="Why you can't make it" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="app-chip-button">Pull out</button>
          <button type="button" className="app-chip-button" onClick={() => setPulling(false)}>
            Keep it
          </button>
        </form>
      ) : (
        <button type="button" className="app-chip-button mt-3" onClick={() => setPulling(true)}>
          Can't make it
        </button>
      )}
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof Gavel; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-gold" />
      <div className="min-w-0">
        <dt className="office-label">{label}</dt>
        <dd className="break-words">{value}</dd>
      </div>
    </div>
  );
}

function Claim({ row, panel, act }: { row: AppointmentRow; panel: MyPanel | undefined; act: Act }) {
  const rate = panel?.rules.travel_rate_minor ?? 0;
  const [km, setKm] = useState(row.travel_km != null ? String(row.travel_km) : "");
  const [amount, setAmount] = useState(row.expenses_minor ? (row.expenses_minor / 100).toFixed(2) : "");
  const [note, setNote] = useState(row.expenses_note ?? "");
  const status = row.payment_status as PaymentStatus;
  return (
    <form
      className="office-row"
      onSubmit={(event) => {
        event.preventDefault();
        const minor = amount.trim() ? toMinor(amount) : travelFor(Number(km) || 0, { travel_rate_minor: rate });
        if (minor === null) {
          toast.error("Enter the amount as a number, like 12.50");
          return;
        }
        void act(() => umpireSelf.claim(row.id, km.trim() ? Number(km) : null, minor, note), "Travel claim sent");
      }}
    >
      <span className="min-w-0">
        <span className="font-bold">{row.title}</span> <Pill tone={status === "due" ? "warn" : undefined}>{row.status === "completed" ? paymentStatusLabels[status] : "Waiting for sign-off"}</Pill>
        <span className="office-meta block">
          {panel?.organisation.name} · {day(row.starts_at)} · fee {money(row)}
          {row.expenses_minor ? ` + travel ${formatMinor(row.expenses_minor, row.currency)}` : ""}
          {rate ? ` · travel paid at ${formatMinor(rate, row.currency)}/km` : ""}
        </span>
      </span>
      <span className="flex w-full flex-wrap items-end gap-1 sm:w-auto">
        <input
          aria-label="Distance in km"
          inputMode="numeric"
          className="scorer-input h-9 w-20"
          placeholder="km"
          value={km}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "");
            setKm(value);
            if (rate) setAmount((travelFor(Number(value) || 0, { travel_rate_minor: rate }) / 100).toFixed(2));
          }}
        />
        <input aria-label="Travel amount" inputMode="decimal" className="scorer-input h-9 w-24" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input aria-label="Note" maxLength={500} className="scorer-input h-9 w-32" placeholder="Fuel, train…" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="app-chip-button">Claim</button>
      </span>
    </form>
  );
}

function Availability({ data, act }: { data: MyUmpireData; act: Act }) {
  const today = new Date().toISOString().slice(0, 10);
  const days = useMemo(() => Array.from({ length: 56 }, (_, i) => addDays(today, i)), [today]);
  const byDay = new Map(data.availability.map((row) => [row.day, row.status as AvailabilityStatus]));
  const matchDays = new Set(data.appointments.filter((row) => row.status === "accepted" || row.status === "offered").map((row) => dayIn(row.starts_at, row.timezone)));
  const tone: Record<AvailabilityStatus | "unknown", string> = {
    available: "border-success/50 bg-success/15",
    maybe: "border-gold/50 bg-gold/15",
    unavailable: "border-destructive/50 bg-destructive/15 line-through",
    unknown: "border-border",
  };
  const label: Record<AvailabilityStatus | "unknown", string> = { available: "Available", maybe: "Maybe", unavailable: "Unavailable", unknown: "Not set" };
  const setMany = (status: AvailabilityStatus) =>
    act(async () => {
      for (const value of days) {
        const weekday = new Date(`${value}T12:00:00Z`).getUTCDay();
        if ((weekday === 0 || weekday === 6) && !byDay.has(value)) await umpireSelf.setDay(data.userId, value, status);
      }
    }, "Weekends updated");
  return (
    <OfficeCard
      title="Availability — next 8 weeks"
      description="Tap a day: available → maybe → unavailable → clear. Every panel you're on sees it, and nobody can appoint you on a day you're unavailable."
      action={
        <button type="button" className="app-chip-button" onClick={() => void setMany("available")}>
          All open weekends available
        </button>
      }
    >
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7 }, (_, i) => (
          <span key={`pad${i}`} />
        ))}
        {days.map((value) => {
          const status = byDay.get(value) ?? "unknown";
          const date = new Date(`${value}T12:00:00Z`);
          return (
            <button
              key={value}
              type="button"
              aria-label={`${date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}: ${label[status]}`}
              className={`relative flex h-11 flex-col items-center justify-center rounded-lg border md:h-14 text-xs font-semibold transition-colors md:text-sm ${tone[status]}`}
              onClick={() => void act(() => umpireSelf.setDay(data.userId, value, nextAvailability[status]))}
            >
              <span>{date.getUTCDate()}</span>
              {date.getUTCDate() === 1 || value === today ? <span className="text-[9px] font-medium text-muted-foreground">{date.toLocaleDateString(undefined, { month: "short" })}</span> : null}
              {matchDays.has(value) && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-gold" aria-hidden />}
            </button>
          );
        })}
      </div>
      <p className="office-meta mt-2 flex flex-wrap gap-3">
        <span>
          <span className="inline-block size-2 rounded-full bg-gold" /> Match booked
        </span>
      </p>
    </OfficeCard>
  );
}

function PanelCard({ panel, act }: { panel: MyPanel; act: Act }) {
  const today = new Date().toISOString().slice(0, 10);
  const { umpire, rules } = panel;
  const missing = missingChecks(umpire, rules, today);
  const soon = expiringSoon(umpire, today);
  const [phone, setPhone] = useState(umpire.phone ?? "");
  const [area, setArea] = useState(umpire.home_area ?? "");
  const [km, setKm] = useState(umpire.max_travel_km != null ? String(umpire.max_travel_km) : "");
  const checks: [string, string | null, boolean][] = [
    ["Safeguarding check", umpire.safeguarding_expires, rules.requires_safeguarding],
    ["Qualification", umpire.qualification ? `${umpire.qualification}${umpire.qualification_expires ? ` · ${day(umpire.qualification_expires)}` : ""}` : null, rules.requires_qualification],
    ["First aid", umpire.first_aid_expires, rules.requires_first_aid],
  ];
  return (
    <OfficeCard title={panel.organisation.name} description={`${gradeLabels[umpire.grade as UmpireGrade] ?? umpire.grade} umpire · ${umpire.pay_basis === "voluntary" ? "Voluntary" : "Paid"}`}>
      <div className="space-y-1.5 text-sm">
        {checks.map(([name, value, required]) => (
          <div key={name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-gold" /> {name}
              {required ? "" : <span className="office-meta">(optional)</span>}
            </span>
            <span className="office-meta">{value ? (name === "Qualification" ? value : `until ${day(value)}`) : "Not recorded"}</span>
          </div>
        ))}
        {rules.requires_kit && <p className="office-meta">Kit check: {umpire.kit_ok ? "done" : "not done yet"}</p>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {missing.map((item) => (
          <Pill key={item} tone="bad">
            {item.startsWith("Paused") || item.startsWith("Left") ? item : `Needs ${item.toLowerCase()}`}
          </Pill>
        ))}
        {soon.map((item) => (
          <Pill key={item} tone="warn">
            {item} ends soon
          </Pill>
        ))}
        {missing.length === 0 && soon.length === 0 && <Pill tone="good">All checks in date</Pill>}
      </div>
      {missing.length > 0 && <p className="office-meta mt-1">Send your updated certificates to the panel's appointments officer.</p>}
      {panel.guidance && <p className="mt-3 whitespace-pre-line rounded-xl border border-border p-3 text-sm">{panel.guidance}</p>}
      {umpire.notes && <p className="office-meta mt-2">Note from the panel: {umpire.notes}</p>}
      <form
        className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void act(() => umpireSelf.updateDetails(umpire.id, phone, area, km.trim() ? Number(km) : null), "Details saved");
        }}
      >
        <OfficeField label="Phone">
          <input maxLength={40} className="scorer-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </OfficeField>
        <OfficeField label="Home area">
          <input maxLength={120} className="scorer-input" value={area} onChange={(e) => setArea(e.target.value)} />
        </OfficeField>
        <OfficeField label="Max km">
          <input inputMode="numeric" className="scorer-input" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} />
        </OfficeField>
        <div className="flex items-end">
          <button className="app-chip-button h-10">Save</button>
        </div>
      </form>
    </OfficeCard>
  );
}
