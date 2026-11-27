import { SegmentedControl } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

const TABS = [
  { value: "recipes", path: "/cooking" },
  { value: "pantry", path: "/cooking/pantry" },
  { value: "shopping", path: "/cooking/shopping" },
  { value: "diary", path: "/cooking/diary" },
  { value: "manage", path: "/cooking/manage" },
] as const;

type Tab = (typeof TABS)[number]["value"];

function tabOf(pathname: string): Tab {
  const match = TABS.slice(1).find(
    (tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`),
  );
  return match?.value ?? "recipes";
}

/** The sections of Cooking: the old app's bottom navigation */
export function CookingNav() {
  const { t } = useTranslation("cooking");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <SegmentedControl<Tab>
      aria-label={t("cookingCommon.nav.label")}
      variant="pill"
      value={tabOf(pathname)}
      options={TABS.map((tab) => ({
        value: tab.value,
        label: t(`cookingCommon.nav.${tab.value}`),
      }))}
      onChange={(value) => {
        const tab = TABS.find((candidate) => candidate.value === value);
        if (tab) void navigate(tab.path);
      }}
      className="max-w-full self-start overflow-x-auto"
    />
  );
}
