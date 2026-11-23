import { toast } from "sonner";
import { formatMoney } from "@/lib/club-office";
import { formatTicketCode, ticketStatusLabel } from "@/lib/tickets";
import { ticketDesk, type MyTicket } from "@/lib/tickets-cloud";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** One of the signed-in fan's ticket orders. The big code is what the gate staff type in. */
export function MyTicketCard({ ticket, showClub = false, onChange }: { ticket: MyTicket; showClub?: boolean; onChange: () => void }) {
  const tone = ticket.status === "confirmed" ? "good" : ticket.status === "pending" ? "warn" : "bad";
  return (
    <article className={`ticket-stub ticket-stub-${tone}`}>
      <div className="ticket-stub-main">
        <p className="ticket-stub-kicker">{showClub ? `${ticket.club} · ` : ""}{when(ticket.startsAt)}</p>
        <h3 className="ticket-stub-title">{ticket.title}</h3>
        <p className="text-sm opacity-80">
          {ticket.quantity} {ticket.quantity === 1 ? "ticket" : "tickets"}
          {ticket.amountMinor > 0 ? ` · ${formatMoney(ticket.amountMinor, ticket.currency)}` : " · free"}
          {ticket.venue ? ` · ${ticket.venue}` : ""}
        </p>
        {ticket.note && <p className="text-xs opacity-75">Club note: {ticket.note}</p>}
      </div>
      <div className="ticket-stub-side">
        <span className={`ticket-status ticket-status-${tone}`}>{ticket.checkedInAt ? "Used" : ticketStatusLabel[ticket.status]}</span>
        {ticket.code ? (
          <span className="ticket-code" aria-label="Ticket code">
            {formatTicketCode(ticket.code)}
          </span>
        ) : ticket.status === "pending" ? (
          <span className="text-xs opacity-75">Ref {ticket.reference}</span>
        ) : null}
        {ticket.status === "pending" && (
          <button
            type="button"
            className="club-button club-button-ghost club-button-sm"
            onClick={() => {
              if (!window.confirm("Cancel this ticket request?")) return;
              void ticketDesk
                .cancel(ticket.id)
                .then(() => {
                  toast.success("Request cancelled");
                  onChange();
                })
                .catch((reason: unknown) => toast.error(reason instanceof Error ? reason.message : "Couldn't cancel"));
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </article>
  );
}
