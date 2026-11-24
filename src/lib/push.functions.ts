import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  matchId: z.string().uuid(),
  alerts: z
    .array(
      z.object({
        kind: z.enum(["wickets", "milestones", "results"]),
        title: z.string().min(1).max(120),
        body: z.string().max(200),
      }),
    )
    .min(1)
    .max(3),
});

/**
 * Sends wicket / milestone / result alerts to fans who signed up on the match's public scoreboard.
 * Only someone allowed to score this match can send. Alert text is name-free (built by match-alerts.ts).
 */
export const sendMatchAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc("can_score_match", {
      p_match_id: data.matchId,
    });
    if (error || allowed !== true) return { sent: 0, reason: "not-allowed" as const };
    const secret = process.env["PUSH_VAPID_SECRET"];
    if (!secret) return { sent: 0, reason: "not-configured" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: board } = await supabaseAdmin
      .from("public_scoreboards")
      .select("id,slug,enabled")
      .eq("match_id", data.matchId)
      .maybeSingle();
    if (!board?.enabled) return { sent: 0, reason: "not-public" as const };
    const kinds = [...new Set(data.alerts.map((alert) => alert.kind))];
    const { data: subs } = await supabaseAdmin
      .from("match_push_subscriptions")
      .select("id,endpoint,p256dh,auth,kinds,failures")
      .eq("scoreboard_id", board.id)
      .overlaps("kinds", kinds)
      .limit(5000);
    if (!subs?.length) return { sent: 0, reason: "no-subscribers" as const };

    const { sendPush, vapidKeysFromSecret } = await import("./web-push.server");
    const keys = await vapidKeysFromSecret(secret);
    const gone: string[] = [];
    const failed: { id: string; failures: number }[] = [];
    let sent = 0;
    // Batches keep the number of open connections modest.
    for (let start = 0; start < subs.length; start += 50) {
      await Promise.all(
        subs.slice(start, start + 50).map(async (sub) => {
          const wanted = data.alerts.filter((alert) => sub.kinds.includes(alert.kind));
          for (const alert of wanted) {
            const outcome = await sendPush(
              sub,
              { ...alert, url: `/scoreboard/${board.slug}`, tag: board.slug },
              keys,
              "mailto:alerts@criclume.com",
            );
            if (outcome === "gone") return void gone.push(sub.id);
            if (outcome === "failed")
              return void failed.push({ id: sub.id, failures: sub.failures + 1 });
            sent += 1;
          }
        }),
      );
    }
    if (gone.length) await supabaseAdmin.from("match_push_subscriptions").delete().in("id", gone);
    // Five failures in a row means the browser is no longer reachable.
    const dead = failed.filter((item) => item.failures >= 5).map((item) => item.id);
    if (dead.length) await supabaseAdmin.from("match_push_subscriptions").delete().in("id", dead);
    for (const item of failed.filter((entry) => entry.failures < 5)) {
      await supabaseAdmin
        .from("match_push_subscriptions")
        .update({ failures: item.failures })
        .eq("id", item.id);
    }
    return { sent, reason: "ok" as const };
  });
