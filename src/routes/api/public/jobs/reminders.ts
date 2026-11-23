import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Hourly: builds every club's due reminders and sends them on each person's chosen channels. */
export const Route = createFileRoute("/api/public/jobs/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: queued, error } = await supabaseAdmin.rpc("queue_due_reminders");
        if (error) {
          console.error("queue_due_reminders failed", error);
          return Response.json({ error: error.message }, { status: 500 });
        }
        const { deliverPendingReminders } = await import("@/lib/reminders.server");
        const result = await deliverPendingReminders({ limit: 500 });
        return Response.json({ queued, ...result });
      },
    },
  },
});
