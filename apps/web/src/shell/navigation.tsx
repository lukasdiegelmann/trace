import type { NavigatorEntry } from "@monocircuit/monolithium/components";
import { ChefHat, Dumbbell, Salad, Settings } from "lucide-react";
import type { TFunction } from "i18next";

/** The app's top-level sections, in navigation order */
export const SECTIONS = [
  { id: "nutrition", path: "/nutrition", Icon: Salad },
  { id: "cooking", path: "/cooking", Icon: ChefHat },
  { id: "training", path: "/training", Icon: Dumbbell },
  { id: "settings", path: "/settings", Icon: Settings },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export function sectionOfPath(pathname: string): SectionId | undefined {
  return SECTIONS.find(
    (section) =>
      pathname === section.path || pathname.startsWith(`${section.path}/`),
  )?.id;
}

export function navigatorEntries(t: TFunction): NavigatorEntry[] {
  return SECTIONS.map(({ id, Icon }) => ({
    id,
    label: t(`nav.${id}`),
    description: t(`nav.${id}Description`),
    icon: <Icon aria-hidden size={20} />,
  }));
}
