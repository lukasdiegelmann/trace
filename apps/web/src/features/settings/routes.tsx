import type { RouteObject } from "react-router";

import { SettingsPage } from "./SettingsPage";

/** Mounted under /settings by src/router.tsx; every screen loads on demand */
export const settingsRoutes: RouteObject[] = [
  { index: true, element: <SettingsPage /> },
  {
    path: "appearance",
    lazy: async () => ({
      Component: (await import("./preferences/AppearancePage")).AppearancePage,
    }),
  },
  {
    path: "regional",
    lazy: async () => ({
      Component: (await import("./preferences/RegionalPage")).RegionalPage,
    }),
  },
  {
    path: "notifications",
    lazy: async () => ({
      Component: (await import("./preferences/NotificationsPage"))
        .NotificationsPage,
    }),
  },
  {
    path: "diary",
    lazy: async () => ({
      Component: (await import("./nutrition/DiaryPage")).DiaryPage,
    }),
  },
  {
    path: "goals",
    lazy: async () => ({
      Component: (await import("./nutrition/GoalsPage")).GoalsPage,
    }),
  },
  {
    path: "foods",
    lazy: async () => ({
      Component: (await import("./nutrition/FoodsPage")).FoodsPage,
    }),
  },
  {
    path: "nutrients",
    lazy: async () => ({
      Component: (await import("./nutrition/NutrientsPage")).NutrientsPage,
    }),
  },
  {
    path: "food-sources",
    lazy: async () => ({
      Component: (await import("./nutrition/FoodSourcesPage")).FoodSourcesPage,
    }),
  },
  {
    path: "cooking",
    lazy: async () => ({
      Component: (await import("./cooking/CookingPage")).CookingPage,
    }),
  },
  {
    path: "kitchens",
    lazy: async () => ({
      Component: (await import("./cooking/KitchensPage")).KitchensPage,
    }),
  },
  {
    path: "training",
    lazy: async () => ({
      Component: (await import("./training/TrainingPage")).TrainingPage,
    }),
  },
  {
    path: "catalog",
    lazy: async () => ({
      Component: (await import("./training/CatalogPage")).CatalogPage,
    }),
  },
  {
    path: "radio",
    lazy: async () => ({
      Component: (await import("./training/RadioPage")).RadioPage,
    }),
  },
  {
    path: "connections",
    lazy: async () => ({
      Component: (await import("./connections/ConnectionsPage"))
        .ConnectionsPage,
    }),
  },
  {
    path: "import",
    lazy: async () => ({
      Component: (await import("./data/ImportPage")).ImportPage,
    }),
  },
  {
    path: "backup",
    lazy: async () => ({
      Component: (await import("./data/BackupPage")).BackupPage,
    }),
  },
  {
    path: "sharing",
    lazy: async () => ({
      Component: (await import("./admin/SharingPage")).SharingPage,
    }),
  },
  {
    path: "users",
    lazy: async () => ({
      Component: (await import("./admin/UsersPage")).UsersPage,
    }),
  },
  {
    path: "authentication",
    lazy: async () => ({
      Component: (await import("./admin/AuthPage")).AuthPage,
    }),
  },
  {
    path: "email",
    lazy: async () => ({
      Component: (await import("./admin/EmailPage")).EmailPage,
    }),
  },
  {
    path: "api-tokens",
    lazy: async () => ({
      Component: (await import("./admin/TokensPage")).TokensPage,
    }),
  },
  {
    path: "webhooks",
    lazy: async () => ({
      Component: (await import("./admin/WebhooksPage")).WebhooksPage,
    }),
  },
  {
    path: "updates",
    lazy: async () => ({
      Component: (await import("./system/UpdatesPage")).UpdatesPage,
    }),
  },
  {
    path: "diagnostics",
    lazy: async () => ({
      Component: (await import("./system/DiagnosticsPage")).DiagnosticsPage,
    }),
  },
  {
    path: "about",
    lazy: async () => ({
      Component: (await import("./system/AboutPage")).AboutPage,
    }),
  },
  {
    path: "profile",
    lazy: async () => ({
      Component: (await import("./account/ProfilePage")).ProfilePage,
    }),
  },
  {
    path: "welcome",
    lazy: async () => ({
      Component: (await import("./account/WelcomePage")).WelcomePage,
    }),
  },
  {
    path: "assistant",
    lazy: async () => ({
      Component: (await import("./preferences/AssistantPage")).AssistantPage,
    }),
  },
];
