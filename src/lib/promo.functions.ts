import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PromoItem, PromoSlot } from "./promo-targeting";
import { creditedClub } from "./promo-credit";

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
      const { promosFor, organisationForBoard } = await import("./promo.server");
      const organisationId = data.slug && data.surface !== "app" ? await organisationForBoard(data.slug) : null;
      return await promosFor(data.surface, organisationId);
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
  .inputValidator((data: unknown) => z.object({ organisationId: z.string().uuid().nullable().optional() }).parse(data ?? {}))
  .handler(async ({ data, context }): Promise<PromoSet> => {
    try {
      // Club adverts only for a club the signed-in person really belongs to.
      let organisationId: string | null = null;
      if (data.organisationId) {
        const { data: member } = await context.supabase.rpc("is_org_member", { p_organisation_id: data.organisationId });
        organisationId = member === true ? data.organisationId : null;
      }
      const { promosFor } = await import("./promo.server");
      return await promosFor("app", organisationId);
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

/**
 * Count plays on a public scoreboard watched by a signed-in person. Like the app, plays credit the
 * viewer's own club when it is one of the two clubs playing; otherwise they go to the host club.
 */
export const reportViewerBoardPlays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ slug, creativeIds: ids }).parse(data))
  .handler(async ({ data, context }) => {
    try {
      const { clubsForBoard, countPlays } = await import("./promo.server");
      const clubs = await clubsForBoard(data.slug);
      if (!clubs) return { counted: 0 };
      const memberOf: string[] = [];
      for (const organisationId of clubs.playing) {
        const { data: member } = await context.supabase.rpc("is_org_member", { p_organisation_id: organisationId });
        if (member === true) memberOf.push(organisationId);
      }
      const organisationId = creditedClub({ host: clubs.host, playing: clubs.playing, viewerClubs: memberOf });
      return { counted: await countPlays("scoreboard", organisationId, data.creativeIds) };
    } catch (error) {
      console.error("Ad plays could not be counted", error);
      return { counted: 0 };
    }
  });
