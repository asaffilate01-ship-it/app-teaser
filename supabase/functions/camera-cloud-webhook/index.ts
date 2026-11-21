// LiveKit's signed egress webhooks reconcile provider state. No browser can call this.
import { WebhookReceiver } from "npm:livekit-server-sdk@2.20.1";
import { adminClient } from "../_shared/supabase.ts";
import { json, requirePost } from "../_shared/http.ts";

Deno.serve(async (request) => {
  try {
    requirePost(request);
    if (Deno.env.get("CRICLUME_CLOUD_CAPTURE_ENABLED") !== "true")
      return json({ error: "Cloud recording provider disabled." }, 503);
    const key = Deno.env.get("LIVEKIT_API_KEY") ?? "";
    const secret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
    if (!key || secret.length < 32)
      return json({ error: "Cloud provider credentials unavailable." }, 503);
    const raw = await request.text();
    if (raw.length > 131_072) return json({ error: "Webhook payload too large." }, 413);
    const auth = request.headers.get("authorization") ?? "";
    const event = await new WebhookReceiver(key, secret).receive(raw, auth);
    if (!["egress_started", "egress_updated", "egress_ended"].includes(event.event))
      return json({ accepted: true });
    const info = event.egressInfo;
    if (!info?.egressId || !info.roomName)
      return json({ error: "Incomplete signed egress event." }, 422);
    const client = adminClient();
    const { data: stored, error } = await client
      .from("camera_cloud_recordings")
      .select("id,state,provider_egress_id,provider_room_name")
      .eq("provider_egress_id", info.egressId)
      .eq("provider_room_name", info.roomName)
      .maybeSingle();
    if (error) throw error;
    if (!stored) {
      // The start API can still be persisting its provider ID; LiveKit may retry.
      return json({ error: "Cloud recording session not yet reconciled." }, 409);
    }
    if (stored.state === "provider_completed" || stored.state === "failed")
      return json({ accepted: true, alreadyFinal: true });
    const status = Number(info.status);
    const state =
      status === 3
        ? "provider_completed"
        : [4, 5, 6].includes(status)
          ? "failed"
          : status === 2
            ? "stopping"
            : status === 1
              ? "recording"
              : "starting";
    // Never regress a requested stop when a late ACTIVE event is delivered.
    if (stored.state === "stopping" && state === "recording")
      return json({ accepted: true, ignored: "stale_active" });
    const now = new Date().toISOString();
    const { error: updateError } = await client
      .from("camera_cloud_recordings")
      .update({
        state,
        provider_status: status,
        provider_updated_at: now,
        updated_at: now,
        ...(["provider_completed", "failed"].includes(state) ? { ended_at: now } : {}),
      })
      .eq("id", stored.id);
    if (updateError) throw updateError;
    // Provider completion is not the same as a verified, consented archive.
    return json({ accepted: true, state });
  } catch {
    return json({ error: "Cloud provider webhook signature or state refused." }, 403);
  }
});
