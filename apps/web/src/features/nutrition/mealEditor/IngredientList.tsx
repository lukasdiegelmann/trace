import {
  Box,
  Button,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { MealItem } from "../api";
import { FoodThumb } from "../components/FoodThumb";
import { ItemRow } from "../diary/ItemRow";
import { moveIngredient, reorderIngredients } from "../lib/mealForm";
import { calculate } from "../lib/nutrition";
import { amountAndUnit } from "../lib/units";
import { useNutritionFormat } from "../useNutritionFormat";

// TODO(monolithium): a sortable list with a drag handle and touch support;
// rows are dragged as a whole, and the row menu moves them on touch screens.
const DRAG_TYPE = "application/x-nt-ingredient";

export function IngredientList({
  items,
  isRecipe,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
}: {
  items: MealItem[];
  isRecipe: boolean;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onReorder: (items: MealItem[]) => void;
}) {
  const { t } = useTranslation("nutrition");
  const format = useNutritionFormat();
  const total = items.reduce(
    (sum, item) => sum + (calculate(item).calories || 0),
    0,
  );
  return (
    <Box surface="surface" border="all" radius="lg" paddingY={3}>
      <Stack gap={2}>
        <Row gap={2} align="center" justify="between" paddingX={4}>
          <Stack gap={0}>
            <Text variant="heading" as="h2">
              {t(
                isRecipe
                  ? "mealEditor.ingredients.titleRecipe"
                  : "mealEditor.ingredients.titleMeal",
              )}
            </Text>
            {items.length > 0 && (
              <Text variant="caption">
                {t("mealEditor.ingredients.total", {
                  energy: format.energy(total),
                })}
              </Text>
            )}
          </Stack>
          <Button
            size="sm"
            variant="secondary"
            text={t("mealEditor.ingredients.add")}
            onClick={onAdd}
          >
            <Plus aria-hidden size={14} />
          </Button>
        </Row>
        {items.length === 0 && (
          <Box paddingX={4}>
            <Text tone="muted">{t("mealEditor.ingredients.empty")}</Text>
          </Box>
        )}
        {items.map((item, index) => (
          <div
            key={`${item.id ?? item.name}-${index}`}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes(DRAG_TYPE)) {
                event.preventDefault();
              }
            }}
            onDrop={(event) => {
              const from = event.dataTransfer.getData(DRAG_TYPE);
              if (from === "") return;
              event.preventDefault();
              onReorder(reorderIngredients(items, Number(from), index));
            }}
          >
            <ItemRow
              name={item.name}
              meta={`${amountAndUnit(item.portion, item.unit)} · ${format.energy(calculate(item).calories || 0)}`}
              thumb={<FoodThumb url={item.imgUrl} />}
              onPress={() => {
                onEdit(index);
              }}
              onDragStart={(event) => {
                event.dataTransfer.setData(DRAG_TYPE, String(index));
                event.dataTransfer.effectAllowed = "move";
              }}
              actions={[
                {
                  id: "edit",
                  text: t("mealEditor.ingredients.edit"),
                  onSelect: () => {
                    onEdit(index);
                  },
                },
                {
                  id: "up",
                  text: t("mealEditor.ingredients.moveUp"),
                  isDisabled: index === 0,
                  onSelect: () => {
                    onReorder(moveIngredient(items, index, -1));
                  },
                },
                {
                  id: "down",
                  text: t("mealEditor.ingredients.moveDown"),
                  isDisabled: index === items.length - 1,
                  onSelect: () => {
                    onReorder(moveIngredient(items, index, 1));
                  },
                },
                {
                  id: "remove",
                  text: t("mealEditor.ingredients.remove"),
                  tone: "danger",
                  hasSeparatorBefore: true,
                  onSelect: () => {
                    onRemove(index);
                  },
                },
              ]}
            />
          </div>
        ))}
        {items.length > 0 && (
          <Row gap={2} align="center" justify="between" paddingX={4}>
            <Text variant="caption">
              {`${format.energy(total)} · ${t("mealEditor.ingredients.count", { count: items.length })}`}
            </Text>
            <Button
              size="sm"
              text={t("mealEditor.ingredients.add")}
              onClick={onAdd}
            >
              <Plus aria-hidden size={14} />
            </Button>
          </Row>
        )}
      </Stack>
    </Box>
  );
}
