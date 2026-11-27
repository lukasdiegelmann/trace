import { ToastProvider } from "@monocircuit/monolithium/components";
import { ZLayerProvider } from "@monocircuit/monolithium/contexts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";

import "./styles.css";
import "@/i18n";

import { AuthProvider } from "@/auth/AuthProvider";
import { installLogCapture } from "@/features/shared/logCapture";
import { registerServiceWorker } from "@/pwa/registerServiceWorker";
import { routes } from "@/router";
import { initTheme } from "@/theme/theme";

installLogCapture();
initTheme();
registerServiceWorker();

const router = createBrowserRouter(routes);
const root = document.getElementById("root");
if (!root) throw new Error("#root is missing in index.html");

createRoot(root).render(
  <StrictMode>
    {/* Menus, popovers and dialogs open above whatever opened them; the
        base lies over monolithium's Sheet (z-70) and under its toasts */}
    <ZLayerProvider base={100}>
      {/* On a phone toasts stand above the floating navigation bar */}
      <ToastProvider className="compact:bottom-[calc(5rem+env(safe-area-inset-bottom)+min(var(--monolithium-sheet-inset,0px),60dvh))]">
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </ZLayerProvider>
  </StrictMode>,
);
