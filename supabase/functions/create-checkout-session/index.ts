import {
  allowedRedirect,
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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const configuredPriceId = Deno.env.get("STRIPE_PRICE_CLUB");
    if (!stripeKey || !configuredPriceId) throw new Error("Stripe is not configured.");
    const { client, user } = await requireUser(request);
    const body = (await request.json()) as {
      organisationId?: string;
      priceId?: string;
      successUrl?: string;
      cancelUrl?: string;
    };
    if (!body.organisationId || !body.priceId || !body.successUrl || !body.cancelUrl)
      throw new Error("Organisation, price and return URLs are required.");
    if (body.priceId !== configuredPriceId) throw new Error("The selected plan is not available.");
    const successUrl = allowedRedirect(body.successUrl, "Checkout success URL");
    const cancelUrl = allowedRedirect(body.cancelUrl, "Checkout cancellation URL");
    await requireOrganisationRole(client, user.id, body.organisationId, [
      "owner",
      "league_admin",
      "club_admin",
    ]);

    const { data: subscription } = await client
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("organisation_id", body.organisationId)
      .maybeSingle();
    const parameters = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": configuredPriceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "subscription_data[metadata][organisation_id]": body.organisationId,
      "metadata[organisation_id]": body.organisationId,
      client_reference_id: body.organisationId,
      allow_promotion_codes: "true",
    });
    if (subscription?.stripe_customer_id)
      parameters.set("customer", subscription.stripe_customer_id);
    else if (user.email) parameters.set("customer_email", user.email);

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${stripeKey}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: parameters,
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok)
      throw new Error(session.error?.message ?? "Stripe checkout could not be created.");
    return json({ id: session.id, url: session.url }, 200, request);
  } catch (error) {
    return errorResponse(error, 400, request);
  }
});
