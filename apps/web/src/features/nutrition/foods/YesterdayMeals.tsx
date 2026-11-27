import {
  Button,
  Disclosure,
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Info, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { DiaryItem } from "../api";
import { AppDialog } from "../components/AppDialog";
import { MealIcon } from "@/features/shared/mealIcon";
import { dayTotals } from "../lib/diary";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { MealContents } from "./MealContents";
import type { YesterdayGroup } from "./useYesterday";

/** Yesterday's meals, to log one again with a tap */
export function YesterdayMeals({
  groups,
  onRepeat,
}: {
  groups: YesterdayGroup[];
  onRepeat: (items: DiaryItem[]) => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings, set } = useNtSettings();
  const format = useNutritionFormat();
  const [info, setInfo] = useState<number | null>(null);

  const shown = groups.find((group) => group.index === info);

  return (
    <Disclosure
      title={t("foods.yesterday.title")}
      isOpen={!settings.foodsYesterdayCollapsed}
      onOpenChange={(isOpen) => {
        set("foodsYesterdayCollapsed", !isOpen);
      }}
    >
      <Stack gap={1}>
        {groups.map((group) => (
          <Row gap={2} align="center" key={group.index}>
            <Pressable
              onPress={() => {
                onRepeat(group.items);
              }}
              shouldGrow
              paddingY={2}
              paddingX={2}
            >
              <Row gap={3} align="center">
                <MealIcon name={group.name} />
                <Stack gap={0} shouldGrow>
                  <Text>{group.name}</Text>
                  <Text variant="caption">
                    {`${t("foods.yesterday.count", { count: group.items.length })} · ${format.energy(dayTotals(group.items).calories || 0)}`}
                  </Text>
                </Stack>
              </Row>
            </Pressable>
            <Button
              size="sm"
              aria-label={t("foods.yesterday.info", { meal: group.name })}
              onClick={() => {
                setInfo(group.index);
              }}
            >
              <Info aria-hidden size={16} />
            </Button>
            <Button
              size="sm"
              aria-label={t("foods.yesterday.add", { meal: group.name })}
              onClick={() => {
                onRepeat(group.items);
              }}
            >
              <Plus aria-hidden size={16} />
            </Button>
          </Row>
        ))}
      </Stack>
      {shown && (
        <AppDialog
          title={shown.name}
          onClose={() => {
            setInfo(null);
          }}
        >
          <MealContents
            items={shown.items}
            action={{
              text: t("foods.yesterday.addMeal"),
              onClick: () => {
                setInfo(null);
                onRepeat(shown.items);
              },
            }}
          />
        </AppDialog>
      )}
    </Disclosure>
  );
}
