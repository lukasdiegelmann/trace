import {
  Button,
  Input,
  Row,
  SearchMenu,
} from "@monocircuit/monolithium/components";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";

import { orderUnitGroups, unitGroupsMerged } from "../lib/units";
import { useUnitsOverlay } from "./useUnits";

export interface UnitPickerProps {
  /** The abbreviation; free text is allowed */
  value: string;
  onChange: (unit: string) => void;
  /** The field's label */
  label: string;
  placeholder?: string;
}

/**
 * A unit as free text, with the catalog (built-ins without the hidden
 * ones, plus custom units) to pick from.
 * TODO(monolithium): a creatable combobox with grouped options
 */
export function UnitPicker({
  value,
  onChange,
  label,
  placeholder,
}: UnitPickerProps) {
  const { t } = useTranslation("cooking");
  const overlay = useUnitsOverlay();
  const [measurementSystem] = useSetting("ct", "measurementSystem");
  const groups = orderUnitGroups(unitGroupsMerged(overlay), measurementSystem);
  const items = groups.flatMap((group) =>
    group.units.map((unit) => ({
      id: `${group.label}:${unit.abbr}`,
      text: unit.abbr,
      description: `${unit.full} · ${t(`cookingCommon.unitGroups.${group.labelKey as "custom"}`)}`,
      isChecked: unit.abbr === value,
      onSelect: () => {
        onChange(unit.abbr);
      },
    })),
  );
  return (
    <Row gap={1} align="end">
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        wrapperClassName="min-w-0 flex-1"
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <SearchMenu
        items={items}
        label={t("cookingCommon.units.pick")}
        placeholder={t("cookingCommon.search")}
        emptyText={t("cookingCommon.nothingFound")}
        align="end"
      >
        <Button
          variant="secondary"
          size="md"
          aria-label={t("cookingCommon.units.pick")}
        >
          <ChevronDown aria-hidden size={16} />
        </Button>
      </SearchMenu>
    </Row>
  );
}
