import {
  Button,
  Stack,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { DiaryItem } from "../api";
import { FoodThumb } from "../components/FoodThumb";
import { sumNutrition, calculate } from "../lib/nutrition";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { ItemRow } from "./ItemRow";
import { itemName } from "./itemText";

export interface QuickRowsProps {
  items: DiaryItem[];
  onEdit: (item: DiaryItem) => void;
  onRemove: (item: DiaryItem) => void;
  actionsFor: (item: DiaryItem) => MenuItem[];
  selection: Set<string> | null;
  onToggleSelected: (uuid: string) => void;
}

/** A meal's quick entries: one row each, or one row for all that unfolds */
export function QuickRows({
  items,
  onEdit,
  onRemove,
  actionsFor,
  selection,
  onToggleSelected,
}: QuickRowsProps) {
  const { t } = useTranslation("nutrition");
  const format = useNutritionFormat();
  const { settings } = useNtSettings();
  const [isOpen, setIsOpen] = useState(false);
  if (items.length === 0) return null;

  const meta = (item: DiaryItem) => {
    const energy = format.energy(calculate(item).calories || 0);
    return settings.diaryShowTimestamps && item.addedAt
      ? `${energy} · ${format.time(new Date(item.addedAt))}`
      : energy;
  };
  const single = (item: DiaryItem, isSelectable: boolean) => (
    <ItemRow
      key={item.uuid}
      name={itemName(item, t)}
      meta={meta(item)}
      thumb={<FoodThumb isQuick />}
      onPress={() => {
        onEdit(item);
      }}
      actions={actionsFor(item)}
      selection={
        selection && isSelectable
          ? {
              isSelected: selection.has(item.uuid),
              onToggle: () => {
                onToggleSelected(item.uuid);
              },
            }
          : null
      }
    />
  );

  if (settings.quickCaloriesDisplay === "separate") {
    return <>{items.map((item) => single(item, true))}</>;
  }
  if (items.length === 1) return single(items[0], false);

  const total = sumNutrition(items.map(calculate)).calories || 0;
  return (
    <Stack gap={0}>
      <ItemRow
        name={t("diary.quick.group", { count: items.length })}
        meta={`${format.energy(total)} · ${t(
          isOpen ? "diary.quick.collapse" : "diary.quick.expand",
        )}`}
        thumb={<FoodThumb isQuick />}
        onPress={() => {
          setIsOpen(!isOpen);
        }}
        trailing={
          isOpen ? (
            <ChevronUp aria-hidden size={16} />
          ) : (
            <ChevronDown aria-hidden size={16} />
          )
        }
      />
      {isOpen &&
        items.map((item) => (
          <div key={item.uuid} className="pl-8">
            <ItemRow
              name={itemName(item, t)}
              meta={meta(item)}
              onPress={() => {
                onEdit(item);
              }}
              actions={actionsFor(item)}
              trailing={
                <Button
                  size="sm"
                  aria-label={t("diary.removeIngredient", {
                    name: itemName(item, t),
                  })}
                  onClick={() => {
                    onRemove(item);
                  }}
                >
                  <X aria-hidden size={16} />
                </Button>
              }
            />
          </div>
        ))}
    </Stack>
  );
}
