import {
  errorResponse,
  handleOptions,
  json,
  requirePost,
  requireTrustedOrigin,
} from "../_shared/http.ts";
import { requireOrganisationRole, requireUser } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    requirePost(request);
    requireTrustedOrigin(request);
    const endpoint = Deno.env.get("VIDEO_TRANSCODE_ENDPOINT");
    const apiKey = Deno.env.get("VIDEO_TRANSCODE_API_KEY");
    const callbackSecret = Deno.env.get("VIDEO_CALLBACK_SECRET");
    if (!endpoint || !apiKey || !callbackSecret)
      throw new Error("Video transcoding is not configured.");
    const { client, user } = await requireUser(request);
    const body = (await request.json()) as { assetId?: string };
    if (!body.assetId) throw new Error("Video asset ID is required.");
    const { data: asset, error: assetError } = await client
      .from("video_assets")
      .select("*")
      .eq("id", body.assetId)
      .single();
    if (assetError) throw assetError;
    await requireOrganisationRole(client, user.id, asset.organisation_id, [
      "owner",
      "league_admin",
      "club_admin",
      "coach",
      "safeguarding_officer",
    ]);
    if (asset.recording_consent !== "granted")
      throw new Error("Recording consent has not been granted for this asset.");
    if (!asset.storage_path) throw new Error("The source upload is not complete.");
    const { data: signed, error: signedError } = await client.storage
      .from("match-video")
      .createSignedUrl(asset.storage_path, 60 * 60);
    if (signedError) throw signedError;
    await client.from("video_assets").update({ status: "processing" }).eq("id", asset.id);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        assetId: asset.id,
        sourceUrl: signed.signedUrl,
        outputs: ["proxy", "thumbnail", asset.blur_mode === "none" ? null : "blurred"].filter(
          Boolean,
        ),
        blurMode: asset.blur_mode,
        callbackSecret,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Transcoding provider rejected the job.");
    return json({ assetId: asset.id, providerJobId: result.jobId }, 200, request);
  } catch (error) {
    return errorResponse(error, 400, request);
  }
});
