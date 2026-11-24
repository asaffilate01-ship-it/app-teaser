import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  battingTeam: z.string().min(1).max(80),
  bowlingTeam: z.string().min(1).max(80),
  score: z.string().min(1).max(40),
  chase: z.string().max(120).optional(),
  /** Name-free ball-by-ball lines (roles only), oldest first. */
  lines: z.array(z.string().max(300)).min(1).max(40),
});

export type OverSummaryResult = { summary: string } | { error: string; status: number };

/**
 * Lovable AI over summary. Authentication alone is not a club-level entitlement.
 * Keep disabled until production role, tenant and usage-budget controls are verified.
 * The text sent contains roles ("the batter"), never player names.
 */
export const summariseOver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }): Promise<OverSummaryResult> => {
    if (process.env["CRICLUME_AI_OVER_SUMMARIES_ENABLED"] !== "true") {
      return { error: "AI commentary is not enabled. Use manual commentary instead.", status: 403 };
    }
    const { streamText } = await import("ai");
    const { createLovableAi } = await import("./ai-gateway.server");
    try {
      const { provider } = createLovableAi();
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        maxOutputTokens: 400,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(20_000),
        instructions:
          "You are a lively but accurate cricket commentator for a club match. Write a 2–3 sentence summary of the latest over(s) for spectators. Use only the facts given; do not invent player names, shots or numbers. Refer to players by role (the batter, the bowler). British English. No hashtags or emojis.",
        messages: [
          {
            role: "user",
            content: `${data.battingTeam} batting against ${data.bowlingTeam}. Score now ${data.score}.${data.chase ? ` ${data.chase}.` : ""}\nBall by ball (oldest first):\n${data.lines.join("\n")}`,
          },
        ],
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const summary = (await result.text).trim();
      if (!summary) return { error: "The AI did not return a summary for this over.", status: 502 };
      return { summary };
    } catch (error) {
      const status =
        error &&
        typeof error === "object" &&
        "statusCode" in error &&
        typeof error.statusCode === "number"
          ? error.statusCode
          : 500;
      const message =
        status === 402
          ? "AI credits have run out. A workspace owner can add more in Settings → Plans & credits."
          : status === 429
            ? "AI is busy right now. Try the summary again in a minute."
            : status === 403
              ? "AI summaries are turned off for this workspace."
              : "The over summary could not be written right now.";
      console.error("over summary failed", status);
      return { error: message, status };
    }
  });
