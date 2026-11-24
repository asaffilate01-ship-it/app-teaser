import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { siteFromMatches, siteHead } from "@/lib/club-site-query";
import { formatMoney } from "@/lib/club-office";
import { getClubTickets } from "@/lib/tickets.functions";
import { loadMyTickets, type MyTicket, type PublicTicketListing } from "@/lib/tickets-cloud";
import { useCloudSession } from "@/hooks/use-cloud-session";
import { TicketBuy } from "@/components/tickets/TicketBuy";
import { TicketSignIn } from "@/components/tickets/TicketSignIn";
import { MyTicketCard } from "@/components/tickets/MyTicketCard";

const layoutRoute = getRouteApi("/club/$slug");

export const Route = createFileRoute("/club/$slug/tickets")({
  loader: async ({ params }) => ({
    listings: await getClubTickets({ data: { slug: params.slug } }),
  }),
  staleTime: 30_000,
  head: ({ matches }) =>
    siteHead(siteFromMatches(matches), {
      path: "/tickets",
      title: "Tickets",
      description: (name) =>
        `Buy match tickets for ${name} — pay by bank or wallet transfer and show your ticket code at the gate.`,
    }),
  component: TicketsPage,
});

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

function TicketsPage() {
  const { site } = layoutRoute.useLoaderData();
  const { listings } = Route.useLoaderData();
  const router = useRouter();
  const { session, loading, requestLink } = useCloudSession();
  const [mine, setMine] = useState<MyTicket[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return setMine([]);
    try {
      setMine(await loadMyTickets());
    } catch {
      setMine([]);
    }
  }, [session]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!site?.published) return null;
  const listingIds = new Set(listings.map((l) => l.id));
  const myHere = mine.filter((t) => listingIds.has(t.listingId) && t.status !== "cancelled");
  const defaultName = String(
    session?.user.user_metadata?.["full_name"] ?? session?.user.user_metadata?.["name"] ?? "",
  );

  return (
    <div className="club-shell club-page">
      <div className="club-page-head">
        <div>
          <h1>Tickets</h1>
          <p className="mt-1 text-sm opacity-80">
            Pay {site.name} by bank or wallet transfer, add the reference, and your ticket code
            appears once the club confirms it.
          </p>
        </div>
        {session && (
          <a
            href={site.domain ? "https://criclume.com/tickets" : "/tickets"}
            className="club-button club-button-ghost club-button-sm"
          >
            <Ticket /> All my tickets
          </a>
        )}
      </div>

      {myHere.length > 0 && (
        <section aria-label="Your tickets" className="space-y-3">
          <h2 className="text-lg font-bold">Your tickets</h2>
          {myHere.map((ticket) => (
            <MyTicketCard
              key={ticket.id}
              ticket={ticket}
              onChange={() => void Promise.all([refresh(), router.invalidate()])}
            />
          ))}
        </section>
      )}

      {listings.length === 0 ? (
        <section className="club-card text-center">
          <Ticket className="mx-auto size-8 opacity-60" aria-hidden="true" />
          <p className="mt-2 font-bold">No tickets on sale right now</p>
          <p className="text-sm opacity-75">Check back nearer match day.</p>
        </section>
      ) : (
        <div className="ticket-grid">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              open={open === listing.id}
              onToggle={() => setOpen(open === listing.id ? null : listing.id)}
              buy={
                loading ? null : session ? (
                  <TicketBuy
                    listing={listing}
                    mine={mine}
                    defaultName={defaultName}
                    onDone={() => {
                      setOpen(null);
                      void Promise.all([refresh(), router.invalidate()]);
                    }}
                  />
                ) : (
                  <TicketSignIn requestLink={requestLink} />
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ListingCard({
  listing,
  open,
  onToggle,
  buy,
}: {
  listing: PublicTicketListing;
  open: boolean;
  onToggle: () => void;
  buy: ReactNode;
}) {
  const soldOut = listing.remaining <= 0;
  return (
    <article className="club-card ticket-listing">
      <div className="ticket-listing-head">
        <div className="min-w-0">
          <h2 className="ticket-listing-title">{listing.title}</h2>
          <p className="ticket-listing-meta">
            <CalendarDays aria-hidden="true" /> {when(listing.startsAt)}
          </p>
          {listing.venue && (
            <p className="ticket-listing-meta">
              <MapPin aria-hidden="true" /> {listing.venue}
            </p>
          )}
          {listing.details && <p className="mt-2 text-sm opacity-80">{listing.details}</p>}
        </div>
        <div className="ticket-price">
          <span className="ticket-price-amount">
            {listing.priceMinor === 0 ? "Free" : formatMoney(listing.priceMinor, listing.currency)}
          </span>
          <span className="ticket-price-left">
            {soldOut
              ? "Sold out"
              : listing.remaining <= 20
                ? `Only ${listing.remaining} left`
                : "per ticket"}
          </span>
        </div>
      </div>
      {!soldOut && (
        <button
          type="button"
          className={`club-button ${open ? "club-button-ghost" : ""}`}
          aria-expanded={open}
          onClick={onToggle}
        >
          <Ticket /> {open ? "Close" : "Get tickets"}
        </button>
      )}
      {open && !soldOut && <div className="ticket-listing-buy">{buy}</div>}
    </article>
  );
}
