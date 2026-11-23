// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// One id per build: the scorer page saved for offline use always matches this build's files.
const buildId = Date.now().toString(36);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      // Offline scoring: the scorer page and the app's files are kept on the phone so /app opens
      // without internet. Registration happens only in src/lib/sw-guard.ts (never in preview/dev).
      VitePWA({
        strategies: "generateSW",
        filename: "sw.js",
        injectRegister: null,
        registerType: "autoUpdate",
        manifest: false,
        devOptions: { enabled: false },
        // The Cloudflare build serves browser files from dist/client.
        outDir: "dist/client",
        workbox: {
          globDirectory: "dist/client",
          globPatterns: ["assets/**/*.{js,css,woff,woff2,png,jpg,svg,webp}", "offline.html", "icon-192.png", "icon-maskable-192.png", "favicon.png"],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          importScripts: ["/sw-extras.js"],
          // The scorer page itself, fetched fresh from this build when the worker installs.
          additionalManifestEntries: [{ url: "/app", revision: buildId }],
          runtimeCaching: [
            {
              // App images (logo, icons) served by hosting under fixed per-file addresses: keep for offline.
              urlPattern: ({ request, url }) => request.destination === "image" && url.pathname.startsWith("/__l5e/assets-v1/"),
              handler: "CacheFirst",
              options: { cacheName: "criclume-images", expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600 } },
            },
            {
              // Scorer: always try the network first; offline, use the last copy or the installed one.
              urlPattern: ({ request, url }) => request.mode === "navigate" && url.pathname === "/app",
              handler: "NetworkFirst",
              options: {
                cacheName: `criclume-scorer-${buildId}`,
                networkTimeoutSeconds: 6,
                expiration: { maxEntries: 12 },
                plugins: [
                  {
                    // Fall back to the copy saved when this version installed (never an older version's).
                    handlerDidError: async () => {
                      const name = (await caches.keys()).find((key) => key.startsWith("workbox-precache"));
                      const installed = name ? await (await caches.open(name)).match("/app", { ignoreSearch: true }) : undefined;
                      return installed ?? (await caches.match("/offline.html", { ignoreSearch: true })) ?? Response.error();
                    },
                  },
                ],
              },
            },
            {
              // Every other page needs the internet (sign-in, club data); offline shows a friendly page.
              urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
              handler: "NetworkOnly",
              options: {
                plugins: [
                  {
                    handlerDidError: async () => (await caches.match("/offline.html", { ignoreSearch: true })) ?? Response.error(),
                  },
                ],
              },
            },
          ],
        },
      }),
    ],
  },
});
