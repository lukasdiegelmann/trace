import {
  SegmentedControl,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router";

import { UiProvider } from "./components/UiProvider";
import { useReloadSettingsOnReturn } from "./settings";

/** The nutrition screens reachable from the section's own navigation */
const NUTRITION_SCREENS = [
  { id: "diary", path: "/nutrition" },
  { id: "foods", path: "/nutrition/foods" },
  { id: "goals", path: "/nutrition/goals" },
  { id: "statistics", path: "/nutrition/statistics" },
  { id: "wellness", path: "/nutrition/wellness" },
] as const;

type ScreenId = (typeof NUTRITION_SCREENS)[number]["id"];

function screenOfPath(pathname: string): ScreenId | null {
  if (pathname === "/nutrition" || pathname === "/nutrition/") return "diary";
  const match = [...NUTRITION_SCREENS]
    .reverse()
    .find(
      (screen) =>
        screen.path !== "/nutrition" &&
        (pathname === screen.path || pathname.startsWith(`${screen.path}/`)),
    );
  return match?.id ?? null;
}

/**
 * Frame of every /nutrition screen: the section title and the switch between
 * its screens. Statistics and Wellness bring their own title. Editors and
 * their settings screens show without the switch, as pages of their own.
 */
export function NutritionLayout() {
  const { t } = useTranslation("nutrition");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = screenOfPath(pathname);
  const isSubPage = /\/(edit|settings|body-stats)(\/|$)/.test(pathname);
  const hasOwnTitle = active === "statistics" || active === "wellness";
  useReloadSettingsOnReturn();

  return (
    <Stack gap={0} fill="width">
      {!isSubPage && (
        <Stack gap={3} paddingX={4} paddingTop={4}>
          {!hasOwnTitle && (
            <Text variant="title" as="h1">
              {t("title")}
            </Text>
          )}
          <div className="max-w-full overflow-x-auto">
            <SegmentedControl<ScreenId>
              aria-label={t("nav.label")}
              options={NUTRITION_SCREENS.map((screen) => ({
                value: screen.id,
                label: t(`nav.${screen.id}`),
              }))}
              value={active ?? "diary"}
              onChange={(id) => {
                const screen = NUTRITION_SCREENS.find(
                  (candidate) => candidate.id === id,
                );
                if (screen) void navigate(screen.path);
              }}
            />
          </div>
        </Stack>
      )}
      <UiProvider>
        <Outlet />
      </UiProvider>
    </Stack>
  );
}
