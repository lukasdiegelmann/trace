import { Button, SearchMenu } from "@monocircuit/monolithium/components";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { unitGroupsWithCustoms } from "../lib/units";
import { useNtSettings } from "../settings";

export interface UnitPickerProps {
  value: string;
  onChange: (unit: string) => void;
  /** Household units of the food itself, e.g. "slice" */
  extraUnits?: { abbr: string; grams: number }[] | null;
  isDisabled?: boolean;
}

/** A unit from the catalogue, the user's own units or the food's */
export function UnitPicker({
  value,
  onChange,
  extraUnits,
  isDisabled,
}: UnitPickerProps) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const [isOpen, setIsOpen] = useState(false);

  const known = new Set<string>();
  const items = [
    ...(extraUnits ?? [])
      .filter((unit) => unit.abbr)
      .map((unit) => ({
        abbr: unit.abbr,
        description: `${unit.grams} g`,
      })),
    ...unitGroupsWithCustoms(settings.customUnits).flatMap((group) =>
      group.units.map((unit) => ({
        abbr: unit.abbr,
        description: `${unit.full} · ${t(`unitGroups.${group.id}`)}`,
      })),
    ),
  ]
    .filter((unit) => {
      if (known.has(unit.abbr)) return false;
      known.add(unit.abbr);
      return true;
    })
    .map((unit) => ({
      id: unit.abbr,
      text: unit.abbr,
      description: unit.description,
      isChecked: unit.abbr === value,
      onSelect: () => {
        onChange(unit.abbr);
      },
    }));

  const label = `${t("unit.label")}: ${value || "g"}`;
  const trigger = (
    <Button
      variant="secondary"
      size="lg"
      text={value || "g"}
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      isDisabled={isDisabled}
      isIconTrailing
    >
      <ChevronDown aria-hidden size={16} />
    </Button>
  );
  if (isDisabled) return trigger;
  return (
    <SearchMenu
      items={items}
      label={t("unit.label")}
      placeholder={t("unit.search")}
      emptyText={t("unit.none")}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    >
      {/* Button takes no trigger props: its click bubbles to this span */}
      <span className="inline-flex">{trigger}</span>
    </SearchMenu>
  );
}
