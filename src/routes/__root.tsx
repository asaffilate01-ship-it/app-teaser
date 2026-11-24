import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { browserServiceWorkerAllowed } from "@/lib/sw-guard";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { reportMonitoringEvent } from "../lib/monitoring";
import { themeBootScript } from "../lib/theme";
import { CLUB_SITE_META, clubSlugForHost } from "../lib/club-domains";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    const safeError = error instanceof Error ? error : new Error(String(error));
    console.error(safeError);
    reportLovableError(safeError, { boundary: "tanstack_root_error_component" });
    reportMonitoringEvent({
      level: "error",
      name: safeError.name,
      message: safeError.message,
      context: { boundary: "tanstack_root_error_component" },
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CricLume — See every ball. Shape every game." },
      {
        name: "description",
        content:
          "Ball-by-ball cricket scoring, multi-angle camera rooms, live scoreboards and coaching review.",
      },
      { name: "author", content: "CricLume" },
      { property: "og:title", content: "CricLume — See every ball. Shape every game." },
      {
        property: "og:description",
        content:
          "Ball-by-ball cricket scoring, multi-angle camera rooms, live scoreboards and coaching review for clubs and academies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@criclume" },
      { name: "theme-color", content: "#141a2e" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "CricLume" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Manrope:wght@400;500;700&family=Google+Sans:wght@500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  // On a club's own domain the page tells the browser which club website it is (see src/router.tsx).
  const host =
    typeof window === "undefined"
      ? router.options.origin
        ? new URL(router.options.origin).hostname
        : ""
      : window.location.hostname;
  const clubSlug = host ? clubSlugForHost(host) : null;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the visitor's saved light/dark choice before the page paints. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {clubSlug && <meta name={CLUB_SITE_META} content={clubSlug} />}
        <HeadContent />
      </head>
      <body>
        <a
          className="skip-link"
          href="#main-content"
          onClick={(event) => {
            const main = document.getElementById("main-content");
            if (main) {
              event.preventDefault();
              main.focus();
              main.scrollIntoView({ block: "start" });
            }
          }}
        >
          Skip to main content
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (browserServiceWorkerAllowed()) {
      // Scorers and club users get the offline app (about 4 MB, downloaded once in the background);
      // visitors to the public pages don't, unless they already have it or turn on match alerts.
      if (/^\/(app|platform)(\/|$)/.test(window.location.pathname))
        void navigator.serviceWorker.register("/sw.js");
    } else if ("serviceWorker" in navigator) {
      // Preview, editor frame or ?sw=off: remove any old app worker so it can't serve stale pages.
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          registrations
            .filter((item) => item.active?.scriptURL.endsWith("/sw.js"))
            .forEach((item) => void item.unregister()),
        );
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
