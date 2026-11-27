import type { RouteObject } from "react-router";

/** Nothing shows while a screen's chunk loads on the first visit */
const HydrateFallback = () => null;

/** Statistics, Wellness and their settings, mounted under /nutrition */
export const insightRoutes: RouteObject[] = [
  {
    path: "statistics",
    HydrateFallback,
    lazy: async () => ({
      Component: (await import("./statistics/StatisticsPage")).StatisticsPage,
    }),
  },
  {
    path: "statistics/settings",
    HydrateFallback,
    lazy: async () => ({
      Component: (await import("./settings/StatisticsSettingsPage"))
        .StatisticsSettingsPage,
    }),
  },
  {
    path: "statistics/body-stats",
    HydrateFallback,
    lazy: async () => ({
      Component: (await import("./settings/BodyStatsSettingsPage"))
        .BodyStatsSettingsPage,
    }),
  },
  {
    path: "wellness",
    HydrateFallback,
    lazy: async () => ({
      Component: (await import("./wellness/WellnessPage")).WellnessPage,
    }),
  },
  {
    path: "wellness/settings",
    HydrateFallback,
    lazy: async () => ({
      Component: (await import("./settings/WellnessSettingsPage"))
        .WellnessSettingsPage,
    }),
  },
];
