import { isUuid } from "./omniqora-contract.ts";
export const cricketTools = ["criclume_match_summary", "criclume_media_inventory"] as const;
export async function handleCricketMcp(
  input: unknown,
  read: (tool: string, org: string, match: string) => Promise<unknown>,
) {
  const r = input as {
    jsonrpc?: unknown;
    id?: unknown;
    method?: unknown;
    params?: { name?: unknown; arguments?: Record<string, unknown> };
  };
  if (!r || r.jsonrpc !== "2.0" || typeof r.method !== "string")
    return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } };
  const id = typeof r.id === "number" || typeof r.id === "string" ? r.id : null;
  const result = (v: unknown) => ({ jsonrpc: "2.0", id, result: v });
  if (r.method === "initialize")
    return result({
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "criclume-evidence", version: "1.0.0" },
    });
  if (r.method === "notifications/initialized") return null;
  if (r.method === "ping") return result({});
  if (r.method === "tools/list")
    return result({
      tools: cricketTools.map((name) => ({
        name,
        description:
          name === "criclume_match_summary"
            ? "Read score aggregates without identities"
            : "Count private media without URLs or content",
        inputSchema: {
          type: "object",
          properties: {
            organisationId: { type: "string", format: "uuid" },
            matchId: { type: "string", format: "uuid" },
          },
          required: ["organisationId", "matchId"],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      })),
    });
  if (r.method !== "tools/call")
    return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
  const tool = r.params?.name,
    a = r.params?.arguments;
  if (
    typeof tool !== "string" ||
    !cricketTools.some((t) => t === tool) ||
    !a ||
    Object.keys(a).some((k) => !["organisationId", "matchId"].includes(k)) ||
    !isUuid(a.organisationId) ||
    !isUuid(a.matchId)
  )
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: "Explicit club and match required" },
    };
  try {
    return result({
      content: [
        { type: "text", text: JSON.stringify(await read(tool, a.organisationId, a.matchId)) },
      ],
      isError: false,
    });
  } catch {
    return result({
      content: [{ type: "text", text: "Evidence access refused or unavailable." }],
      isError: true,
    });
  }
}
