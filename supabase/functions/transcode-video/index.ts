import { handleOptions, json, requirePost, requireTrustedOrigin } from "../_shared/http.ts";
import { requireUser, requireOrganisationRole } from "../_shared/supabase.ts";
import { httpsEndpoint } from "../_shared/provider-contract.ts";
Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    requirePost(request);
    requireTrustedOrigin(request);
    const { client, user } = await requireUser(request);
    const body = await request.json();
    if (typeof body.assetId !== "string")
      return json({ error: "Video asset required" }, 422, request);
    const { data: asset, error } = await client
      .from("video_assets")
      .select("id,organisation_id,storage_path,blur_mode")
      .eq("id", body.assetId)
      .single();
    if (error || !asset) return json({ error: "Video unavailable" }, 404, request);
    await requireOrganisationRole(client, user.id, asset.organisation_id, [
      "owner",
      "league_admin",
      "club_admin",
      "coach",
      "safeguarding_officer",
    ]);
    const endpoint = httpsEndpoint(Deno.env.get("VIDEO_TRANSCODE_ENDPOINT") ?? "");
    const apiKey = Deno.env.get("VIDEO_TRANSCODE_API_KEY");
    if (!apiKey || (Deno.env.get("VIDEO_CALLBACK_SECRET") ?? "").length < 32)
      throw new Error("Not configured");
    const { data: job, error: claimError } = await client.rpc("claim_video_processing", {
      p_asset: asset.id,
      p_user: user.id,
    });
    if (claimError || !job)
      return json({ error: "Video is not ready for processing" }, 409, request);
    if (job.reused) return json(job, 200, request);
    const { data: signed, error: signError } = await client.storage
      .from("match-video")
      .createSignedUrl(asset.storage_path, 3600);
    if (signError) throw signError;
    const outputs = [];
    for (const kind of job.kinds) {
      const path = job.prefix + kind + (kind === "thumbnail" ? ".jpg" : ".mp4");
      const { data: upload, error: uploadError } = await client.storage
        .from("match-video")
        .createSignedUploadUrl(path);
      if (uploadError) throw uploadError;
      outputs.push({ kind, path, uploadUrl: upload.signedUrl });
    }
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key": job.jobId,
      },
      body: JSON.stringify({
        jobId: job.jobId,
        assetId: asset.id,
        sourceUrl: signed.signedUrl,
        outputs,
        blurMode: asset.blur_mode,
        callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/video-callback`,
      }),
    });
    if (!response.ok) throw new Error("Provider refused");
    return json({ jobId: job.jobId, status: "processing" }, 202, request);
  } catch {
    return json(
      {
        error:
          "Video processing unavailable. Inspect the existing job before retrying a submitted upload.",
      },
      503,
      request,
    );
  }
});
