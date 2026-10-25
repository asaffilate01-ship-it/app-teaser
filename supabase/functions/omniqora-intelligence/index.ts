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
  omniqoraBudgetedPayload,
  omniqoraEndpoint,
  parseCricketIntelligenceRequest,
  safeRunView,
  sameScoreRevision,
} from "../_shared/omniqora-contract.ts";

type RecordData = Record<string, unknown>;
type LinkedTenant = { omniqora_tenant_id: string; enabled: boolean };

const permittedRoles = ["owner", "league_admin", "club_admin", "coach", "safeguarding_officer"];

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
  client: ReturnType<(typeof import("../_shared/supabase.ts"))["adminClient"]>,
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
    await requireOrganisationRole(client, user.id, command.organisationId, permittedRoles);

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
        .select("id,task,status,requested_at,source_version,omniqora_reserved_minor,omniqora_currency")
        .eq("organisation_id", command.organisationId)
        .eq("match_id", command.matchId)
        .order("requested_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return json(
        {
          requests: (data ?? []).map((row) => ({
            requestId: row.id,
            task: row.task,
            status: sameScoreRevision(row.source_version, match.updated_at) ? row.status : "stale",
            requestedAt: row.requested_at,
            reservedMinor: row.omniqora_reserved_minor,
            currency: row.omniqora_currency,
          })),
        },
        200,
        request,
      );
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

    if (command.operation === "connection.verify") {
      // A verified connection only proves the scoped service credential and
      // Omniqora entitlement. It is NOT a funded model or available worker.
      const proof = await sendToOmniqora({
        operation: "connection.verify",
        tenantId,
        productKey: "criclume",
      });
      if (
        proof.ok !== true ||
        proof.connection !== "verified" ||
        proof.productKey !== "criclume" ||
        proof.entitlementActive !== true ||
        proof.modelExecutionReady !== false
      ) {
        return fail("Omniqora could not verify this scoped connection.", 503, request);
      }
      return json(
        {
          connection: "verified",
          entitlementActive: true,
          modelExecutionReady: false,
          budgetedAdmissionRequired: true,
        },
        200,
        request,
      );
    }

    if (command.operation === "run.get") {
      const { data: local, error } = await client
        .from("criclume_omniqora_runs")
        .select(
          "id,organisation_id,match_id,omniqora_run_id,omniqora_tenant_id,task,source_version,status,requested_at,omniqora_reserved_minor,omniqora_currency",
        )
        .eq("id", command.requestId)
        .eq("organisation_id", command.organisationId)
        .eq("match_id", command.matchId)
        .maybeSingle();
      if (error) throw error;
      if (!local || local.omniqora_tenant_id !== tenantId)
        return fail("Intelligence request not found.", 404, request);
      if (!sameScoreRevision(local.source_version, match.updated_at)) {
        if (local.status !== "stale") await setRunStatus(client, local.id, "stale");
        return json(
          {
            requestId: local.id,
            task: local.task,
            status: "stale",
            summary: null,
            recommendations: [],
            humanReviewRequired: true,
            reason: "The match has changed since this report was requested.",
          },
          200,
          request,
        );
      }
      if (!local.omniqora_run_id) {
        return json(
          {
            requestId: local.id,
            task: local.task,
            status: local.status,
            humanReviewRequired: true,
          },
          200,
          request,
        );
      }

      const upstream = await sendToOmniqora({
        operation: "run.get",
        tenantId,
        productKey: "criclume",
        runId: local.omniqora_run_id,
      });
      const view = safeRunView(upstream);
      if (local.status !== view.status) await setRunStatus(client, local.id, view.status);
      return json({ requestId: local.id, task: local.task, ...view,
        reservedMinor: local.omniqora_reserved_minor,
        currency: local.omniqora_currency }, 200, request);
    }

    if (command.operation === "run.start.budgeted") {
      // Deliberately disabled until BOTH companies' reviewed tenant, model
      // tariff, worker and spending permissions have been activated. A GitHub
      // merge or verified connection does not automatically enable charges.
      if (Deno.env.get("OMNIQORA_CRICLUME_PAID_ENABLED") !== "true") {
        return fail(
          "Budgeted GenAI is not enabled for this CricLume deployment. The free match preview remains available.",
          409,
          request,
        );
      }
      // Strict, atomic, server-role-only source claim: prevents concurrent
      // devices bypassing one-per-score dedupe or the club request cap.
      const revision = String(match.updated_at);
      const { data: claimed, error: claimError } = await client.rpc("claim_criclume_omniqora_run", {
        _organisation_id: command.organisationId,
        _match_id: command.matchId,
        _tenant_id: tenantId,
        _task: command.task,
        _source_version: revision,
        _requested_by: user.id,
      });
      if (claimError || !claimed || !isUuid(claimed.requestId)) {
        return fail(
          "Club AI admission is not approved or the match has changed. Confirm the Lovable migration and club limits.",
          409,
          request,
        );
      }
      // An ambiguous previous submission must never be resent automatically:
      // the external queue may already have reserved funds.
      if (claimed.reused === true) {
        return json(
          {
            requestId: claimed.requestId,
            task: command.task,
            status: claimed.status,
            reused: true,
            humanReviewRequired: true,
          },
          200,
          request,
        );
      }
      try {
        const budget = await sendToOmniqora(
          omniqoraBudgetedPayload({
            tenantId,
            sourceOrganisationId: command.organisationId,
            matchId: command.matchId,
            sourceRevision: revision,
            task: command.task,
            requestId: claimed.requestId,
            matchStatus: match.status,
            liveState: match.live_state,
          }),
        );
        if (
          !isUuid(budget.runId) ||
          !isUuid(budget.reservationId) ||
          budget.status !== "queued" ||
          typeof budget.reservedMinor !== "number" ||
          !Number.isSafeInteger(budget.reservedMinor) ||
          budget.reservedMinor <= 0 ||
          budget.reservedMinor > 10000 ||
          !["GBP", "EUR", "USD"].includes(String(budget.currency)) ||
          budget.humanReviewRequired !== true
        ) {
          throw new Error("Invalid cost reservation receipt.");
        }
        const { error: saveError } = await client
          .from("criclume_omniqora_runs")
          .update({
            status: "queued",
            admission_mode: "budgeted",
            omniqora_run_id: budget.runId,
            omniqora_reservation_id: budget.reservationId,
            omniqora_reserved_minor: budget.reservedMinor,
            omniqora_currency: budget.currency,
            updated_at: new Date().toISOString(),
          })
          .eq("id", claimed.requestId)
          .eq("organisation_id", command.organisationId);
        if (saveError) throw saveError;
        return json(
          {
            requestId: claimed.requestId,
            task: command.task,
            status: "queued",
            reservedMinor: budget.reservedMinor,
            currency: budget.currency,
            humanReviewRequired: true,
            modelExecutionReady: false,
          },
          202,
          request,
        );
      } catch {
        // A remote timeout or local receipt-save error is AMBIGUOUS.
        // Never assume no reservation was made; never auto retry.
        await client
          .from("criclume_omniqora_runs")
          .update({
            status: "reconcile_required",
            admission_mode: "budgeted",
            reconciliation_note:
              "Remote admission or local receipt confirmation was ambiguous; reconcile by source request UUID.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", claimed.requestId)
          .eq("organisation_id", command.organisationId);
        return fail(
          "Budget admission outcome requires an operator check before retrying. No new request has been sent automatically.",
          503,
          request,
        );
      }
    }

    // Never permit the legacy, unbudgeted run.start operation.
    return fail(
      "Only the verified budgeted Agent Factory may handle paid CricLume GenAI.",
      409,
      request,
    );
  } catch (error) {
    if (error instanceof Error) {
      if (
        /^(Invalid request|A valid organisation|Unsupported intelligence request)/.test(
          error.message,
        )
      ) {
        return fail(error.message, 422, request);
      }
      if (/permission|Authentication required/i.test(error.message)) {
        return fail("You do not have permission for CricLume intelligence.", 403, request);
      }
      if (error.message === "binding_refused") {
        return fail("Omniqora rejected this tenant's scope or entitlement.", 403, request);
      }
    }
    console.error(
      "CricLume intelligence gateway error:",
      error instanceof Error ? error.name : "unknown",
    );
    return errorResponse(
      new Error("Intelligence is currently unavailable. Check connection and approvals."),
      503,
      request,
    );
  }
});
