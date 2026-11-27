import { Button, Row, Stack, Text } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { FoodThumb } from "../components/FoodThumb";
import { calculate, round1 } from "../lib/nutrition";
import { amountAndUnit } from "../lib/units";
import { useNutritionFormat } from "../useNutritionFormat";

export interface ContentsItem {
  name: string;
  brand?: string | null;
  portion?: number | null;
  unit?: string | null;
  quantity?: number | null;
  nutrition: Record<string, number | undefined>;
  imgUrl?: string | null;
}

/** What a meal, a recipe or yesterday's meal consists of */
export function MealContents({
  items,
  action,
}: {
  items: ContentsItem[];
  action?: { text: string; onClick: () => void };
}) {
  const { t } = useTranslation("nutrition");
  const format = useNutritionFormat();
  const total = items.reduce(
    (sum, item) => sum + (calculate(item).calories || 0),
    0,
  );
  return (
    <Stack gap={2}>
      {items.length === 0 && (
        <Text tone="muted">{t("foods.contents.empty")}</Text>
      )}
      {items.map((item, index) => {
        const kcal = calculate(item).calories || 0;
        const amount = amountAndUnit(
          round1((item.portion || 100) * (item.quantity || 1)),
          item.unit,
        );
        return (
          <Row gap={3} align="center" key={`${item.name}-${index}`}>
            <FoodThumb url={item.imgUrl} />
            <Stack gap={0} shouldGrow>
              <Text isTruncated>{item.name}</Text>
              <Text variant="caption" isTruncated>
                {[item.brand, amount].filter(Boolean).join(" · ")}
              </Text>
            </Stack>
            <Text variant="small">{format.energy(kcal)}</Text>
          </Row>
        );
      })}
      {items.length > 0 && (
        <Text variant="label">
          {t("foods.contents.total", { energy: format.energy(total) })}
        </Text>
      )}
      {action && (
        <Button
          variant="primary"
          size="lg"
          isFullWidth
          text={action.text}
          onClick={action.onClick}
        />
      )}
    </Stack>
  );
}
