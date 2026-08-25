const localDevelopmentOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const builtInProductionOrigins = new Set([
  "https://app-teaser.lovable.app",
  "https://criclume.com",
  "https://www.criclume.com",
]);

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function configuredOrigins(): Set<string> {
  const productionOrigins = (Deno.env.get("PUBLIC_APP_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([...productionOrigins, ...builtInProductionOrigins, ...localDevelopmentOrigins]);
}

function originIsAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || configuredOrigins().has(origin);
}

export function requirePost(request: Request): void {
  if (request.method !== "POST") throw new RequestError("Only POST requests are allowed.", 405);
}

export function requireTrustedOrigin(request: Request): void {
  if (!originIsAllowed(request)) throw new RequestError("Origin is not allowed.", 403);
}

export function allowedRedirect(value: string | undefined, label: string): string {
  if (!value) throw new RequestError(`${label} is required.`, 400);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RequestError(`${label} is invalid.`, 400);
  }
  if (!configuredOrigins().has(url.origin))
    throw new RequestError(`${label} must use an approved application origin.`, 400);
  return url.toString();
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
  return json({ error: message }, error instanceof RequestError ? error.status : status, request);
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

async function secureEqual(left: string, right: string): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([sha256(left), sha256(right)]);
  let difference = leftDigest.length ^ rightDigest.length;
  const length = Math.max(leftDigest.length, rightDigest.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftDigest.charCodeAt(index) || 0) ^ (rightDigest.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export async function requireEnvironmentSecret(
  request: Request,
  headerName: string,
  environmentName: string,
): Promise<void> {
  const expected = Deno.env.get(environmentName);
  const provided = request.headers.get(headerName);
  if (!expected || !provided || !(await secureEqual(provided, expected)))
    throw new RequestError("Scheduled-job authentication failed.", 401);
}
