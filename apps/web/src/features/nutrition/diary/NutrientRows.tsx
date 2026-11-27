import {
  Pressable,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { DiaryItem } from "../api";
import { contributors, dayTotals } from "../lib/diary";
import { NUTRIMENTS, round1 } from "../lib/nutrition";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { itemName, totalAmount } from "./itemText";

const TOP_COUNT = 5;

/** Every nutrient these items add up to; one unfolds to where it came from */
export function NutrientRows({ items }: { items: DiaryItem[] }) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const [open, setOpen] = useState<string | null>(null);
  const [isShowingAll, setIsShowingAll] = useState(false);
  const totals = dayTotals(items);
  const rows = NUTRIMENTS.filter(
    (nutrient) =>
      (settings.diaryShowAllNutrients || nutrient.isDefault) &&
      (totals[nutrient.id] || 0) > 0,
  );

  if (rows.length === 0) {
    return <Text tone="muted">{t("diary.summary.empty")}</Text>;
  }

  const amount = (value: number, id: string, unit: string) =>
    id === "calories"
      ? format.energy(value)
      : `${format.number(round1(value), 1)} ${unit}`;

  return (
    <Stack gap={0}>
      {rows.map((nutrient) => {
        const label = t(`nutrients.${nutrient.id as "calories"}`);
        const isOpen = open === nutrient.id;
        const sources = isOpen ? contributors(items, nutrient.id) : [];
        const shown = isShowingAll ? sources : sources.slice(0, TOP_COUNT);
        const hidden = sources.slice(shown.length);
        return (
          <Stack gap={0} key={nutrient.id}>
            <Pressable
              isExpanded={isOpen}
              onPress={() => {
                setOpen(isOpen ? null : nutrient.id);
                setIsShowingAll(false);
              }}
              paddingY={2}
              fill="width"
            >
              <Row gap={2} align="center" justify="between">
                <Text variant={nutrient.isBold ? "body" : "small"}>
                  {label}
                </Text>
                <Row gap={2} align="center">
                  <Text variant="small">
                    {amount(totals[nutrient.id], nutrient.id, nutrient.unit)}
                  </Text>
                  {isOpen ? (
                    <ChevronUp aria-hidden size={14} />
                  ) : (
                    <ChevronDown aria-hidden size={14} />
                  )}
                </Row>
              </Row>
            </Pressable>
            {isOpen && (
              <Stack
                gap={1}
                paddingX={3}
                paddingBottom={2}
                aria-label={t("diary.summary.contributors", {
                  nutrient: label,
                })}
                role="list"
              >
                {shown.map(({ item, value }) => (
                  <Row
                    gap={2}
                    justify="between"
                    key={item.uuid}
                    role="listitem"
                  >
                    <Text variant="caption" isTruncated>
                      {itemName(item, t)} ·{" "}
                      {item.type === "quick_calories"
                        ? t("diary.quick.entry")
                        : totalAmount(item)}
                    </Text>
                    <Text variant="caption">
                      {amount(value, nutrient.id, nutrient.unit)}
                    </Text>
                  </Row>
                ))}
                {hidden.length > 0 && (
                  <Pressable
                    onPress={() => {
                      setIsShowingAll(true);
                    }}
                  >
                    <Text variant="caption" tone="accent">
                      {t("diary.summary.more", {
                        count: hidden.length,
                        amount: amount(
                          hidden.reduce((sum, entry) => sum + entry.value, 0),
                          nutrient.id,
                          nutrient.unit,
                        ),
                      })}
                    </Text>
                  </Pressable>
                )}
                {isShowingAll && sources.length > TOP_COUNT && (
                  <Pressable
                    onPress={() => {
                      setIsShowingAll(false);
                    }}
                  >
                    <Text variant="caption" tone="accent">
                      {t("diary.summary.showTop")}
                    </Text>
                  </Pressable>
                )}
              </Stack>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}
