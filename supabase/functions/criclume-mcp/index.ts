import { handleCricketMcp } from "../_shared/criclume-mcp.ts";
import { requireUser, requireOrganisationRole } from "../_shared/supabase.ts";
import { requirePost, requireTrustedOrigin, json } from "../_shared/http.ts";
import { privacySafeMatchContext } from "../_shared/omniqora-contract.ts";
Deno.serve(async (request) => {
  try {
    requirePost(request);
    requireTrustedOrigin(request);
    if (Deno.env.get("CRICLUME_MCP_ENABLED") !== "true")
      return json({ error: "MCP evidence connector is disabled." }, 503);
    const { client, user } = await requireUser(request);
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: "Request too large" }, 413);
    const result = await handleCricketMcp(JSON.parse(raw), async (tool, org, matchId) => {
      await requireOrganisationRole(client, user.id, org, [
        "owner",
        "league_admin",
        "club_admin",
        "coach",
        "safeguarding_officer",
      ]);
      const { data: m, error } = await client
        .from("matches")
        .select("id,status,live_state,updated_at")
        .eq("id", matchId)
        .eq("owner_organisation_id", org)
        .single();
      if (error || !m) throw new Error("Unavailable");
      if (tool === "criclume_match_summary")
        return {
          sourceRevision: m.updated_at,
          evidence: privacySafeMatchContext(m.live_state, m.status),
        };
      const r = await client
        .from("criclume_analysis_files")
        .select("kind")
        .eq("organisation_id", org)
        .eq("match_id", matchId)
        .gt("retention_expires_at", new Date().toISOString())
        .order("id")
        .limit(101);
      if (r.error) throw r.error;
      return {
        sampledFiles: Math.min(r.data.length, 100),
        hasMore: r.data.length > 100,
        images: r.data.slice(0, 100).filter((f) => f.kind === "image").length,
        videos: r.data.slice(0, 100).filter((f) => f.kind === "video").length,
        externalMediaExecutionEnabled: false,
      };
    });
    return result === null ? new Response(null, { status: 202 }) : json(result);
  } catch {
    return json({ error: "Authenticated scoped MCP request required." }, 403);
  }
});
