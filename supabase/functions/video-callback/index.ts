import { verifyVideoSignature, parseVideoCallback } from "../_shared/provider-contract.ts";
import { adminClient } from "../_shared/supabase.ts";
import { json, requirePost } from "../_shared/http.ts";
Deno.serve(async (request) => {
  try {
    requirePost(request);
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: "Request too large" }, 413);
    await verifyVideoSignature(
      raw,
      request.headers.get("x-video-timestamp"),
      request.headers.get("x-video-signature"),
      Deno.env.get("VIDEO_CALLBACK_SECRET") ?? "",
    );
    const body = parseVideoCallback(JSON.parse(raw));
    const { data, error } = await adminClient().rpc("complete_video_processing", {
      p_job: body.jobId,
      p_status: body.status,
    });
    if (error) throw error;
    return json(data);
  } catch {
    return json({ error: "Callback signature or media state refused." }, 403);
  }
});
