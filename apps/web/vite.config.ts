import { monolithium } from "@monocircuit/monolithium/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import { version } from "./package.json";

/** Paths the backends own; the SPA (and its service worker) never answers them */
export const BACKEND_PREFIXES = ["/nt/", "/ct/", "/lt/"];

/** Where `pnpm dev` and `vite preview` send /nt, /ct, /lt */
function devProxy() {
  const target = process.env.TRACE_BACKEND_ORIGIN;
  if (!target) {
    throw new Error(
      "TRACE_BACKEND_ORIGIN is not set. The dev server proxies /nt, /ct and " +
        "/lt to your own Trace backends: set it to their origin, e.g. " +
        "TRACE_BACKEND_ORIGIN=https://trace.example.com pnpm --filter web dev",
    );
  }
  return Object.fromEntries(
    BACKEND_PREFIXES.map((prefix) => [
      prefix.slice(0, -1),
      { target, changeOrigin: true, secure: true },
    ]),
  );
}

/** The commit the bundle is built from, "" outside a git checkout */
function buildCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

export default defineConfig(({ command, mode }) => ({
  // Settings > About Trace compares this with the deployed /version.json.
  define: {
    __TRACE_BUILD_COMMIT__: JSON.stringify(buildCommit()),
    __TRACE_VERSION__: JSON.stringify(version),
  },
  plugins: [
    // One React for the linked/installed package, its files served in dev
    monolithium(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "Trace",
        short_name: "Trace",
        description: "Nutrition, cooking and training in one app",
        lang: "de",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
          {
            src: "/icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // The app shell, plus exercise media once seen or pre-cached from
        // Settings > Exercise library. No API responses.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
        // version.json tells what is deployed now: never from a cache.
        globIgnores: ["**/node_modules/**/*", "version.json"],
        navigateFallback: "/index.html",
        // /r/ comes from the server, which sends its privacy headers.
        navigateFallbackDenylist: [
          /^\/(nt|ct|lt)(\/|$)/,
          /^\/__trace\//,
          /^\/r\//,
          /^\/version\.json$/,
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === "GET" &&
              (url.pathname.startsWith("/lt/uploads/exercise") ||
                // Custom exercises' media sits at the root of /uploads.
                /^\/lt\/uploads\/[^/]+\.(gif|jpe?g|png|webp|avif|mp4|webm)$/.test(
                  url.pathname,
                ) ||
                url.hostname === "static.exercisedb.dev" ||
                url.hostname === "v2.exercisedb.io" ||
                (url.hostname === "wger.de" &&
                  url.pathname.startsWith("/media/")) ||
                (url.hostname === "raw.githubusercontent.com" &&
                  url.pathname.startsWith("/yuhonas/free-exercise-db/"))),
            handler: "CacheFirst",
            options: {
              cacheName: "exercise-media",
              expiration: { maxEntries: 4000, purgeOnQuotaError: true },
              // Other sites' media comes back opaque (status 0).
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Only a server needs the backends: not a build, not the tests.
    proxy: command === "serve" && mode !== "test" ? devProxy() : undefined,
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    restoreMocks: true,
    // Room for the waits above on a loaded machine.
    testTimeout: 20000,
    server: {
      deps: { inline: [/@monocircuit\//] },
    },
  },
}));
