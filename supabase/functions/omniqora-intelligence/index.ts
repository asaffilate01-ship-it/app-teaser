import {
  errorResponse,
  handleOptions,
  json,
  requirePost,
  requireTrustedOrigin,
} from "../_shared/http.ts";
import { requireOrganisationRole, requireUser } from "../_shared/supabase.ts";
import {
  isUuid,
  omniqoraEndpoint,
  omniqoraStartPayload,
  parseCricketIntelligenceRequest,
  safeRunView,
} from "../_shared/omniqora-contract.ts";

type RecordData = Record<string, unknown>;
type LinkedTenant = { omniqora_tenant_id: string; enabled: boolean };
type LocalRun = {
  id: string;
  organisation_id: string;
  match_id: string;
  omniqora_run_id: string | null;
  omniqora_tenant_id: string;
  task: string;
  source_version: string;
  status: string;
  requested_at: string;
};

const permittedRoles = [
  "owner", "league_admin", "club_admin", "coach", "safeguarding_officer",
];

function fail(message: string, status: number, request: Request): Response {
  return json({ error: message }, status, request);
}

function configuration(): { url: string; credential: string } {
  if (Deno.env.get("OMNIQORA_CRICLUME_ENABLED") !== "true") {
    throw new Error("not_enabled");
  }
  const url = Deno.env.get("OMNIQORA_INTELLIGENCE_URL");
  const credential = Deno.env.get("OMNIQORA_SERVICE_AUTH");
  if (!url || !credential || !/^[A-Za-z0-9_-]{8,80}\.[^\s]{32,256}$/.test(credential)) {
    throw new Error("not_configured");
  }
  return { url: omniqoraEndpoint(url), credential };
}

async function sendToOmniqora(input: RecordData): Promise<RecordData> {
  const { url, credential } = configuration();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(input),
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    // Do not echo Omniqora internals, credentials or sensitive payloads to users.
    throw new Error(response.status === 403 ? "binding_refused" : "upstream_unavailable");
  }
  const raw = await response.text();
  if (raw.length > 65536) throw new Error("invalid_response");
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid_response");
  }
  return parsed as RecordData;
}

async function setRunStatus(
  client: ReturnType<typeof import("../_shared/supabase.ts")["adminClient"]>,
  runId: string,
  status: string,
  omniqoraRunId?: string,
) {
  const patch: RecordData = { status, updated_at: new Date().toISOString() };
  if (omniqoraRunId) patch.omniqora_run_id = omniqoraRunId;
  const { error } = await client.from("criclume_omniqora_runs").update(patch).eq("id", runId);
  if (error) throw error;
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    requirePost(request);
    requireTrustedOrigin(request);
    const raw = await request.text();
    if (raw.length > 4096) return fail("Request too large.", 413, request);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fail("Invalid JSON.", 400, request);
    }
    const command = parseCricketIntelligenceRequest(parsed);
    // This is the already-connected Lovable Supabase project, not Omniqora's DB.
    const { client, user } = await requireUser(request);
    await requireOrganisationRole(
      client, user.id, command.organisationId, permittedRoles,
    );

    const { data: match, error: matchError } = await client
      .from("matches")
      .select("id,owner_organisation_id,status,live_state,updated_at")
      .eq("id", command.matchId)
      .eq("owner_organisation_id", command.organisationId)
      .maybeSingle();
    if (matchError) throw matchError;
    if (!match) return fail("Match is not available to this club.", 404, request);

    if (command.operation === "run.list") {
      const { data, error } = await client
        .from("criclume_omniqora_runs")
        .select("id,task,status,requested_at")
        .eq("organisation_id", command.organisationId)
        .eq("match_id", command.matchId)
        .order("requested_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return json({
        requests: (data ?? []).map((row) => ({
          requestId: row.id, task: row.task, status: row.status,
          requestedAt: row.requested_at,
        })),
      }, 200, request);
    }

    const { data: link, error: linkError } = await client
      .from("criclume_omniqora_links")
      .select("omniqora_tenant_id,enabled")
      .eq("organisation_id", command.organisationId)
      .maybeSingle();
    if (linkError) throw linkError;
    if (!(link as LinkedTenant | null)?.enabled || !isUuid(link?.omniqora_tenant_id)) {
      return fail("Omniqora has not been activated for this CricLume club.", 409, request);
    }
    const tenantId: string = link.omniqora_tenant_id;
    // Fail before writing a local request when the gateway is not configured.
    try {
      configuration();
    } catch {
      return fail("Omniqora integration is not enabled in Lovable Cloud.", 503, request);
    }

    if (command.operation === "run.get") {
      const { data: local, error } = await client
        .from("criclume_omniqora_runs")
        .select("id,organisation_id,match_id,omniqora_run_id,omniqora_tenant_id,task,source_version,status,requested_at")
        .eq("id", command.requestId)
        .eq("organisation_id", command.organisationId)
        .eq("match_id", command.matchId)
        .maybeSingle();
      if (error) throw error;
      if (!local || local.omniqora_tenant_id !== tenantId)
        return fail("Intelligence request not found.", 404, request);
      if (!local.omniqora_run_id) {
        return json({
          requestId: local.id, task: local.task, status: local.status,
          humanReviewRequired: true,
        }, 200, request);
      }

      const upstream = await sendToOmniqora({
        operation: "run.get",
        tenantId,
        productKey: "criclume",
        runId: local.omniqora_run_id,
      });
      const view = safeRunView(upstream);
      if (local.status !== view.status) await setRunStatus(client, local.id, view.status);
      return json({ requestId: local.id, task: local.task, ...view }, 200, request);
    }

    // Rate limit upstream model costs; dedupe concurrent requests for the same
    // match score revision. Omniqora itself also requires entitlement and scope.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await client
      .from("criclume_omniqora_runs")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", command.organisationId)
      .gte("requested_at", since);
    if (countError) throw countError;
    if ((count ?? 0) >= 12) {
      return fail("This club has reached the hourly AI request limit.", 429, request);
    }

    const version = String(match.updated_at);
    const { data: created, error: createdError } = await client
      .from("criclume_omniqora_runs")
      .insert({
        organisation_id: command.organisationId,
        match_id: command.matchId,
        omniqora_tenant_id: tenantId,
        requested_by: user.id,
        task: command.task,
        source_version: version,
      })
      .select("id,status")
      .single();
    if (createdError?.code === "23505") {
      const { data: previous, error: previousError } = await client
        .from("criclume_omniqora_runs")
        .select("id,status")
        .eq("organisation_id", command.organisationId)
        .eq("match_id", command.matchId)
        .eq("task", command.task)
        .eq("source_version", version)
        .single();
      if (previousError) throw previousError;
      return json({
        requestId: previous.id, status: previous.status,
        reused: true, humanReviewRequired: true,
      }, 200, request);
    }
    if (createdError || !created) throw createdError ?? new Error("Request not saved.");

    try {
      const upstream = await sendToOmniqora(
        omniqoraStartPayload({
          tenantId,
          task: command.task,
          matchId: command.matchId,
          status: match.status,
          liveState: match.live_state,
        }),
      );
      if (!isUuid(upstream.runId) || upstream.status !== "queued") {
        throw new Error("invalid_response");
      }
      await setRunStatus(client, created.id, "queued", upstream.runId);
      return json({
        requestId: created.id,
        task: command.task,
        status: "queued",
        humanReviewRequired: true,
      }, 202, request);
    } catch (error) {
      // Mark failed; do not automatically retry an ambiguous upstream timeout,
      // which could create a duplicate paid agent run.
      await setRunStatus(client, created.id, "failed");
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      if (/^(Invalid request|A valid organisation|Unsupported intelligence request)/.test(error.message)) {
        return fail(error.message, 422, request);
      }
      if (/permission|Authentication required/i.test(error.message)) {
        return fail("You do not have permission for CricLume intelligence.", 403, request);
      }
      if (error.message === "binding_refused") {
        return fail("Omniqora rejected this tenant's scope or entitlement.", 403, request);
      }
    }
    console.error("CricLume intelligence gateway error:", error instanceof Error ? error.name : "unknown");
    return errorResponse(new Error("Intelligence is currently unavailable. Check connection and approvals."), 503, request);
  }
});
