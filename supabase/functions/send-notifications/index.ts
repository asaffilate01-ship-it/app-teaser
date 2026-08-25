import { errorResponse, json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret)
      throw new Error("Scheduled-job authentication failed.");
    const endpoint = Deno.env.get("EMAIL_PROVIDER_ENDPOINT");
    const apiKey = Deno.env.get("EMAIL_PROVIDER_API_KEY");
    if (!endpoint || !apiKey) throw new Error("Email delivery is not configured.");
    const client = adminClient();
    const { data: pending, error } = await client
      .from("notifications")
      .select("id, user_id, template, payload")
      .eq("channel", "email")
      .is("delivered_at", null)
      .is("failed_at", null)
      .lte("scheduled_for", new Date().toISOString())
      .limit(50);
    if (error) throw error;
    let delivered = 0;
    for (const notification of pending ?? []) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            template: notification.template,
            payload: notification.payload,
            userId: notification.user_id,
          }),
        });
        if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
        await client
          .from("notifications")
          .update({ delivered_at: new Date().toISOString() })
          .eq("id", notification.id);
        delivered += 1;
      } catch (deliveryError) {
        await client
          .from("notifications")
          .update({
            failed_at: new Date().toISOString(),
            failure_reason:
              deliveryError instanceof Error ? deliveryError.message : "Email delivery failed.",
          })
          .eq("id", notification.id);
      }
    }
    return json({ processed: pending?.length ?? 0, delivered });
  } catch (error) {
    return errorResponse(error, 400);
  }
});
