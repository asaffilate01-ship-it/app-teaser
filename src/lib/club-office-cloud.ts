import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type ClubEvent = Tables["club_events"]["Row"];
export type AvailabilityRow = Tables["event_availability"]["Row"];
export type SelectionRow = Tables["event_selections"]["Row"];
export type RideOffer = Tables["ride_offers"]["Row"];
export type RideBooking = Tables["ride_bookings"]["Row"];
export type DriverRow = Tables["travel_drivers"]["Row"];
export type FeeSchedule = Tables["fee_schedules"]["Row"];
export type FeeCharge = Tables["fee_charges"]["Row"];
export type FeePayment = Tables["fee_payments"]["Row"];
export type GroundBooking = Tables["ground_bookings"]["Row"];
export type ClubItem = Tables["club_items"]["Row"];
export type ItemOrder = Tables["item_orders"]["Row"];
export type EquipmentLoan = Tables["equipment_loans"]["Row"];
export type GuardianLink = Tables["player_guardians"]["Row"];
export type PaymentAccount = Tables["club_payment_accounts"]["Row"];
export type PaymentClaim = Tables["fee_payment_claims"]["Row"];
export interface BookableGround {
  ground_id: string;
  ground_name: string;
  organisation_id: string;
  organisation_name: string;
  booking_note: string | null;
  timezone: string;
}
export interface OwnGround {
  id: string;
  name: string;
  bookable: boolean;
  booking_note: string | null;
}

export interface ClubOfficeData {
  userId: string;
  myPlayerIds: string[];
  events: ClubEvent[];
  availability: AvailabilityRow[];
  selections: SelectionRow[];
  rides: RideOffer[];
  rideBookings: RideBooking[];
  drivers: DriverRow[];
  approvedDriverIds: string[];
  schedules: FeeSchedule[];
  charges: FeeCharge[];
  payments: FeePayment[];
  paymentAccounts: PaymentAccount[];
  claims: PaymentClaim[];
  grounds: OwnGround[];
  bookings: GroundBooking[];
  bookableGrounds: BookableGround[];
  items: ClubItem[];
  orders: ItemOrder[];
  loans: EquipmentLoan[];
  guardians: GuardianLink[];
}

function must<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T;
}

/** Everything the Club office shows. Row-level security decides what each person gets back. */
export async function loadClubOffice(organisationId: string): Promise<ClubOfficeData> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sign in again to open the club office.");
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const org = organisationId;
  const [events, myPlayers, guardians, schedules, charges, payments, grounds, bookings, bookable, items, orders, loans, drivers, approved, accounts, claims] =
    await Promise.all([
      supabase.from("club_events").select("*").eq("organisation_id", org).gte("starts_at", since).order("starts_at").limit(200),
      supabase.from("players").select("id").eq("organisation_id", org).eq("linked_user_id", userId),
      supabase.from("player_guardians").select("*").eq("organisation_id", org),
      supabase.from("fee_schedules").select("*").eq("organisation_id", org).order("created_at", { ascending: false }),
      supabase.from("fee_charges").select("*").eq("organisation_id", org).order("created_at", { ascending: false }).limit(1000),
      supabase.from("fee_payments").select("*").eq("organisation_id", org).order("paid_on", { ascending: false }).limit(1000),
      supabase.from("grounds").select("id,name,bookable,booking_note").eq("organisation_id", org).order("name"),
      supabase
        .from("ground_bookings")
        .select("*")
        .or(`organisation_id.eq.${org},requester_organisation_id.eq.${org}`)
        .gte("ends_at", since)
        .order("starts_at")
        .limit(300),
      supabase.rpc("list_bookable_grounds"),
      supabase.from("club_items").select("*").eq("organisation_id", org).order("name"),
      supabase.from("item_orders").select("*").eq("organisation_id", org).order("created_at", { ascending: false }).limit(300),
      supabase.from("equipment_loans").select("*").eq("organisation_id", org).order("issued_at", { ascending: false }).limit(300),
      supabase.from("travel_drivers").select("*").eq("organisation_id", org),
      supabase.rpc("approved_driver_ids", { p_org: org }),
      supabase.from("club_payment_accounts").select("*").eq("organisation_id", org).order("created_at"),
      supabase.from("fee_payment_claims").select("*").eq("organisation_id", org).order("created_at", { ascending: false }).limit(500),
    ]);
  const eventRows = must(events) as ClubEvent[];
  const eventIds = eventRows.map((event) => event.id);
  const [availability, selections, rides] = eventIds.length
    ? await Promise.all([
        supabase.from("event_availability").select("*").in("event_id", eventIds),
        supabase.from("event_selections").select("*").in("event_id", eventIds),
        supabase.from("ride_offers").select("*").in("event_id", eventIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const rideRows = must(rides) as RideOffer[];
  const rideBookings = rideRows.length
    ? (must(await supabase.from("ride_bookings").select("*").in("ride_id", rideRows.map((ride) => ride.id))) as RideBooking[])
    : [];
  const guardianRows = must(guardians) as GuardianLink[];
  const myPlayerIds = [
    ...new Set([
      ...(must(myPlayers) as { id: string }[]).map((row) => row.id),
      ...guardianRows.filter((row) => row.user_id === userId).map((row) => row.player_id),
    ]),
  ];
  return {
    userId,
    myPlayerIds,
    events: eventRows,
    availability: must(availability) as AvailabilityRow[],
    selections: must(selections) as SelectionRow[],
    rides: rideRows,
    rideBookings,
    drivers: must(drivers) as DriverRow[],
    approvedDriverIds: ((approved.data ?? []) as unknown as string[]).map(String),
    schedules: must(schedules) as FeeSchedule[],
    charges: must(charges) as FeeCharge[],
    payments: must(payments) as FeePayment[],
    paymentAccounts: must(accounts) as PaymentAccount[],
    claims: must(claims) as PaymentClaim[],
    grounds: must(grounds) as OwnGround[],
    bookings: must(bookings) as GroundBooking[],
    bookableGrounds: ((bookable.data ?? []) as BookableGround[]).filter((ground) => ground.organisation_id !== org),
    items: must(items) as ClubItem[],
    orders: must(orders) as ItemOrder[],
    loans: must(loans) as EquipmentLoan[],
    guardians: guardianRows,
  };
}

function check(result: { error: { message: string } | null }) {
  if (result.error) throw new Error(friendly(result.error.message));
}

/** Database refusals arrive as plain sentences already; trim the technical prefix if any. */
export function friendly(message: string): string {
  if (/row-level security/i.test(message)) return "Your role doesn't allow that.";
  if (/ground_bookings_no_double/i.test(message)) return "That time clashes with another approved booking.";
  if (/fee_payment_claims_reference_once/i.test(message)) return "That transaction reference has already been sent.";
  if (/duplicate key/i.test(message)) return "That's already been added.";
  return message.replace(/^.*?ERROR:\s*/i, "");
}

export const office = {
  async createEvent(input: Tables["club_events"]["Insert"]) {
    check(await supabase.from("club_events").insert(input));
  },
  async updateEvent(id: string, patch: Tables["club_events"]["Update"]) {
    check(await supabase.from("club_events").update(patch).eq("id", id));
  },
  async answer(input: { organisationId: string; eventId: string; playerId: string; status: "available" | "unavailable" | "maybe"; note?: string }) {
    check(
      await supabase.from("event_availability").upsert(
        { organisation_id: input.organisationId, event_id: input.eventId, player_id: input.playerId, status: input.status, note: input.note ?? null },
        { onConflict: "event_id,player_id" },
      ),
    );
  },
  async pick(input: Tables["event_selections"]["Insert"]) {
    check(await supabase.from("event_selections").upsert(input, { onConflict: "event_id,player_id" }));
  },
  async unpick(eventId: string, playerId: string) {
    check(await supabase.from("event_selections").delete().eq("event_id", eventId).eq("player_id", playerId));
  },
  async setRole(eventId: string, playerId: string, field: "captain" | "wicketkeeper") {
    check(await supabase.rpc("set_selection_role", { p_event_id: eventId, p_player_id: playerId, p_field: field }));
  },
  async offerRide(input: Tables["ride_offers"]["Insert"]) {
    check(await supabase.from("ride_offers").insert(input));
  },
  async cancelRide(id: string) {
    check(await supabase.from("ride_offers").update({ cancelled_at: new Date().toISOString() }).eq("id", id));
  },
  async requestSeat(input: { organisationId: string; rideId: string; playerId: string; guardianConsent: boolean }) {
    check(
      await supabase.from("ride_bookings").upsert(
        { organisation_id: input.organisationId, ride_id: input.rideId, player_id: input.playerId, guardian_consent: input.guardianConsent, status: "requested" },
        { onConflict: "ride_id,player_id" },
      ),
    );
  },
  async setSeat(id: string, status: "confirmed" | "declined" | "cancelled") {
    check(await supabase.from("ride_bookings").update({ status }).eq("id", id));
  },
  async approveDriver(input: { organisationId: string; userId: string; expiresOn: string | null; checksNote: string }) {
    check(
      await supabase.from("travel_drivers").upsert(
        { organisation_id: input.organisationId, user_id: input.userId, expires_on: input.expiresOn, checks_note: input.checksNote || null, revoked_at: null },
        { onConflict: "organisation_id,user_id" },
      ),
    );
  },
  async revokeDriver(id: string) {
    check(await supabase.from("travel_drivers").update({ revoked_at: new Date().toISOString() }).eq("id", id));
  },
  async addSchedule(input: Tables["fee_schedules"]["Insert"]) {
    check(await supabase.from("fee_schedules").insert(input));
  },
  async chargePlayers(schedule: FeeSchedule, playerIds: string[]) {
    if (!playerIds.length) return;
    check(await supabase.rpc("charge_fee_schedule", { p_schedule_id: schedule.id, p_player_ids: playerIds }));
  },
  async recordPayment(input: Tables["fee_payments"]["Insert"]) {
    check(await supabase.from("fee_payments").insert(input));
  },
  async addPaymentAccount(input: Tables["club_payment_accounts"]["Insert"]) {
    check(await supabase.from("club_payment_accounts").insert(input));
  },
  async setPaymentAccount(id: string, active: boolean) {
    check(await supabase.from("club_payment_accounts").update({ active }).eq("id", id));
  },
  async submitClaim(input: { organisationId: string; chargeId: string; userId: string; amountMinor: number; method: string; reference: string; paidOn: string; note: string }) {
    check(
      await supabase.from("fee_payment_claims").insert({
        organisation_id: input.organisationId,
        charge_id: input.chargeId,
        submitted_by: input.userId,
        amount_minor: input.amountMinor,
        method: input.method,
        reference: input.reference,
        paid_on: input.paidOn,
        note: input.note || null,
      }),
    );
  },
  async decideClaim(id: string, confirm: boolean, note: string) {
    check(await supabase.rpc("decide_fee_claim", { p_claim_id: id, p_confirm: confirm, p_note: note }));
  },
  async waive(id: string, reason: string) {
    check(await supabase.from("fee_charges").update({ status: "waived", waived_reason: reason || null }).eq("id", id));
  },
  async setGroundBookable(id: string, bookable: boolean, note: string | null) {
    check(await supabase.from("grounds").update({ bookable, booking_note: note }).eq("id", id));
  },
  async bookOwnGround(input: Tables["ground_bookings"]["Insert"]) {
    check(await supabase.from("ground_bookings").insert(input));
  },
  async requestOtherGround(input: { groundId: string; requesterOrg: string; title: string; purpose: string; startsAt: string; endsAt: string; note: string }) {
    check(
      await supabase.rpc("request_ground_booking", {
        p_ground_id: input.groundId,
        p_requester_org: input.requesterOrg,
        p_title: input.title,
        p_purpose: input.purpose,
        p_starts_at: input.startsAt,
        p_ends_at: input.endsAt,
        p_note: input.note,
      }),
    );
  },
  async decideBooking(id: string, status: "approved" | "declined") {
    check(await supabase.from("ground_bookings").update({ status }).eq("id", id));
  },
  async cancelBooking(id: string) {
    check(await supabase.rpc("cancel_ground_booking", { p_booking_id: id }));
  },
  async busySlots(groundId: string, from: string, to: string) {
    const result = await supabase.rpc("ground_busy_slots", { p_ground_id: groundId, p_from: from, p_to: to });
    check(result);
    return (result.data ?? []) as { starts_at: string; ends_at: string }[];
  },
  async addItem(input: Tables["club_items"]["Insert"]) {
    check(await supabase.from("club_items").insert(input));
  },
  async updateItem(id: string, patch: Tables["club_items"]["Update"]) {
    check(await supabase.from("club_items").update(patch).eq("id", id));
  },
  async order(input: { organisationId: string; itemId: string; userId: string; playerId: string | null; quantity: number; size: string | null }) {
    check(
      await supabase.from("item_orders").insert({
        organisation_id: input.organisationId,
        item_id: input.itemId,
        ordered_by: input.userId,
        player_id: input.playerId,
        quantity: input.quantity,
        size: input.size,
      }),
    );
  },
  async setOrder(id: string, status: ItemOrder["status"]) {
    check(await supabase.from("item_orders").update({ status }).eq("id", id));
  },
  async lend(input: Tables["equipment_loans"]["Insert"]) {
    check(await supabase.from("equipment_loans").insert(input));
  },
  async returned(id: string, note: string) {
    check(await supabase.from("equipment_loans").update({ returned_at: new Date().toISOString(), condition_note: note || null }).eq("id", id));
  },
  async linkGuardian(input: { organisationId: string; playerId: string; userId: string; relationship: string }) {
    check(
      await supabase.from("player_guardians").insert({
        organisation_id: input.organisationId,
        player_id: input.playerId,
        user_id: input.userId,
        relationship: input.relationship,
      }),
    );
  },
  async unlinkGuardian(id: string) {
    check(await supabase.from("player_guardians").delete().eq("id", id));
  },
};
