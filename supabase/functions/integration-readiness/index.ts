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
    const cloudCaptureKeys = [
      "LIVEKIT_URL",
      "LIVEKIT_API_KEY",
      "LIVEKIT_API_SECRET",
      "CRICLUME_CAPTURE_S3_ACCESS_KEY",
      "CRICLUME_CAPTURE_S3_SECRET_KEY",
      "CRICLUME_CAPTURE_S3_BUCKET",
      "CRICLUME_CAPTURE_S3_REGION",
      "CRICLUME_CAPTURE_S3_ENDPOINT",
    ];
    const captureEnabled = Deno.env.get("CRICLUME_CLOUD_CAPTURE_ENABLED") === "true";
    checks.push({
      id: "cloud-capture",
      label: "LiveKit cloud camera recording",
      status: !captureEnabled
        ? "disabled"
        : cloudCaptureKeys.every((name) => Boolean(Deno.env.get(name)?.trim()))
          ? "configured"
          : "missing",
      detail:
        "Configuration only. A real camera publishing, provider egress test, " +
        "private storage review and retention checks are required before production sign-off.",
    });

    checks.push({
      id: "cloud-match-auto",
      label: "Automatic cloud recording on live matches",
      status:
        Deno.env.get("CRICLUME_CLOUD_AUTO_ENABLED") !== "true"
          ? "disabled"
          : Deno.env.get("CRICLUME_CLOUD_CAPTURE_ENABLED") === "true" &&
              Boolean(Deno.env.get("CRON_SECRET")?.trim())
            ? "configured"
            : "missing",
      detail:
        "Requires operator adult-only opt-in, an armed consented device, actual LiveKit publishing, " +
        "private S3 and a separately installed one-minute scheduled invocation. Not a live test.",
    });
    checks.push({
      id: "cloud-archive-check",
      label: "Private cloud recording object inspection",
      status:
        Deno.env.get("CRICLUME_CLOUD_ARCHIVE_CHECK_ENABLED") !== "true"
          ? "disabled"
          : [...cloudCaptureKeys.slice(3), "CRON_SECRET"].every((key) =>
                Boolean(Deno.env.get(key)?.trim()),
              )
            ? "configured"
            : "missing",
      detail:
        "Configuration check only. Object presence and MP4 header validation are not a safeguarding or publication approval.",
    });
    checks.push({
      id: "private-media-import",
      label: "Private cloud media library ingestion",
      status: Deno.env.get("CRICLUME_PRIVATE_IMPORT_ENABLED") !== "true"
        ? "disabled"
        : [...cloudCaptureKeys.slice(3), "CRON_SECRET"].every((key) =>
            Boolean(Deno.env.get(key)?.trim()),
          )
          ? "configured"
          : "missing",
      detail: "A human safeguarding review, verified private source, and separately scheduled worker are required. Large files need an external transfer worker.",
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
