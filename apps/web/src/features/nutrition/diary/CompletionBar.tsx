import {
  Box,
  Button,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { CheckCircle2, Utensils } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { DiaryDay } from "../api";
import { parseServerTimestamp } from "../lib/dates";
import { itemsOfMeal } from "../lib/diary";
import { useNutritionFormat } from "../useNutritionFormat";

export function CompletionBar({
  day,
  mealCount,
  dayLabel,
  onToggle,
}: {
  day: DiaryDay;
  mealCount: number;
  dayLabel: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const format = useNutritionFormat();
  const isDone = day.completed_at !== null;
  const done = Array.from({ length: mealCount }, (_, index) => index).filter(
    (index) => itemsOfMeal(day.items, index).length > 0,
  ).length;

  return (
    <Box surface="surface" border="all" radius="lg" paddingX={3} paddingY={2}>
      <Row gap={3} align="center">
        {isDone ? (
          <CheckCircle2 aria-hidden size={18} />
        ) : (
          <Utensils aria-hidden size={18} />
        )}
        <Stack gap={0} shouldGrow>
          {isDone ? (
            <>
              <Text>{t("diary.completion.completed")}</Text>
              {day.completed_at && (
                <Text variant="caption">
                  {t("diary.completion.closedAt", {
                    time: format.time(parseServerTimestamp(day.completed_at)),
                  })}
                </Text>
              )}
            </>
          ) : (
            <>
              <span className="compact:hidden">
                <Text>{dayLabel}</Text>
              </span>
              <Text variant="caption">
                {t("diary.completion.progress", { done, total: mealCount })}
              </Text>
            </>
          )}
        </Stack>
        <Button
          size="sm"
          variant={isDone ? "secondary" : "primary"}
          text={t(
            isDone ? "diary.completion.reopen" : "diary.completion.complete",
          )}
          onClick={onToggle}
        />
      </Row>
    </Box>
  );
}
