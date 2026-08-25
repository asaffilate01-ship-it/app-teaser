import { errorResponse, handleOptions, json, sha256 } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    const providerUrl = Deno.env.get("RAIN_RULE_PROVIDER_URL");
    const providerKey = Deno.env.get("RAIN_RULE_PROVIDER_KEY");
    if (!providerUrl || !providerKey)
      throw new Error("No licensed rain-rule provider is configured.");
    const { client, user } = await requireUser(request);
    const body = (await request.json()) as { matchId?: string; inputs?: Record<string, unknown> };
    if (!body.matchId || !body.inputs) throw new Error("Match and rain-rule inputs are required.");
    const { data: match, error: matchError } = await client
      .from("matches")
      .select(
        "id, rule_version_id, competition_rule_versions!inner(id, rain_provider, rain_method, rain_edition, rain_parameters)",
      )
      .eq("id", body.matchId)
      .single();
    if (matchError) throw matchError;
    const rule = match.competition_rule_versions as {
      id: string;
      rain_provider: string | null;
      rain_method: string | null;
      rain_edition: string | null;
      rain_parameters: Record<string, unknown>;
    };
    if (!rule.rain_provider || !rule.rain_method || !rule.rain_edition)
      throw new Error("The match rule pack has no authorised, versioned rain method.");

    const providerResponse = await fetch(providerUrl, {
      method: "POST",
      headers: { authorization: `Bearer ${providerKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        method: rule.rain_method,
        edition: rule.rain_edition,
        parameters: rule.rain_parameters,
        inputs: body.inputs,
      }),
    });
    const result = await providerResponse.json();
    if (!providerResponse.ok)
      throw new Error(result.error ?? "The rain-rule provider rejected the calculation.");
    const responseHash = await sha256(JSON.stringify(result));
    const { data: calculation, error } = await client
      .from("rain_calculations")
      .insert({
        match_id: body.matchId,
        rule_version_id: rule.id,
        provider: rule.rain_provider,
        method: rule.rain_method,
        edition: rule.rain_edition,
        provider_calculation_id: result.calculationId ?? null,
        inputs: body.inputs,
        result,
        response_hash: responseHash,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return json({ calculation }, 200, request);
  } catch (error) {
    return errorResponse(error, 400, request);
  }
});
