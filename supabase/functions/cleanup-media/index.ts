import { errorResponse, json } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret)
      throw new Error("Scheduled-job authentication failed.");
    const client = adminClient();
    const { data: expired, error } = await client
      .from("video_assets")
      .select("id, storage_path, video_variants(storage_path)")
      .eq("legal_hold", false)
      .neq("status", "deleted")
      .lte("retention_expires_at", new Date().toISOString())
      .limit(100);
    if (error) throw error;
    let deleted = 0;
    for (const asset of expired ?? []) {
      const variants = (asset.video_variants ?? []) as Array<{ storage_path: string }>;
      const paths = [asset.storage_path, ...variants.map((variant) => variant.storage_path)].filter(
        (path): path is string => Boolean(path),
      );
      if (paths.length > 0) {
        const { error: storageError } = await client.storage.from("match-video").remove(paths);
        if (storageError) continue;
      }
      await client
        .from("video_assets")
        .update({ status: "deleted", storage_path: null })
        .eq("id", asset.id);
      deleted += 1;
    }
    return json({ examined: expired?.length ?? 0, deleted });
  } catch (error) {
    return errorResponse(error, 400);
  }
});
