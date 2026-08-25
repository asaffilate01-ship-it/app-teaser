import { createClient } from "@supabase/supabase-js";

type RuntimeEnvironment = Record<string, unknown>;

type StripeWebhookObject = {
  metadata?: { organisation_id?: unknown };
  customer?: string | { id?: string };
  subscription?: string;
  id?: string;
  items?: { data?: Array<{ price?: { id?: string; lookup_key?: string } }> };
  status?: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  payment_status?: string;
};

type StripeEvent = {
  id: string;
  type: string;
  data?: { object?: StripeWebhookObject };
};

function requiredEnvironmentValue(env: unknown, key: string): string {
  const value = (env as RuntimeEnvironment | undefined)?.[key];
  if (typeof value !== "string" || !value) throw new Error(`${key} is not configured.`);
  return value;
}

function parseSignature(header: string): { timestamp: string; signatures: string[] } {
  const pairs = header.split(",").map((part) => part.trim().split("="));
  const timestamp = pairs.find(([key]) => key === "t")?.[1];
  const signatures = pairs.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (!timestamp || signatures.length === 0) throw new Error("Stripe signature is invalid.");
  return { timestamp, signatures };
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
): Promise<void> {
  const parsed = parseSignature(header);
  const timestampMs = Number(parsed.timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000)
    throw new Error("Stripe webhook timestamp is outside the allowed window.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = hex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${parsed.timestamp}.${payload}`),
    ),
  );
  if (!parsed.signatures.some((candidate) => constantTimeEqual(signature, candidate)))
    throw new Error("Stripe webhook signature verification failed.");
}

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function handleStripeWebhook(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);
  try {
    const webhookSecret = requiredEnvironmentValue(env, "STRIPE_WEBHOOK_SECRET");
    const signatureHeader = request.headers.get("stripe-signature");
    if (!signatureHeader) throw new Error("Stripe signature is missing.");
    const raw = await request.text();
    await verifyStripeSignature(raw, signatureHeader, webhookSecret);
    const event = JSON.parse(raw) as StripeEvent;
    if (!event.id || !event.type) throw new Error("Stripe event is malformed.");

    const client = createClient(
      requiredEnvironmentValue(env, "SUPABASE_URL"),
      requiredEnvironmentValue(env, "SUPABASE_SECRET_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: prior } = await client
      .from("billing_events")
      .select("id")
      .eq("id", event.id)
      .maybeSingle();
    if (prior) return response({ received: true, duplicate: true });

    const object = event.data?.object ?? {};
    const organisationId = object.metadata?.organisation_id;
    if (typeof organisationId === "string" && event.type.startsWith("customer.subscription.")) {
      const { error } = await client.from("subscriptions").upsert(
        {
          organisation_id: organisationId,
          stripe_customer_id:
            typeof object.customer === "string" ? object.customer : object.customer?.id,
          stripe_subscription_id: object.id,
          plan: object.items?.data?.[0]?.price?.lookup_key ?? "paid",
          status: object.status,
          current_period_end: object.current_period_end
            ? new Date(object.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: Boolean(object.cancel_at_period_end),
          entitlements: { priceId: object.items?.data?.[0]?.price?.id ?? null },
        },
        { onConflict: "organisation_id" },
      );
      if (error) throw error;
    }
    if (typeof organisationId === "string" && event.type === "checkout.session.completed") {
      const { error } = await client.from("subscriptions").upsert(
        {
          organisation_id: organisationId,
          stripe_customer_id: typeof object.customer === "string" ? object.customer : null,
          stripe_subscription_id:
            typeof object.subscription === "string" ? object.subscription : null,
          plan: "paid",
          status: object.payment_status === "paid" ? "active" : "pending",
        },
        { onConflict: "organisation_id" },
      );
      if (error) throw error;
    }
    const { error } = await client
      .from("billing_events")
      .insert({ id: event.id, event_type: event.type, payload: event });
    if (error && error.code !== "23505") throw error;
    return response({ received: true });
  } catch (error) {
    console.error("Stripe webhook rejected", error);
    return response({ error: "Webhook rejected." }, 400);
  }
}
