import { createFileRoute, Link } from "@tanstack/react-router";
import { Printer, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/theme/BrandLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ScoutingReportView } from "@/components/scouting/ScoutingReportView";
import { getSharedScoutingReport } from "@/lib/scouting.functions";

export const Route = createFileRoute("/scout/$token")({
  loader: async ({ params }) => {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(params.token)) return { shared: null };
    return { shared: await getSharedScoutingReport({ data: { token: params.token } }) };
  },
  head: () => ({
    meta: [
      { title: "Scouting report — CricLume" },
      {
        name: "description",
        content: "A private player scouting report shared by a cricket club through CricLume.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Scouting report — CricLume" },
      {
        property: "og:description",
        content: "A private player scouting report shared through CricLume.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ScoutPage,
});

function ScoutPage() {
  const { shared } = Route.useLoaderData();
  return (
    <div className="scoreboard-stage scout-page min-h-screen pb-16">
      <header className="scoreboard-topbar no-print">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Link to="/" aria-label="CricLume home">
            <BrandLogo className="h-9 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {shared && (
              <button type="button" className="action-secondary" onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden="true" /> Print or save PDF
              </button>
            )}
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-5xl space-y-4 px-3 py-5 md:px-8">
        {shared ? (
          <>
            <section className="broadcast-panel">
              <p className="panel-kicker">Scouting report</p>
              <h1 className="mt-1 font-display text-3xl font-bold text-gold md:text-4xl">
                {shared.report.player.name}
              </h1>
              <p className="text-sm text-slate-300">
                {shared.report.player.team}
                {shared.club ? ` · shared by ${shared.club}` : ""} · for {shared.recipient}
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="size-3.5" aria-hidden="true" /> Shared with the player's
                consent. This link works until {new Date(shared.expiresAt).toLocaleDateString()}.
                Please don't forward it.
              </p>
            </section>
            <ScoutingReportView report={shared.report} />
          </>
        ) : (
          <section className="broadcast-panel text-center">
            <h1 className="font-display text-2xl font-bold">This report isn't available</h1>
            <p className="mt-2 text-sm text-slate-300">
              The link may have expired, been switched off by the club, or the player's consent may
              have changed. Ask the club for a new link.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
