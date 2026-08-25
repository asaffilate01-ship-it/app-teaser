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
    const endpoint = Deno.env.get("AI_ANALYSIS_ENDPOINT");
    const apiKey = Deno.env.get("AI_ANALYSIS_API_KEY");
    if (!endpoint || !apiKey) throw new Error("The AI analysis service is not configured.");
    const { client, user } = await requireUser(request);
    const body = (await request.json()) as { jobId?: string };
    if (!body.jobId) throw new Error("AI job ID is required.");
    const { data: job, error: jobError } = await client
      .from("ai_jobs")
      .select("*")
      .eq("id", body.jobId)
      .single();
    if (jobError) throw jobError;
    await requireOrganisationRole(client, user.id, job.organisation_id, [
      "owner",
      "league_admin",
      "club_admin",
      "coach",
      "safeguarding_officer",
    ]);
    const consent = job.consent_snapshot as Record<string, unknown>;
    if (consent.coachingAnalysis !== "granted")
      throw new Error("Coaching-analysis consent has not been granted.");
    const allowBiometricIdentification =
      consent.biometricAnalysis === "granted" && consent.includesJunior !== true;
    await client
      .from("ai_jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", job.id);

    const analysisResponse = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        jobType: job.job_type,
        manifest: job.input_manifest,
        policy: {
          allowBiometricIdentification,
          humanReviewRequired: true,
          returnEvidenceTimestamps: true,
          neverChangeScoreAutomatically: true,
        },
      }),
    });
    const result = await analysisResponse.json();
    if (!analysisResponse.ok) throw new Error(result.error ?? "AI analysis failed.");
    const findings = Array.isArray(result.findings) ? result.findings : [];
    if (findings.length > 0) {
      const { error } = await client.from("ai_findings").insert(
        findings.map((finding: Record<string, unknown>) => ({
          job_id: job.id,
          delivery_id: finding.deliveryId ?? null,
          finding_type: finding.type ?? "review",
          confidence: Math.max(0, Math.min(1, Number(finding.confidence ?? 0))),
          evidence: finding.evidence ?? {},
          suggestion: finding.suggestion ?? {},
        })),
      );
      if (error) throw error;
    }
    await client
      .from("ai_jobs")
      .update({
        status: "review_required",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return json(
      { jobId: job.id, findings: findings.length, humanReviewRequired: true },
      200,
      request,
    );
  } catch (error) {
    return errorResponse(error, 400, request);
  }
});
