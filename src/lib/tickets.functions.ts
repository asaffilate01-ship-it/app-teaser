import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PublicTicketListing } from "./tickets-cloud";

/** Public read of tickets on sale on a published club website. No buyer details come back. */
export const getClubTickets = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().regex(/^[a-z0-9-]{3,80}$/) }).parse(data))
  .handler(async ({ data }): Promise<PublicTicketListing[]> => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return [];
    const response = await fetch(`${url}/rest/v1/rpc/get_club_tickets`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: data.slug }),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { listings?: PublicTicketListing[] } | null;
    return (body?.listings ?? []).map((row) => ({ ...row, priceMinor: Number(row.priceMinor), remaining: Number(row.remaining), maxPerOrder: Number(row.maxPerOrder) }));
  });
