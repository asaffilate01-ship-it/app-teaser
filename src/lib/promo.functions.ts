import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PromoItem, PromoSlot } from "./promo-targeting";

type PromoSet = Record<PromoSlot, PromoItem[]>;
const empty: PromoSet = { top: [], side: [] };
const slug = z.string().regex(/^[a-z0-9-]{3,80}$/);
const surface = z.enum(["ground", "scoreboard", "app"]);
const ids = z.array(z.string().uuid()).min(1).max(20);

/** Ads for a public screen (ground big screen, public scoreboard) or a signed-out phone. */
export const getPromos = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ surface, slug: slug.optional() }).parse(data))
  .handler(async ({ data }): Promise<PromoSet> => {
    try {
      const { promosFor } = await import("./promo.server");
      return await promosFor(data.surface);
    } catch (error) {
      console.error("Ads could not load", error);
      return empty;
    }
  });

/** Count plays on a public screen; plays credit the club that owns the published scoreboard. */
export const reportPromoPlays = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ surface, slug: slug.optional(), creativeIds: ids }).parse(data))
  .handler(async ({ data }) => {
    try {
      const { countPlays, organisationForBoard } = await import("./promo.server");
      const organisationId = data.slug && data.surface !== "app" ? await organisationForBoard(data.slug) : null;
      return { counted: await countPlays(data.surface, organisationId, data.creativeIds) };
    } catch (error) {
      console.error("Ad plays could not be counted", error);
      return { counted: 0 };
    }
  });

/** Ads inside the signed-in app. */
export const getMemberPromos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<PromoSet> => {
    try {
      const { promosFor } = await import("./promo.server");
      return await promosFor("app");
    } catch (error) {
      console.error("Ads could not load", error);
      return empty;
    }
  });

/** Count plays inside the app; they only credit a club the signed-in person really belongs to. */
export const reportMemberPromoPlays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ organisationId: z.string().uuid().nullable(), creativeIds: ids }).parse(data))
  .handler(async ({ data, context }) => {
    try {
      let organisationId: string | null = null;
      if (data.organisationId) {
        const { data: member } = await context.supabase.rpc("is_org_member", { p_organisation_id: data.organisationId });
        organisationId = member === true ? data.organisationId : null;
      }
      const { countPlays } = await import("./promo.server");
      return { counted: await countPlays("app", organisationId, data.creativeIds) };
    } catch (error) {
      console.error("Ad plays could not be counted", error);
      return { counted: 0 };
    }
  });
