/**
 * Match ticket rules. The database (`request_tickets`, `decide_ticket_order`, `check_in_ticket`)
 * is the real check; these mirror it so screens can show the same limits before anyone taps.
 */
import type { PlatformRole } from "./platform";

export type TicketStatus = "pending" | "confirmed" | "rejected" | "cancelled";

/** Owner, club/league admins and the treasurer set up ticket sales and check payments. */
export const ticketManagerRoles: readonly PlatformRole[] = ["owner", "club_admin", "league_admin", "treasurer"];
/** Gate staff can also check tickets in on match day. */
export const ticketGateRoles: readonly PlatformRole[] = [...ticketManagerRoles, "team_manager", "coach"];

export const isTicketManager = (role: PlatformRole) => ticketManagerRoles.includes(role);
export const isTicketGate = (role: PlatformRole) => ticketGateRoles.includes(role);

interface OrderLike {
  quantity: number;
  status: string;
  amount_minor?: number | string;
  checked_in_at?: string | null;
}

/** Pending and confirmed orders both hold seats, so nobody can be sold a seat that's waiting on a payment check. */
export function ticketsLeft(capacity: number, orders: OrderLike[]): number {
  const held = orders.filter((order) => order.status === "pending" || order.status === "confirmed").reduce((sum, order) => sum + order.quantity, 0);
  return Math.max(0, capacity - held);
}

/** Most tickets one buyer can ask for right now. */
export function mostCanBuy(input: { remaining: number; maxPerOrder: number; alreadyHeld?: number }): number {
  return Math.max(0, Math.min(input.remaining, input.maxPerOrder - (input.alreadyHeld ?? 0)));
}

export function listingTotals(capacity: number, orders: OrderLike[]) {
  let sold = 0;
  let waiting = 0;
  let admitted = 0;
  let takenMinor = 0;
  for (const order of orders) {
    if (order.status === "confirmed") {
      sold += order.quantity;
      takenMinor += Number(order.amount_minor ?? 0);
      if (order.checked_in_at) admitted += order.quantity;
    } else if (order.status === "pending") waiting += order.quantity;
  }
  return { sold, waiting, admitted, takenMinor, left: ticketsLeft(capacity, orders) };
}

/** Ticket codes are 10 letters/digits; shown as two groups of five so they're easy to read out at the gate. */
export function formatTicketCode(code: string): string {
  const clean = normaliseTicketCode(code);
  return clean.length === 10 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
}

export function normaliseTicketCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const ticketStatusLabel: Record<TicketStatus, string> = {
  pending: "Payment being checked",
  confirmed: "Confirmed",
  rejected: "Payment not found",
  cancelled: "Cancelled",
};
