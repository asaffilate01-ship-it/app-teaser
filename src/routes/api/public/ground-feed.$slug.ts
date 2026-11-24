import { createFileRoute } from "@tanstack/react-router";
import { buildGroundFeed, groundFeedText } from "@/lib/ground-feed";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

/**
 * Read-only live score feed for ground (LED) scoreboards: /api/public/ground-feed/<board>?format=json|text.
 * Serves only what the club has already published on its public scoreboard (no names).
 */
export const Route = createFileRoute("/api/public/ground-feed/$slug")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ params, request }) => {
        if (!/^[a-zA-Z0-9_-]{4,80}$/.test(params.slug)) {
          return Response.json({ error: "Unknown scoreboard." }, { status: 404, headers: cors });
        }
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key)
          return Response.json({ error: "Feed unavailable." }, { status: 503, headers: cors });
        const response = await fetch(`${url}/rest/v1/rpc/get_public_scoreboard`, {
          method: "POST",
          headers: { apikey: key, "Content-Type": "application/json" },
          body: JSON.stringify({ p_slug: params.slug }),
        });
        if (!response.ok)
          return Response.json({ error: "Feed unavailable." }, { status: 502, headers: cors });
        const board = (await response.json()) as Parameters<typeof buildGroundFeed>[0] | null;
        if (!board || !board.homeTeam || !board.awayTeam) {
          return Response.json(
            { error: "This scoreboard is not public." },
            { status: 404, headers: cors },
          );
        }
        const feed = buildGroundFeed(board);
        const format = new URL(request.url).searchParams.get("format");
        if (format === "text") {
          return new Response(groundFeedText(feed), {
            headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        return Response.json(feed, { headers: cors });
      },
    },
  },
});
