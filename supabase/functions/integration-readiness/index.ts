import { requireUser, requireOrganisationRole } from "../_shared/supabase.ts";
import { handleOptions, json, requirePost, requireTrustedOrigin } from "../_shared/http.ts";
Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    requirePost(request);
    requireTrustedOrigin(request);
    const { client, user } = await requireUser(request);
    const body = await request.json();
    await requireOrganisationRole(client, user.id, body.organisationId, [
      "owner",
      "league_admin",
      "club_admin",
    ]);
    const checks = [];
    for (const [id, table, column] of [
      ["core", "matches", "id"],
      ["analysis", "criclume_analysis_files", "analysis_consent"],
      ["media", "video_processing_jobs", "id"],
      ["intelligence", "criclume_omniqora_runs", "omniqora_reserved_minor"],
    ]) {
      const { error } = await client.from(table).select(column).limit(0);
      checks.push({
        id,
        label: `${id} database schema`,
        status: error ? "unavailable" : "verified",
        detail: error ? "Schema could not be verified." : "Required table and columns responded.",
      });
    }
    for (const [id, label, keys] of [
      ["billing", "Stripe billing", ["STRIPE_SECRET_KEY", "STRIPE_PRICE_CLUB"]],
      [
        "email",
        "Email delivery",
        ["EMAIL_PROVIDER_ENDPOINT", "EMAIL_PROVIDER_API_KEY", "CRON_SECRET"],
      ],
      [
        "video",
        "Video processing",
        ["VIDEO_TRANSCODE_ENDPOINT", "VIDEO_TRANSCODE_API_KEY", "VIDEO_CALLBACK_SECRET"],
      ],
      ["rain", "Rain-rule provider", ["RAIN_RULE_PROVIDER_URL", "RAIN_RULE_PROVIDER_KEY"]],
      ["omniqora", "Omniqora", ["OMNIQORA_INTELLIGENCE_URL", "OMNIQORA_SERVICE_AUTH"]],
    ] as const)
      checks.push({
        id,
        label,
        status: keys.every((k) => Boolean(Deno.env.get(k)?.trim())) ? "configured" : "missing",
        detail: "Configuration presence only. Provider acceptance requires a live test.",
      });
    checks.push({
      id: "paid-ai",
      label: "Paid AI switch",
      status: Deno.env.get("OMNIQORA_CRICLUME_PAID_ENABLED") === "true" ? "configured" : "disabled",
      detail: "Worker certification, tenant approval and metering are separate checks.",
    });
    checks.push({
      id: "backup",
      label: "Backup recovery",
      status: "unverified",
      detail: "Requires database and Storage restore evidence.",
    });
    return json({ checkedAt: new Date().toISOString(), checks }, 200, request);
  } catch {
    return json({ error: "Club administrator access required." }, 403, request);
  }
});
