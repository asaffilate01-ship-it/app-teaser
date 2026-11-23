import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Copy, LoaderCircle, Ticket } from "lucide-react";
import { cleanReference, formatMoney, transferMethods } from "@/lib/club-office";
import { mostCanBuy } from "@/lib/tickets";
import { loadTicketPaymentOptions, requestTickets, type MyTicket, type PublicTicketListing, type TicketPaymentOption } from "@/lib/tickets-cloud";

const methodName = (method: string) => transferMethods.find(([value]) => value === method)?.[1] ?? method;
const field = "mt-1 w-full rounded-xl border border-[var(--site-line)] bg-transparent px-3 py-2 text-sm";

/** Buy form for one ticket sale: shows where to send the money, then takes the transfer reference. */
export function TicketBuy({ listing, mine, defaultName, onDone }: { listing: PublicTicketListing; mine: MyTicket[]; defaultName: string; onDone: () => void }) {
  const free = listing.priceMinor === 0;
  const held = mine.filter((t) => t.listingId === listing.id && (t.status === "pending" || t.status === "confirmed")).reduce((sum, t) => sum + t.quantity, 0);
  const most = mostCanBuy({ remaining: listing.remaining, maxPerOrder: listing.maxPerOrder, alreadyHeld: held });
  const [options, setOptions] = useState<TicketPaymentOption[] | null>(free ? [] : null);
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (free) return;
    let live = true;
    loadTicketPaymentOptions(listing.id)
      .then((rows) => {
        if (!live) return;
        setOptions(rows);
        setMethod(rows[0]?.method ?? "");
      })
      .catch(() => live && setOptions([]));
    return () => {
      live = false;
    };
  }, [free, listing.id]);

  if (most <= 0) return <p className="text-sm opacity-80">{held > 0 ? `You already hold the most tickets allowed (${listing.maxPerOrder}) for this match.` : "Sold out."}</p>;
  if (options === null)
    return (
      <p className="flex items-center gap-2 text-sm opacity-80">
        <LoaderCircle className="size-4 animate-spin" /> Loading payment details…
      </p>
    );
  if (!free && options.length === 0) return <p className="text-sm opacity-80">The club hasn't added its payment details yet. Please contact the club to buy tickets.</p>;

  const total = listing.priceMinor * quantity;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ref = free ? "" : cleanReference(reference);
    if (ref === null) return setError("Enter the transaction reference from your transfer (at least 3 characters).");
    setBusy(true);
    setError(null);
    try {
      const result = await requestTickets({ listingId: listing.id, quantity, name: name.trim(), phone: phone.trim(), method, reference: ref });
      toast.success(result.status === "confirmed" ? "Tickets confirmed" : "Sent — the club will check your payment");
      setReference("");
      onDone();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your tickets couldn't be requested.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="ticket-buy" onSubmit={(event) => void submit(event)}>
      {!free && (
        <div className="ticket-pay-steps">
          <p className="text-sm font-bold">1. Send {formatMoney(total, listing.currency)} to the club</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((option) => (
              <div key={`${option.method}-${option.account_number}`} className="ticket-account">
                <span className="min-w-0">
                  <span className="ticket-account-method">{methodName(option.method)}</span>
                  <span className="block font-bold">{option.account_number}</span>
                  <span className="block text-xs opacity-75">{option.account_title}</span>
                  {option.instructions && <span className="block text-xs opacity-75">{option.instructions}</span>}
                </span>
                <button
                  type="button"
                  className="club-button club-button-ghost club-button-sm"
                  aria-label={`Copy ${methodName(option.method)} number`}
                  onClick={() => void navigator.clipboard?.writeText(option.account_number).then(() => toast.success("Copied"))}
                >
                  <Copy /> Copy
                </button>
              </div>
            ))}
          </div>
          <p className="text-sm font-bold">2. Tell us the transfer reference</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Tickets
          <select className={field} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>
            {Array.from({ length: most }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                {value} {free ? "" : `· ${formatMoney(listing.priceMinor * value, listing.currency)}`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Name on the tickets
          <input required minLength={2} maxLength={80} className={field} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </label>
        <label className="text-sm">
          Phone (optional)
          <input maxLength={30} className={field} value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
        </label>
        {!free && (
          <>
            <label className="text-sm">
              Paid by
              <select className={field} value={method} onChange={(event) => setMethod(event.target.value)}>
                {[...new Set(options.map((option) => option.method))].map((value) => (
                  <option key={value} value={value}>
                    {methodName(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              Transaction reference
              <input required minLength={3} maxLength={120} className={field} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="e.g. TRX 8841 2290" />
            </label>
          </>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <button className="club-button" disabled={busy}>
        <Ticket /> {busy ? "Sending…" : free ? "Get free tickets" : "I've paid — send"}
      </button>
      {!free && <p className="text-xs opacity-70">Your seats are held while the club checks the payment. Your ticket code appears here once it's confirmed.</p>}
    </form>
  );
}
