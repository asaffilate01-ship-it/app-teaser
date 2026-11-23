import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CheckCircle2, LoaderCircle, ScanLine, Ticket, XCircle } from "lucide-react";
import { formatMoney, toMinor, transferMethods } from "@/lib/club-office";
import { formatTicketCode, isTicketGate, isTicketManager, listingTotals, normaliseTicketCode } from "@/lib/tickets";
import { loadTicketDesk, ticketDesk, type CheckInResult, type TicketListing, type TicketOrder } from "@/lib/tickets-cloud";
import { Empty, OfficeCard, OfficeField, Pill, currencies, fromLocal, when, type OfficeProps } from "./ui";

const methodName = (method: string | null) => transferMethods.find(([value]) => value === method)?.[1] ?? method ?? "";

/** Match tickets: set up sales, check transfer payments, and check fans in at the gate. */
export function TicketsPanel(props: OfficeProps) {
  const { organisationId, role } = props;
  const manager = isTicketManager(role);
  const [desk, setDesk] = useState<{ listings: TicketListing[]; orders: TicketOrder[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setDesk(await loadTicketDesk(organisationId));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tickets could not load.");
    }
  }, [organisationId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const run = async (action: () => Promise<void>, done: string) => {
    try {
      await action();
      toast.success(done);
      await reload();
      return true;
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "That didn't work.");
      await reload();
      return false;
    }
  };

  if (!isTicketGate(role)) return <Empty>Only club staff can see ticket sales.</Empty>;
  if (!desk)
    return error ? (
      <Empty>{error}</Empty>
    ) : (
      <div className="office-card flex items-center gap-2 text-sm">
        <LoaderCircle className="size-4 animate-spin" /> Loading tickets…
      </div>
    );

  const pending = desk.orders.filter((order) => order.status === "pending");
  return (
    <div className="space-y-4">
      <GateCheck organisationId={organisationId} onDone={() => void reload()} />
      {manager && pending.length > 0 && (
        <OfficeCard title={`Ticket payments to check (${pending.length})`} description="Find each reference in your bank or wallet app. Confirm it to send the fan their ticket code.">
          <div className="space-y-2">
            {pending.map((order) => {
              const listing = desk.listings.find((row) => row.id === order.listing_id);
              return (
                <div key={order.id} className="office-row">
                  <span className="min-w-0">
                    <span className="font-bold">
                      {formatMoney(Number(order.amount_minor), order.currency)} · {methodName(order.method)} · ref {order.reference}
                    </span>
                    <span className="office-meta block">
                      {order.quantity} × {listing?.title ?? "Tickets"} · {order.buyer_name}
                      {order.buyer_phone ? ` · ${order.buyer_phone}` : ""} · {when(order.created_at)}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <button type="button" className="app-chip-button" onClick={() => void run(() => ticketDesk.decide(order.id, true), "Confirmed — the fan can see their code")}>
                      <CheckCircle2 className="size-3.5" /> Confirm
                    </button>
                    <button
                      type="button"
                      className="app-chip-button"
                      onClick={() => {
                        const note = window.prompt("Why? The fan sees this (e.g. reference not found)") ?? "";
                        void run(() => ticketDesk.decide(order.id, false, note), "Marked not found — the seats are free again");
                      }}
                    >
                      <XCircle className="size-3.5" /> Not found
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </OfficeCard>
      )}
      {manager && <NewListing {...props} payments={props.data.paymentAccounts.filter((a) => a.active).length} onDone={() => void reload()} />}
      <OfficeCard
        title="Ticket sales"
        description="Fans buy on your published club website's Tickets page with a free CricLume account."
      >
        {desk.listings.length === 0 ? (
          <Empty>No ticket sales yet.</Empty>
        ) : (
          <div className="space-y-3">
            {desk.listings.map((listing) => (
              <ListingRow key={listing.id} listing={listing} orders={desk.orders.filter((order) => order.listing_id === listing.id)} manager={manager} run={run} />
            ))}
          </div>
        )}
      </OfficeCard>
    </div>
  );
}

function GateCheck({ organisationId, onDone }: { organisationId: string; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const clean = normaliseTicketCode(code);
    if (clean.length < 6) return;
    setBusy(true);
    try {
      setResult(await ticketDesk.checkIn(organisationId, clean));
      setCode("");
      onDone();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't check that code.");
    } finally {
      setBusy(false);
    }
  };
  const tone = result?.result === "admitted" ? "good" : result?.result === "already" ? "warn" : "bad";
  return (
    <OfficeCard title="Gate check-in" description="Type the code on the fan's phone. Each ticket code lets its tickets in once.">
      <form className="flex flex-wrap gap-2" onSubmit={(event) => void submit(event)}>
        <input
          aria-label="Ticket code"
          className="scorer-input h-11 min-w-0 flex-1 font-mono uppercase tracking-widest"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="ABCDE-12345"
          autoCapitalize="characters"
          autoComplete="off"
        />
        <button className="action-primary" disabled={busy}>
          <ScanLine className="size-4" /> Check in
        </button>
      </form>
      {result && (
        <div className={`ticket-gate-result ticket-gate-${tone}`} role="status">
          {result.result === "unknown" && <strong>Code not found — check it and try again.</strong>}
          {result.result === "admitted" && (
            <strong>
              Let in {result.quantity} · {result.name} · {result.title}
            </strong>
          )}
          {result.result === "already" && (
            <strong>
              Already used {result.at ? when(result.at) : ""} · {result.name} ({result.quantity})
            </strong>
          )}
          {result.result === "not_valid" && (
            <strong>
              Not valid — payment {result.status === "pending" ? "still being checked" : result.status} · {result.name}
            </strong>
          )}
        </div>
      )}
    </OfficeCard>
  );
}

function ListingRow({ listing, orders, manager, run }: { listing: TicketListing; orders: TicketOrder[]; manager: boolean; run: (action: () => Promise<void>, done: string) => Promise<boolean> }) {
  const [showOrders, setShowOrders] = useState(false);
  const totals = listingTotals(listing.capacity, orders);
  const past = new Date(listing.starts_at).getTime() < Date.now() - 6 * 3600_000;
  const confirmed = orders.filter((order) => order.status === "confirmed");
  return (
    <div className="office-row flex-col !items-stretch">
      <div className="flex w-full flex-wrap items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="font-bold">{listing.title}</span>
          <span className="office-meta block">
            {when(listing.starts_at)}
            {listing.venue ? ` · ${listing.venue}` : ""} · {Number(listing.price_minor) === 0 ? "Free" : formatMoney(Number(listing.price_minor), listing.currency)} each
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {past ? <Pill>Finished</Pill> : listing.on_sale ? <Pill tone="good">On sale</Pill> : <Pill tone="warn">Paused</Pill>}
        </span>
      </div>
      <div className="ticket-desk-stats">
        <span><strong>{totals.sold}</strong> sold</span>
        <span><strong>{totals.waiting}</strong> being checked</span>
        <span><strong>{totals.left}</strong> left of {listing.capacity}</span>
        <span><strong>{totals.admitted}</strong> through the gate</span>
        {manager && <span><strong>{formatMoney(totals.takenMinor, listing.currency)}</strong> confirmed</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {manager && !past && (
          <button type="button" className="app-chip-button" onClick={() => void run(() => ticketDesk.updateListing(listing.id, { on_sale: !listing.on_sale }), listing.on_sale ? "Sales paused" : "Back on sale")}>
            {listing.on_sale ? "Pause sales" : "Put on sale"}
          </button>
        )}
        {manager && !past && (
          <button
            type="button"
            className="app-chip-button"
            onClick={() => {
              const value = window.prompt("Total seats", String(listing.capacity));
              if (value != null && /^\d+$/.test(value) && Number(value) >= 1) void run(() => ticketDesk.updateListing(listing.id, { capacity: Number(value) }), "Seats updated");
            }}
          >
            Change seats
          </button>
        )}
        {confirmed.length > 0 && (
          <button type="button" className="app-chip-button" aria-expanded={showOrders} onClick={() => setShowOrders(!showOrders)}>
            {showOrders ? "Hide ticket list" : `Ticket list (${confirmed.length})`}
          </button>
        )}
      </div>
      {showOrders && (
        <div className="space-y-1.5">
          {confirmed.map((order) => (
            <div key={order.id} className="ticket-desk-order">
              <span className="font-mono text-xs tracking-wider">{formatTicketCode(order.code)}</span>
              <span className="min-w-0 flex-1 truncate">
                {order.buyer_name} · {order.quantity}
                {order.reference ? ` · ref ${order.reference}` : ""}
              </span>
              {order.checked_in_at ? <Pill tone="good">In</Pill> : manager ? (
                <button
                  type="button"
                  className="app-chip-button"
                  onClick={() => {
                    if (window.confirm(`Cancel ${order.buyer_name}'s ${order.quantity} ticket(s)? Refund them by hand.`)) void run(() => ticketDesk.cancel(order.id), "Ticket cancelled");
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewListing({ data, organisationId, payments, onDone }: OfficeProps & { payments: number; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [venue, setVenue] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState(data.schedules[0]?.currency ?? data.items.find((item) => item.currency)?.currency ?? "GBP");
  const [capacity, setCapacity] = useState(200);
  const [maxPerOrder, setMaxPerOrder] = useState(6);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const iso = fromLocal(startsAt);
    const minor = price.trim() ? toMinor(price, currency) : 0;
    if (!iso || minor === null) {
      toast.error("Check the date and price.");
      return;
    }
    setBusy(true);
    try {
      await ticketDesk.addListing({
        organisation_id: organisationId,
        title: title.trim(),
        starts_at: iso,
        venue: venue.trim() || null,
        price_minor: minor,
        currency,
        capacity,
        max_per_order: maxPerOrder,
        details: details.trim() || null,
      });
      toast.success("Tickets on sale");
      setTitle("");
      setDetails("");
      onDone();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Couldn't add the ticket sale.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <OfficeCard title="Sell tickets for a match" description="Fans pay by bank or wallet transfer and add the reference; you confirm it here. Free tickets are confirmed straight away.">
      {payments === 0 && (
        <p className="office-meta mb-3">
          <Pill tone="warn">Add payment details first</Pill> Fans need your Raast, wallet or bank details — add them under Fees → Club payment details.
        </p>
      )}
      <form onSubmit={(event) => void submit(event)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OfficeField label="Match or event" className="sm:col-span-2">
          <input required minLength={3} maxLength={120} className="scorer-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="1st XI v Lahore Gymkhana — final" />
        </OfficeField>
        <OfficeField label="Starts">
          <input required type="datetime-local" className="scorer-input" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        </OfficeField>
        <OfficeField label="Venue (optional)">
          <input maxLength={160} className="scorer-input" value={venue} onChange={(event) => setVenue(event.target.value)} />
        </OfficeField>
        <OfficeField label="Price per ticket (blank = free)">
          <input inputMode="decimal" className="scorer-input" value={price} onChange={(event) => setPrice(event.target.value)} />
        </OfficeField>
        <OfficeField label="Currency">
          <select className="scorer-input" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {currencies.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </OfficeField>
        <OfficeField label="Seats">
          <input type="number" min={1} max={100000} className="scorer-input" value={capacity} onChange={(event) => setCapacity(Math.max(1, Number(event.target.value) || 1))} />
        </OfficeField>
        <OfficeField label="Most per fan">
          <input type="number" min={1} max={20} className="scorer-input" value={maxPerOrder} onChange={(event) => setMaxPerOrder(Math.min(20, Math.max(1, Number(event.target.value) || 1)))} />
        </OfficeField>
        <OfficeField label="Details (optional)" className="sm:col-span-2 lg:col-span-3">
          <input maxLength={500} className="scorer-input" value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Gates open 1pm. Under-12s free with an adult." />
        </OfficeField>
        <div className="flex items-end">
          <button className="action-primary w-full" disabled={busy}>
            <Ticket className="size-4" /> Put on sale
          </button>
        </div>
      </form>
    </OfficeCard>
  );
}
