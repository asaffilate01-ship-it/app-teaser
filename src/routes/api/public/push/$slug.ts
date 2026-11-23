import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const subscription = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(80).max(100), auth: z.string().min(16).max(30) }),
});
const subscribeBody = z.object({
  subscription,
  kinds: z.array(z.enum(["wickets", "milestones", "results"])).min(1).max(3),
});
const unsubscribeBody = z.object({ endpoint: z.string().url().max(1000) });
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** The public scoreboard row for a slug, only if the club has published it. */
async function publishedBoard(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("public_scoreboards").select("id").eq("slug", slug).eq("enabled", true).maybeSingle();
  return data ? { id: data.id as string, admin: supabaseAdmin } : null;
}

/**
 * Match alerts for a published scoreboard: GET → the app's push key, POST → sign up this browser,
 * DELETE → stop. Stores only the browser's push address — no names, emails or accounts.
 */
export const Route = createFileRoute("/api/public/push/$slug")({
  server: {
    handlers: {
      GET: async () => {
        const secret = process.env["PUSH_VAPID_SECRET"];
        if (!secret) return json({ error: "Alerts are not set up." }, 503);
        const { vapidKeysFromSecret } = await import("@/lib/web-push.server");
        return json({ publicKey: (await vapidKeysFromSecret(secret)).publicKey });
      },
      POST: async ({ params, request }) => {
        const parsed = subscribeBody.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid sign-up." }, 400);
        const { isAllowedPushEndpoint } = await import("@/lib/web-push.server");
        if (!isAllowedPushEndpoint(parsed.data.subscription.endpoint)) return json({ error: "This browser's alert service is not supported." }, 400);
        const board = await publishedBoard(params.slug);
        if (!board) return json({ error: "This scoreboard is not public." }, 404);
        const { count } = await board.admin.from("match_push_subscriptions").select("id", { count: "exact", head: true }).eq("scoreboard_id", board.id);
        if ((count ?? 0) >= 5000) return json({ error: "Alerts for this match are full." }, 429);
        const { error } = await board.admin.from("match_push_subscriptions").upsert(
          {
            scoreboard_id: board.id,
            endpoint: parsed.data.subscription.endpoint,
            p256dh: parsed.data.subscription.keys.p256dh,
            auth: parsed.data.subscription.keys.auth,
            kinds: [...new Set(parsed.data.kinds)],
            failures: 0,
          },
          { onConflict: "scoreboard_id,endpoint" },
        );
        if (error) return json({ error: "Could not save the sign-up." }, 500);
        return json({ ok: true });
      },
      DELETE: async ({ params, request }) => {
        const parsed = unsubscribeBody.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid request." }, 400);
        const board = await publishedBoard(params.slug);
        if (!board) return json({ ok: true });
        await board.admin.from("match_push_subscriptions").delete().eq("scoreboard_id", board.id).eq("endpoint", parsed.data.endpoint);
        return json({ ok: true });
      },
    },
  },
});
