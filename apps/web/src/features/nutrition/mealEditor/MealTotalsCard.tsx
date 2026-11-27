import {
  Box,
  Button,
  KeyValue,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { MealItem } from "../api";
import { mealTotals } from "../lib/mealForm";
import { nutrientTotalRows } from "../lib/nutrientFields";
import { round1 } from "../lib/nutrition";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";

/** What all ingredients add up to, own nutrients included */
export function MealTotalsCard({ items }: { items: MealItem[] }) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const [isShowingAll, setIsShowingAll] = useState(false);
  if (items.length === 0) return null;
  const rows = nutrientTotalRows(
    mealTotals(items),
    settings,
    settings.energyUnit,
    isShowingAll,
  );
  return (
    <Box surface="surface" border="all" radius="lg" padding={4}>
      <Stack gap={2}>
        <Text variant="heading" as="h2">
          {t("mealEditor.totals")}
        </Text>
        {rows.map((row) => (
          <KeyValue
            key={row.field.id}
            label={
              row.field.label ?? t(`nutrients.${row.field.id as "calories"}`)
            }
            value={`${format.number(round1(row.value))} ${row.unit}`}
          />
        ))}
        <Button
          size="sm"
          text={t(isShowingAll ? "foodEditor.showLess" : "foodEditor.showAll")}
          aria-expanded={isShowingAll}
          onClick={() => {
            setIsShowingAll(!isShowingAll);
          }}
        />
      </Stack>
    </Box>
  );
}
