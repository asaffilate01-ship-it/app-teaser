const localDevelopmentOrigins = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);

function configuredOrigins(): Set<string> {
  const productionOrigins = (Deno.env.get("PUBLIC_APP_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([...productionOrigins, ...localDevelopmentOrigins]);
}

function originIsAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || configuredOrigins().has(origin);
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "600",
    vary: "Origin",
  };
  if (origin && originIsAllowed(request)) headers["access-control-allow-origin"] = origin;
  return headers;
}

export function json(data: unknown, status = 200, request?: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...(request ? corsHeaders(request) : {}),
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

export function errorResponse(error: unknown, status = 400, request?: Request): Response {
  const message = error instanceof Error ? error.message : "Unexpected request failure";
  return json({ error: message }, status, request);
}

export function handleOptions(request: Request): Response | null {
  if (request.method !== "OPTIONS") return null;
  if (!originIsAllowed(request)) return json({ error: "Origin is not allowed." }, 403, request);
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
