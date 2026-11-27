import {
  Button,
  Chip,
  Dot,
  EmptyState,
  Pressable,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { ChevronRight, CirclePlus, ScanBarcode, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";

import { assetUrl } from "../lib/assetUrl";
import {
  completenessLevel,
  type ExternalFood,
  type FoodSource,
} from "../lib/externalFoods";
import { offCountryTagToFlag, offCountryTagToName } from "../lib/offCountry";
import type { PantryItem } from "../pantryApi";

const DOT_TONES = { high: "success", mid: "warning", low: "muted" } as const;

export type ResultRow =
  | { source: FoodSource; food: ExternalFood }
  | { source: "local"; item: PantryItem };

/*
 * TODO(monolithium): Pressable's own bg-transparent and border-0 beat the
 * classes given to it; surfaces and borders on it need Tailwind's "!".
 */
export interface ExternalResultsListProps {
  rows: ResultRow[];
  isSearching: boolean;
  /** "OFF", "USDA", …; null in the merged view */
  sourceName: string | null;
  /** Results exist but the quality filter hides all of them */
  isAllFiltered: boolean;
  onResetFilter: () => void;
  onPickFood: (food: ExternalFood) => void;
  onOpenItem: (item: PantryItem) => void;
}

/** Search results from OFF, USDA and NutriTrace (and the pantry in "All") */
export function ExternalResultsList({
  rows,
  isSearching,
  sourceName,
  isAllFiltered,
  onResetFilter,
  onPickFood,
  onOpenItem,
}: ExternalResultsListProps) {
  const { t } = useTranslation("cooking");

  if (isSearching) {
    return (
      <Stack align="center" padding={6}>
        <Spinner
          label={
            sourceName
              ? t("pantry.external.searching", { source: sourceName })
              : t("pantry.external.searchingAll")
          }
        />
      </Stack>
    );
  }
  if (isAllFiltered) {
    return (
      <Stack align="center" gap={3} padding={6}>
        <Text tone="muted">
          {t("pantry.external.allHidden", { source: sourceName })}
        </Text>
        <Button
          variant="secondary"
          size="md"
          text={t("pantry.tiers.reset")}
          onClick={onResetFilter}
        />
      </Stack>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<SearchX aria-hidden size={24} />}
        text={
          sourceName
            ? t("pantry.external.noneIn", { source: sourceName })
            : t("pantry.external.noneAll")
        }
      />
    );
  }

  return (
    <Stack gap={1} as="ul">
      {rows.map((row, index) => {
        const food = row.source === "local" ? row.item : row.food;
        const external = row.source === "local" ? null : row.food;
        const flag =
          row.source === "off" ? offCountryTagToFlag(external?.originTag) : "";
        return (
          <li key={`${row.source}:${index}:${food.barcode ?? food.name}`}>
            <Pressable
              onPress={() => {
                if (row.source === "local") onOpenItem(row.item);
                else onPickFood(row.food);
              }}
              className="flex w-full flex-row items-center gap-3 rounded-control bg-level-2! p-2 text-start hover:bg-level-3!"
            >
              {food.img_url ? (
                <img
                  src={assetUrl(food.img_url)}
                  alt=""
                  loading="lazy"
                  className="size-12 rounded-control object-cover"
                />
              ) : (
                <span className="flex size-12 items-center justify-center">
                  <ScanBarcode aria-hidden size={20} />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-1.5">
                  {sourceName ? null : (
                    <Chip text={t(`pantry.sources.${row.source}`)} />
                  )}
                  <Text as="span">{food.name}</Text>
                  {row.source === "off" && external?.completeness != null ? (
                    <Dot
                      tone={DOT_TONES[completenessLevel(external.completeness)]}
                      label={t("pantry.external.completeness", {
                        percent: Math.round(external.completeness * 100),
                      })}
                    />
                  ) : null}
                  {flag ? (
                    <span
                      role="img"
                      aria-label={t("pantry.external.origin", {
                        country: offCountryTagToName(external?.originTag),
                      })}
                      title={offCountryTagToName(external?.originTag)}
                    >
                      {flag}
                    </span>
                  ) : null}
                  {row.source === "usda" && external?.dataType ? (
                    <Chip tone="muted" text={external.dataType} />
                  ) : null}
                </span>
                {food.brand ? (
                  <Text as="span" variant="small" tone="muted">
                    {food.brand}
                  </Text>
                ) : null}
                {food.barcode ? (
                  <Text as="span" variant="caption" tone="muted">
                    {food.barcode}
                  </Text>
                ) : null}
              </span>
              {row.source === "local" ? (
                <ChevronRight aria-hidden size={18} />
              ) : (
                <CirclePlus aria-hidden size={18} />
              )}
            </Pressable>
          </li>
        );
      })}
    </Stack>
  );
}
