import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { friendly } from "./club-office-cloud";

type Tables = Database["public"]["Tables"];
export type TicketListing = Tables["ticket_listings"]["Row"];
export type TicketOrder = Tables["ticket_orders"]["Row"];

export interface PublicTicketListing {
  id: string;
  title: string;
  details: string | null;
  startsAt: string;
  venue: string | null;
  priceMinor: number;
  currency: string;
  maxPerOrder: number;
  remaining: number;
}

export interface MyTicket {
  id: string;
  listingId: string;
  title: string;
  startsAt: string;
  venue: string | null;
  club: string;
  quantity: number;
  amountMinor: number;
  currency: string;
  method: string | null;
  reference: string | null;
  status: "pending" | "confirmed" | "rejected" | "cancelled";
  code: string | null;
  checkedInAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface TicketPaymentOption {
  method: string;
  account_title: string;
  account_number: string;
  instructions: string | null;
}

export type CheckInResult =
  | { result: "unknown" }
  | {
      result: "admitted" | "already" | "not_valid";
      title: string;
      name: string;
      quantity: number;
      at?: string;
      status?: string;
    };

function fail(error: { message: string } | null) {
  if (error) throw new Error(friendly(error.message));
}

export async function loadTicketDesk(
  organisationId: string,
): Promise<{ listings: TicketListing[]; orders: TicketOrder[] }> {
  const [listings, orders] = await Promise.all([
    supabase
      .from("ticket_listings")
      .select("*")
      .eq("organisation_id", organisationId)
      .order("starts_at", { ascending: false })
      .limit(100),
    supabase
      .from("ticket_orders")
      .select("*")
      .eq("organisation_id", organisationId)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  fail(listings.error);
  fail(orders.error);
  return { listings: listings.data ?? [], orders: orders.data ?? [] };
}

export const ticketDesk = {
  async addListing(input: Tables["ticket_listings"]["Insert"]) {
    fail((await supabase.from("ticket_listings").insert(input)).error);
  },
  async updateListing(id: string, patch: Tables["ticket_listings"]["Update"]) {
    fail((await supabase.from("ticket_listings").update(patch).eq("id", id)).error);
  },
  async decide(orderId: string, confirm: boolean, note = "") {
    fail(
      (
        await supabase.rpc("decide_ticket_order", {
          p_order: orderId,
          p_confirm: confirm,
          p_note: note,
        })
      ).error,
    );
  },
  async cancel(orderId: string) {
    fail((await supabase.rpc("cancel_ticket_order", { p_order: orderId })).error);
  },
  async checkIn(organisationId: string, code: string): Promise<CheckInResult> {
    const { data, error } = await supabase.rpc("check_in_ticket", {
      p_org: organisationId,
      p_code: code,
    });
    fail(error);
    return data as unknown as CheckInResult;
  },
};

export async function loadMyTickets(): Promise<MyTicket[]> {
  const { data, error } = await supabase.rpc("my_tickets");
  fail(error);
  return (data as unknown as MyTicket[] | null) ?? [];
}

export async function loadTicketPaymentOptions(listingId: string): Promise<TicketPaymentOption[]> {
  const { data, error } = await supabase.rpc("ticket_payment_options", { p_listing: listingId });
  fail(error);
  return (data ?? []) as TicketPaymentOption[];
}

export async function requestTickets(input: {
  listingId: string;
  quantity: number;
  name: string;
  phone: string;
  method: string;
  reference: string;
}) {
  const { data, error } = await supabase.rpc("request_tickets", {
    p_listing: input.listingId,
    p_quantity: input.quantity,
    p_name: input.name,
    p_phone: input.phone,
    p_method: input.method,
    p_reference: input.reference,
  });
  fail(error);
  return data as unknown as { id: string; status: string; code: string | null };
}

export async function fetchClubTickets(slug: string): Promise<PublicTicketListing[]> {
  const { data, error } = await supabase.rpc("get_club_tickets", { p_slug: slug });
  fail(error);
  return ((data as unknown as { listings?: PublicTicketListing[] } | null)?.listings ?? []).map(
    (row) => ({ ...row, priceMinor: Number(row.priceMinor), remaining: Number(row.remaining) }),
  );
}
