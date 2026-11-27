import type { RouteObject } from "react-router";

import { CallbackPage } from "@/auth/CallbackPage";
import { PublicRecipePage } from "@/features/cooking/public/PublicRecipePage";
import { cookingRoutes } from "@/features/cooking/routes";
import { StartRedirect } from "@/features/nutrition/insights/StartRedirect";
import { nutritionRoutes } from "@/features/nutrition/routes";
import { settingsRoutes } from "@/features/settings/routes";
import { trainingRoutes } from "@/features/training/routes";
import { AppShell } from "@/shell/AppShell";
import { NotFoundPage } from "@/shell/NotFoundPage";
import { RootLayout } from "@/shell/RootLayout";

/** History-mode routes; each feature owns the routes below its prefix */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      // Outside the shell: it runs while the backends are still signing in.
      { path: "/auth/callback/:backend", element: <CallbackPage /> },
      // A shared recipe, open to anyone with the link: no sign-in.
      { path: "/r/:token", element: <PublicRecipePage /> },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <StartRedirect /> },
          { path: "nutrition", children: nutritionRoutes },
          { path: "cooking", children: cookingRoutes },
          { path: "training", children: trainingRoutes },
          { path: "settings", children: settingsRoutes },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
