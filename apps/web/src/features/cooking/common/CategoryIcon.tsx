import { Package } from "lucide-react";

import { CATEGORY_ICONS } from "./categoryIconMap";

/** The icon of a stored Material Symbols name */
export function CategoryIcon({
  name,
  size = 20,
}: {
  name: string | null | undefined;
  size?: number;
}) {
  const Icon = CATEGORY_ICONS[name ?? "kitchen"] ?? Package;
  return <Icon aria-hidden size={size} />;
}
