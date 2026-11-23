/**
 * Delivers saved reminders (notifications rows with a kind) to each person's chosen channels.
 * Rows are claimed first (delivered_at set) so the hourly job and a manager's "Send now"
 * can never send the same reminder twice.
 */
import { channelsFor, defaultPreferences, reminderMessage, textMessage, type ReminderChannel, type ReminderPreferences } from "./reminders";

const SITE = "https://criclume.com";

type Outcome = string;
export interface DeliveryResult {
  claimed: number;
  sent: Partial<Record<ReminderChannel, number>>;
}

export async function deliverPendingReminders(options: { organisationId?: string; limit?: number } = {}): Promise<DeliveryResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nowIso = new Date().toISOString();
  let pending = supabaseAdmin
    .from("notifications")
    .select("id")
    .is("delivered_at", null)
    .is("failed_at", null)
    .not("kind", "is", null)
    .lte("scheduled_for", nowIso)
    .gte("created_at", new Date(Date.now() - 2 * 86_400_000).toISOString())
    .order("created_at")
    .limit(options.limit ?? 300);
  if (options.organisationId) pending = pending.eq("organisation_id", options.organisationId);
  const { data: waiting } = await pending;
  if (!waiting?.length) return { claimed: 0, sent: {} };

  const { data: rows } = await supabaseAdmin
    .from("notifications")
    .update({ delivered_at: nowIso })
    .in("id", waiting.map((row) => row.id))
    .is("delivered_at", null)
    .select("id,organisation_id,user_id,template,payload,link");
  if (!rows?.length) return { claimed: 0, sent: {} };

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const orgIds = [...new Set(rows.map((row) => row.organisation_id).filter((id): id is string => Boolean(id)))];
  const [prefsRes, devicesRes, contactsRes, profilesRes, settingsRes, paid] = await Promise.all([
    supabaseAdmin.from("notification_preferences").select("*").in("user_id", userIds),
    supabaseAdmin.from("user_push_subscriptions").select("id,user_id,endpoint,p256dh,auth,failures").in("user_id", userIds),
    supabaseAdmin.rpc("reminder_contacts", { p_user_ids: userIds }),
    supabaseAdmin.from("profiles").select("id,timezone").in("id", userIds),
    orgIds.length ? supabaseAdmin.from("reminder_settings").select("organisation_id,texts").in("organisation_id", orgIds) : Promise.resolve({ data: [] }),
    Promise.all(orgIds.map(async (id) => [id, (await supabaseAdmin.rpc("org_on_paid_plan", { p_org: id })).data === true] as const)),
  ]);
  const prefs = new Map((prefsRes.data ?? []).map((row) => [row.user_id, row as ReminderPreferences]));
  const devices = new Map<string, NonNullable<typeof devicesRes.data>>();
  for (const device of devicesRes.data ?? []) devices.set(device.user_id, [...(devices.get(device.user_id) ?? []), device]);
  const emails = new Map(((contactsRes.data ?? []) as { user_id: string; email: string }[]).map((row) => [row.user_id, row.email]));
  const zones = new Map((profilesRes.data ?? []).map((row) => [row.id, row.timezone as string | null]));
  const clubTexts = new Map(((settingsRes.data ?? []) as { organisation_id: string; texts: boolean }[]).map((row) => [row.organisation_id, row.texts]));
  const paidPlan = new Map(paid);

  const pushSecret = process.env["PUSH_VAPID_SECRET"];
  const push = pushSecret ? await import("./web-push.server") : null;
  const keys = push && pushSecret ? await push.vapidKeysFromSecret(pushSecret) : null;
  const { sendText } = await import("./twilio.server");
  const { sendReminderEmail } = await import("./reminder-email.server");

  const sent: DeliveryResult["sent"] = {};
  const goneDevices = new Set<string>();
  const failedDevices = new Map<string, number>();

  for (let start = 0; start < rows.length; start += 20) {
    await Promise.all(
      rows.slice(start, start + 20).map(async (row) => {
        const payload = (row.payload ?? {}) as Record<string, unknown>;
        const userPrefs = prefs.get(row.user_id) ?? null;
        const userDevices = devices.get(row.user_id) ?? [];
        const email = emails.get(row.user_id) ?? null;
        const org = row.organisation_id ?? "";
        const message = reminderMessage(row.template, payload, { timeZone: zones.get(row.user_id) ?? "Europe/London" });
        const url = `${SITE}${row.link ?? "/platform"}`;
        const channels = channelsFor({
          prefs: userPrefs,
          devices: userDevices.length,
          email,
          paidPlan: paidPlan.get(org) === true,
          clubTexts: clubTexts.get(org) ?? true,
        });
        const outcome: Record<string, Outcome> = { in_app: "saved" };
        const phone = (userPrefs ?? defaultPreferences).phone;
        for (const channel of channels) {
          let result: Outcome = "failed";
          if (channel === "push") {
            if (!push || !keys) result = "not-set-up";
            else {
              const results = await Promise.all(
                userDevices.map(async (device) => {
                  const r = await push.sendPush(device, { ...message, url: row.link ?? "/platform", tag: row.id }, keys, "mailto:alerts@criclume.com");
                  if (r === "gone") goneDevices.add(device.id);
                  if (r === "failed") failedDevices.set(device.id, device.failures + 1);
                  return r;
                }),
              );
              result = results.includes("sent") ? "sent" : "failed";
            }
          } else if (channel === "email" && email) {
            result = await sendReminderEmail({ to: email, title: message.title, text: message.body, url, idempotencyKey: `reminder-${row.id}` });
          } else if ((channel === "whatsapp" || channel === "sms") && phone) {
            result = await sendText({ to: phone, title: message.title, text: textMessage(message, url), whatsapp: channel === "whatsapp" });
          }
          outcome[channel] = result;
          if (result === "sent") sent[channel] = (sent[channel] ?? 0) + 1;
        }
        await supabaseAdmin.from("notifications").update({ deliveries: outcome }).eq("id", row.id);
      }),
    );
  }

  if (goneDevices.size) await supabaseAdmin.from("user_push_subscriptions").delete().in("id", [...goneDevices]);
  for (const [id, failures] of failedDevices) {
    if (goneDevices.has(id)) continue;
    if (failures >= 5) await supabaseAdmin.from("user_push_subscriptions").delete().eq("id", id);
    else await supabaseAdmin.from("user_push_subscriptions").update({ failures }).eq("id", id);
  }
  return { claimed: rows.length, sent };
}
