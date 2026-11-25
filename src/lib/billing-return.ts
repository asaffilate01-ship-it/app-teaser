export type BillingReturn = "success" | "cancelled" | "portal";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readBillingReturn(value: unknown): BillingReturn | undefined {
  return value === "success" || value === "cancelled" || value === "portal" ? value : undefined;
}

export function readBillingOrganisation(value: unknown): string | undefined {
  return typeof value === "string" && uuid.test(value) ? value.toLowerCase() : undefined;
}

/** Return navigation carries context only; it can never verify payment or grant a plan. */
export function billingReturnUrl(origin: string, organisationId: string, result: BillingReturn) {
  const id = readBillingOrganisation(organisationId);
  if (!id || !readBillingReturn(result)) throw new Error("Invalid billing return context.");
  const url = new URL("/platform", origin);
  url.searchParams.set("section", "operations");
  url.searchParams.set("billing", result);
  url.searchParams.set("billingOrg", id);
  return url.toString();
}

export function billingReturnMatches(expected: string | undefined, selected: string): boolean {
  return Boolean(expected && expected === readBillingOrganisation(selected));
}

export function billingReturnMessage(result: BillingReturn) {
  switch (result) {
    case "success":
      return "Checkout returned. Payment and subscription activation are not yet confirmed by this return link.";
    case "cancelled":
      return "Checkout was cancelled or left unfinished. No new payment or subscription is confirmed.";
    case "portal":
      return "Returned from the billing portal. Refresh the recorded subscription before relying on any changes.";
  }
}
