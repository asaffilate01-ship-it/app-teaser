import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Which reminder channels this app can send right now, plus the phone-alert key. */
export const reminderSetup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const secret = process.env["PUSH_VAPID_SECRET"];
    const { vapidKeysFromSecret } = await import("./web-push.server");
    const { textsConfigured } = await import("./twilio.server");
    const { emailConfigured } = await import("./reminder-email.server");
    return {
      pushKey: secret ? (await vapidKeysFromSecret(secret)).publicKey : null,
      email: emailConfigured(),
      texts: textsConfigured(),
    };
  });

const sendNowInput = z.object({
  organisationId: z.string().uuid(),
  kind: z.enum(["availability", "fees", "umpires"]),
  target: z.string().uuid().optional(),
});

/** A manager's "Send now". The database checks the role for each kind and limits repeats to one an hour. */
export const sendRemindersNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => sendNowInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: queued, error } = await context.supabase.rpc("send_reminders_now", {
      p_organisation_id: data.organisationId,
      p_kind: data.kind,
      ...(data.target ? { p_target: data.target } : {}),
    });
    if (error) return { ok: false as const, error: error.message, queued: 0, sent: {} };
    const { deliverPendingReminders } = await import("./reminders.server");
    const result = await deliverPendingReminders({
      organisationId: data.organisationId,
      limit: 300,
    });
    return { ok: true as const, error: null, queued: Number(queued ?? 0), sent: result.sent };
  });
