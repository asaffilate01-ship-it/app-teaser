import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { defaultPreferences, type ReminderPreferences } from "./reminders";

export type NotificationRow = Pick<
  Database["public"]["Tables"]["notifications"]["Row"],
  "id" | "kind" | "template" | "payload" | "link" | "created_at" | "read_at" | "deliveries"
>;
export type ReminderSettings = Database["public"]["Tables"]["reminder_settings"]["Row"];

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

async function me(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Please sign in again.");
  return data.user.id;
}

export async function loadMyReminders(limit = 40): Promise<NotificationRow[]> {
  const userId = await me();
  const { data, error } = await supabase
    .from("notifications")
    .select("id,kind,template,payload,link,created_at,read_at,deliveries")
    .eq("user_id", userId)
    .not("kind", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  fail(error);
  return data ?? [];
}

export async function markRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .is("read_at", null);
  fail(error);
}

export async function loadPreferences(): Promise<ReminderPreferences> {
  const userId = await me();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  fail(error);
  if (!data) return defaultPreferences;
  const { push, email, whatsapp, sms, phone, availability, fees, umpire_jobs } = data;
  return { push, email, whatsapp, sms, phone, availability, fees, umpire_jobs };
}

export async function savePreferences(prefs: ReminderPreferences): Promise<void> {
  const userId = await me();
  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      { ...prefs, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  fail(error);
}

export async function countMyDevices(): Promise<number> {
  const { count, error } = await supabase
    .from("user_push_subscriptions")
    .select("id", { count: "exact", head: true });
  fail(error);
  return count ?? 0;
}

export async function saveDevice(subscription: PushSubscriptionJSON): Promise<void> {
  const { error } = await supabase.rpc("save_push_device", {
    p_endpoint: subscription.endpoint ?? "",
    p_p256dh: subscription.keys?.["p256dh"] ?? "",
    p_auth: subscription.keys?.["auth"] ?? "",
  });
  fail(error);
}

export async function removeDevice(endpoint: string): Promise<void> {
  const { error } = await supabase
    .from("user_push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  fail(error);
}

export const defaultClubSettings = {
  availability: true,
  fees: true,
  umpire_jobs: true,
  availability_hours: 24,
  fee_days: 3,
  texts: true,
};

export async function loadClubReminderSettings(organisationId: string) {
  const [{ data, error }, paid] = await Promise.all([
    supabase
      .from("reminder_settings")
      .select("*")
      .eq("organisation_id", organisationId)
      .maybeSingle(),
    supabase.rpc("org_on_paid_plan", { p_org: organisationId }),
  ]);
  fail(error);
  return {
    settings: data ? { ...defaultClubSettings, ...data } : defaultClubSettings,
    paidPlan: paid.data === true,
  };
}

export async function saveClubReminderSettings(
  organisationId: string,
  settings: typeof defaultClubSettings,
): Promise<void> {
  const userId = await me();
  const { error } = await supabase.from("reminder_settings").upsert(
    {
      organisation_id: organisationId,
      availability: settings.availability,
      fees: settings.fees,
      umpire_jobs: settings.umpire_jobs,
      availability_hours: settings.availability_hours,
      fee_days: settings.fee_days,
      texts: settings.texts,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organisation_id" },
  );
  fail(error);
}
