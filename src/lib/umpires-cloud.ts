import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { defaultPanelRules, type AvailabilityStatus, type PanelRules } from "@/lib/umpires";

type Tables = Database["public"]["Tables"];
export type UmpireRow = Tables["umpires"]["Row"];
export type UmpireInsert = Tables["umpires"]["Insert"];
export type AppointmentRow = Tables["umpire_appointments"]["Row"];
export type AppointmentInsert = Tables["umpire_appointments"]["Insert"];
export type AvailabilityRow = Tables["umpire_availability"]["Row"];
export type PanelRulesRow = Tables["umpire_panel_settings"]["Row"];

function check(result: { error: { message: string } | null }) {
  if (result.error) throw new Error(friendlyUmpire(result.error.message));
}

export function friendlyUmpire(message: string): string {
  if (/row-level security|permission denied/i.test(message)) return "Your role doesn't allow that.";
  if (/umpire_appointments_one_per_fixture/i.test(message)) return "That umpire is already on this match.";
  if (/umpires_org_email|umpires_org_user/i.test(message)) return "That umpire is already on the panel.";
  if (/violates check constraint/i.test(message)) return "Check the details — something is too long or not allowed.";
  return message.replace(/^.*?ERROR:\s*/i, "");
}

export function rulesFrom(row: Partial<PanelRulesRow> | null | undefined): PanelRules {
  if (!row) return defaultPanelRules;
  return {
    requires_qualification: Boolean(row.requires_qualification),
    requires_safeguarding: row.requires_safeguarding ?? true,
    requires_first_aid: Boolean(row.requires_first_aid),
    requires_kit: Boolean(row.requires_kit),
    default_pay_basis: row.default_pay_basis === "voluntary" ? "voluntary" : "paid",
    default_fee_minor: row.default_fee_minor ?? 0,
    travel_rate_minor: row.travel_rate_minor ?? 0,
    currency: row.currency ?? "GBP",
    guidance: row.guidance ?? null,
  };
}

export interface UmpirePanelData {
  rules: PanelRules;
  hasRules: boolean;
  umpires: UmpireRow[];
  appointments: AppointmentRow[];
  availability: AvailabilityRow[];
}

/** Everything the Umpires tab needs. Row-level security limits it to managers and treasurers. */
export async function loadUmpirePanel(organisationId: string): Promise<UmpirePanelData> {
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString();
  const [rules, umpires, appointments] = await Promise.all([
    supabase.from("umpire_panel_settings").select("*").eq("organisation_id", organisationId).maybeSingle(),
    supabase.from("umpires").select("*").eq("organisation_id", organisationId).order("display_name"),
    supabase.from("umpire_appointments").select("*").eq("organisation_id", organisationId).gte("starts_at", since).order("starts_at").limit(2000),
  ]);
  check(rules);
  check(umpires);
  check(appointments);
  const umpireRows = (umpires.data ?? []) as UmpireRow[];
  const userIds = umpireRows.map((row) => row.user_id).filter((id): id is string => Boolean(id));
  let availability: AvailabilityRow[] = [];
  if (userIds.length) {
    const today = new Date().toISOString().slice(0, 10);
    const result = await supabase.from("umpire_availability").select("*").in("user_id", userIds).gte("day", today).limit(5000);
    check(result);
    availability = (result.data ?? []) as AvailabilityRow[];
  }
  return {
    rules: rulesFrom(rules.data),
    hasRules: Boolean(rules.data),
    umpires: umpireRows,
    appointments: (appointments.data ?? []) as AppointmentRow[],
    availability,
  };
}

export const umpireOffice = {
  async saveRules(organisationId: string, rules: PanelRules) {
    check(
      await supabase.from("umpire_panel_settings").upsert(
        { organisation_id: organisationId, ...rules, guidance: rules.guidance?.trim() || null },
        { onConflict: "organisation_id" },
      ),
    );
  },
  async addUmpire(input: UmpireInsert) {
    check(await supabase.from("umpires").insert(input));
  },
  async updateUmpire(id: string, patch: Tables["umpires"]["Update"]) {
    check(await supabase.from("umpires").update(patch).eq("id", id));
  },
  async appoint(input: AppointmentInsert) {
    check(await supabase.from("umpire_appointments").insert(input));
  },
  async updateAppointment(id: string, patch: Tables["umpire_appointments"]["Update"]) {
    check(await supabase.from("umpire_appointments").update(patch).eq("id", id));
  },
  async removeAppointment(id: string) {
    check(await supabase.from("umpire_appointments").delete().eq("id", id));
  },
  async setPayment(id: string, status: "due" | "approved" | "paid", reference?: string, paidOn?: string) {
    check(await supabase.rpc("set_umpire_payment", { p_id: id, p_status: status, p_reference: reference ?? "", ...(paidOn ? { p_paid_on: paidOn } : {}) }));
  },
};

export interface MyPanel {
  umpire: UmpireRow;
  organisation: { id: string; name: string; kind: string };
  rules: PanelRules;
  guidance: string | null;
}

export interface MyUmpireData {
  userId: string;
  panels: MyPanel[];
  appointments: AppointmentRow[];
  availability: AvailabilityRow[];
}

/** The signed-in umpire's own panels, appointments and availability (links new panels by email first). */
export async function loadMyUmpireWork(): Promise<MyUmpireData> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sign in again to see your umpiring.");
  await supabase.rpc("link_my_umpire_profiles");
  const panels = await supabase.rpc("my_umpire_panels");
  check(panels);
  const list = ((panels.data ?? []) as unknown as { umpire: UmpireRow; organisation: MyPanel["organisation"]; rules: PanelRulesRow | null }[]).map((row) => ({
    umpire: row.umpire,
    organisation: row.organisation,
    rules: rulesFrom(row.rules),
    guidance: row.rules?.guidance ?? null,
  }));
  const umpireIds = list.map((row) => row.umpire.id);
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const [appointments, availability] = await Promise.all([
    umpireIds.length
      ? supabase.from("umpire_appointments").select("*").in("umpire_id", umpireIds).gte("starts_at", since).order("starts_at").limit(2000)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("umpire_availability").select("*").eq("user_id", userId).gte("day", today).order("day"),
  ]);
  check(appointments);
  check(availability);
  return {
    userId,
    panels: list,
    appointments: (appointments.data ?? []) as AppointmentRow[],
    availability: (availability.data ?? []) as AvailabilityRow[],
  };
}

export const umpireSelf = {
  async respond(id: string, accept: boolean, note: string) {
    check(await supabase.rpc("respond_umpire_appointment", { p_id: id, p_accept: accept, p_note: note }));
  },
  async claim(id: string, km: number | null, amountMinor: number, note: string) {
    check(await supabase.rpc("claim_umpire_expenses", { p_id: id, p_km: km as number, p_amount_minor: amountMinor, p_note: note }));
  },
  async setDay(userId: string, day: string, status: AvailabilityStatus | null) {
    if (status === null) {
      check(await supabase.from("umpire_availability").delete().eq("user_id", userId).eq("day", day));
      return;
    }
    check(await supabase.from("umpire_availability").upsert({ user_id: userId, day, status }, { onConflict: "user_id,day" }));
  },
  async updateDetails(umpireId: string, phone: string, homeArea: string, maxKm: number | null) {
    check(
      await supabase.rpc("update_my_umpire_details", {
        p_umpire_id: umpireId,
        p_phone: phone,
        p_home_area: homeArea,
        p_max_travel_km: maxKm as number,
      }),
    );
  },
};
