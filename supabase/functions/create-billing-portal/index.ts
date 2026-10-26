import {
  allowedRedirect,
  handleOptions,
  json,
  requirePost,
  requireTrustedOrigin,
} from "../_shared/http.ts";
import { requireUser, requireOrganisationRole } from "../_shared/supabase.ts";
Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    requirePost(request);
    requireTrustedOrigin(request);
    const { client, user } = await requireUser(request);
    const body = await request.json();
    if (typeof body.organisationId !== "string")
      return json({ error: "Organisation required" }, 422, request);
    await requireOrganisationRole(client, user.id, body.organisationId, [
      "owner",
      "league_admin",
      "club_admin",
    ]);
    const returnUrl = allowedRedirect(body.returnUrl, "Billing return URL");
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) return json({ error: "Billing not configured" }, 503, request);
    const { data: subscription, error } = await client
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organisation_id", body.organisationId)
      .maybeSingle();
    if (error) throw error;
    if (!subscription?.stripe_customer_id)
      return json({ error: "No billing account exists" }, 409, request);
    const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: subscription.stripe_customer_id,
        return_url: returnUrl,
      }),
    });
    if (!response.ok) throw new Error("Portal unavailable");
    const session = await response.json();
    const url = new URL(session.url);
    if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com")
      throw new Error("Invalid portal");
    return json({ url: url.toString() }, 200, request);
  } catch {
    return json(
      { error: "Billing portal unavailable. Check club access and billing configuration." },
      503,
      request,
    );
  }
});
