import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Ticket } from "lucide-react";
import { useCloudSession } from "@/hooks/use-cloud-session";
import { loadMyTickets, type MyTicket } from "@/lib/tickets-cloud";
import { MyTicketCard } from "@/components/tickets/MyTicketCard";
import { TicketSignIn } from "@/components/tickets/TicketSignIn";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export const Route = createFileRoute("/tickets")({
  head: () => ({
    meta: [
      { title: "My match tickets — CricLume" },
      { name: "description", content: "Your CricLume match tickets: payment status and the ticket code to show at the gate." },
      { property: "og:title", content: "My match tickets — CricLume" },
      { property: "og:description", content: "Your CricLume match tickets: payment status and the ticket code to show at the gate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyTicketsPage,
});

function MyTicketsPage() {
  const { session, loading, requestLink, signOut } = useCloudSession();
  const [tickets, setTickets] = useState<MyTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!session) return setTickets(null);
    try {
      setTickets(await loadMyTickets());
      setError(null);
    } catch {
      setError("Your tickets couldn't load. Check your connection and try again.");
    }
  }, [session]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const now = Date.now();
  const upcoming = (tickets ?? []).filter((t) => new Date(t.startsAt).getTime() > now - 6 * 3600_000 && t.status !== "cancelled");
  const past = (tickets ?? []).filter((t) => !upcoming.includes(t));
  return (
    <div className="club-site" data-accent="crimson">
      <header className="club-header">
        <div className="club-shell club-header-row">
          <Link to="/" className="club-brand">
            <Ticket aria-hidden="true" />
            <span className="club-brand-name">My tickets</span>
          </Link>
          <div className="club-header-tools">
            {session && (
              <button type="button" className="club-button club-button-ghost club-button-sm" onClick={() => void signOut()}>
                Sign out
              </button>
            )}
            <ThemeToggle pageDefault="light" />
          </div>
        </div>
      </header>
      <main className="club-shell club-page" id="site-main">
        <div className="club-page-head">
          <div>
            <h1>My tickets</h1>
            <p className="mt-1 text-sm opacity-80">Show the ticket code at the gate. Tickets you buy on any club's website appear here.</p>
          </div>
        </div>
        {loading ? (
          <p className="flex items-center gap-2 text-sm">
            <LoaderCircle className="size-4 animate-spin" /> Loading…
          </p>
        ) : !session ? (
          <TicketSignIn requestLink={requestLink} />
        ) : error ? (
          <section className="club-card">
            <p>{error}</p>
            <button type="button" className="club-button mt-3" onClick={() => void refresh()}>
              Try again
            </button>
          </section>
        ) : tickets === null ? (
          <p className="flex items-center gap-2 text-sm">
            <LoaderCircle className="size-4 animate-spin" /> Loading your tickets…
          </p>
        ) : tickets.length === 0 ? (
          <section className="club-card text-center">
            <Ticket className="mx-auto size-8 opacity-60" aria-hidden="true" />
            <p className="mt-2 font-bold">No tickets yet</p>
            <p className="text-sm opacity-75">Open your club's website and tap Tickets to buy some.</p>
          </section>
        ) : (
          <>
            <section className="space-y-3" aria-label="Coming up">
              {upcoming.length === 0 && <p className="text-sm opacity-75">No upcoming tickets.</p>}
              {upcoming.map((ticket) => (
                <MyTicketCard key={ticket.id} ticket={ticket} showClub onChange={() => void refresh()} />
              ))}
            </section>
            {past.length > 0 && (
              <section className="space-y-3" aria-label="Past and cancelled">
                <h2 className="text-lg font-bold opacity-80">Past and cancelled</h2>
                {past.map((ticket) => (
                  <MyTicketCard key={ticket.id} ticket={ticket} showClub onChange={() => void refresh()} />
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
