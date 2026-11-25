/** Only the expected HTTPS Stripe-hosted destination may be opened. */
export function verifiedBillingRedirect(value: unknown, kind: "checkout" | "portal"): string {
  const hostname = kind === "checkout" ? "checkout.stripe.com" : "billing.stripe.com";
  if (typeof value !== "string" || value !== value.trim()) {
    throw new Error("Invalid billing redirect URL.");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid billing redirect URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== hostname ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error("Invalid billing redirect URL.");
  }
  return url.toString();
}
