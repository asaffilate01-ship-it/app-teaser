export function httpsEndpoint(value: string) {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password || u.hash)
    throw new Error("Trusted HTTPS endpoint required");
  return u.toString();
}
export async function verifyVideoSignature(
  raw: string,
  timestamp: string | null,
  signature: string | null,
  secret: string,
  now = Date.now(),
) {
  if (
    !timestamp ||
    !/^\d{10}$/.test(timestamp) ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    secret.length < 32 ||
    Math.abs(now - Number(timestamp) * 1000) > 300000
  )
    throw new Error("Invalid callback signature");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${raw}`),
  );
  const expected = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  if (diff) throw new Error("Invalid callback signature");
}
export function parseVideoCallback(value: unknown): { jobId: string; status: "ready" | "failed" } {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid callback");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some((k) => !["jobId", "status"].includes(k)) ||
    typeof v.jobId !== "string" ||
    !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v.jobId) ||
    (v.status !== "ready" && v.status !== "failed")
  )
    throw new Error("Invalid callback");
  return { jobId: v.jobId, status: v.status };
}
