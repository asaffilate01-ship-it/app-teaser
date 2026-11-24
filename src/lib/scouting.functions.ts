import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ScoutingReport } from "./scouting";

export interface SharedScoutingReport {
  report: ScoutingReport;
  recipient: string;
  club: string | null;
  sharedAt: string;
  expiresAt: string;
}

/** Public read of a shared scouting report by its secret link. Returns null when revoked, expired or consent is withdrawn. */
export const getSharedScoutingReport = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/) }).parse(data),
  )
  .handler(async ({ data }): Promise<SharedScoutingReport | null> => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return null;
    const response = await fetch(`${url}/rest/v1/rpc/get_shared_scouting_report`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: data.token }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as SharedScoutingReport | null;
    return body && body.report ? body : null;
  });
