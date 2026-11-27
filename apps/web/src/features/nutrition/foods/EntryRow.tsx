import {
  Button,
  Checkbox,
  Chip,
  Dot,
  Pressable,
  Row,
  Stack,
  Text,
  type MenuItem,
} from "@monocircuit/monolithium/components";
import { Heart, Info } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { FoodThumb } from "../components/FoodThumb";
import { RowMenu } from "../components/RowMenu";
import { categoryDisplay, categoryName } from "../lib/foodSearch";
import { mealieImageUrl } from "../lib/sources/mealie";
import {
  offCountryTagToFlag,
  offCountryTagToName,
} from "../lib/sources/offCountries";
import { offCompletenessTier } from "../lib/sources/offRank";
import { hasNoOffValues } from "../lib/sources/offStatus";
import { usdaBadge, usdaTier } from "../lib/sources/usda";
import { amountAndUnit } from "../lib/units";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { entryName, mealGrams, mealKcal, type Entry } from "./entries";

const TIER_TONES = {
  high: "success",
  medium: "warning",
  low: "danger",
  unknown: "muted",
} as const;

/** The picture, the line under the name and the badges of one list row */
function useRowContent(entry: Entry) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const parts: string[] = [];
  let image: string | null | undefined;

  const category = (name: string | null) => {
    if (!settings.foodsShowCategories || !name) return;
    const known = settings.foodCategories.find(
      (item) => categoryName(item) === name,
    );
    parts.push(known ? categoryDisplay(known, settings.foodsShowLabels) : name);
  };
  const amount = (
    portion: number | null | undefined,
    unit: string | null | undefined,
  ) => {
    parts.push(amountAndUnit(portion || 100, unit));
  };
  const perBasis = (basis: string | null) => {
    if (basis && (settings.showUnitMetadata || settings.warnUnitMismatch)) {
      parts.push(t("foods.row.per", { unit: basis }));
    }
  };

  switch (entry.kind) {
    case "food": {
      const food = entry.row;
      image = food.img_url;
      if (food.brand) parts.push(food.brand);
      amount(food.portion, food.unit);
      perBasis(food.nutrition_basis);
      parts.push(format.energy(food.nutrition.calories ?? 0));
      category(food.category);
      break;
    }
    case "meal": {
      const meal = entry.row;
      image = meal.img_url;
      if (meal.is_recipe) {
        if (meal.servings) {
          parts.push(t("foods.row.servings", { count: meal.servings }));
        }
        amount(meal.portion, meal.unit);
      } else {
        parts.push(`${format.number(mealGrams(meal), 0)} g`);
      }
      parts.push(format.energy(mealKcal(meal)));
      break;
    }
    case "external": {
      const food = entry.food;
      image = food.imgUrl;
      if (food.brand) parts.push(food.brand);
      amount(food.portion, food.unit);
      if (food.source === "off" && hasNoOffValues(food)) {
        // A search hit carries no values at all: they come with the product
        if (food.offInfo?.isFull) parts.push(t("foods.row.noValues"));
      } else {
        parts.push(format.energy(food.nutrition.calories ?? 0));
      }
      break;
    }
    case "mealie":
      image = mealieImageUrl(settings.mealieBaseUrl, entry.recipe.id);
      for (const item of entry.recipe.recipeCategory ?? []) {
        parts.push(item.name);
      }
      break;
    case "ctRecipe":
      image = entry.recipe.img_url;
      if (entry.recipe.servings) {
        parts.push(t("foods.row.servings", { count: entry.recipe.servings }));
      }
      break;
  }
  if (
    (entry.kind === "food" || entry.kind === "meal") &&
    entry.isShared &&
    entry.row._shared_by
  ) {
    parts.push(t("foods.row.by", { owner: entry.row._shared_by }));
  }
  // CookTrace's relative image paths live on its own server
  if (image?.startsWith("/uploads/") && entry.kind === "ctRecipe") {
    image = `${settings.cooktraceBaseUrl.replace(/\/$/, "")}${image}`;
  }
  return { image, meta: parts.join(" · ") };
}

export interface EntryRowProps {
  entry: Entry;
  /** In the "all" view: where the row comes from */
  sourceLabel?: string;
  selection?: { isSelected: boolean; onToggle: () => void } | null;
  /** The row toggles the selection instead of opening (manage mode) */
  shouldPressSelect?: boolean;
  onPress: () => void;
  actions?: MenuItem[];
  onInfo?: () => void;
  isHighlighted?: boolean;
}

export function EntryRow({
  entry,
  sourceLabel,
  selection,
  shouldPressSelect,
  onPress,
  actions,
  onInfo,
  isHighlighted,
}: EntryRowProps) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { image, meta } = useRowContent(entry);
  const name = entryName(entry);
  const external = entry.kind === "external" ? entry.food : null;
  const flag =
    external?.source === "off" && external.originTag
      ? offCountryTagToFlag(external.originTag)
      : "";
  const completeness =
    external?.source === "off" && external.completeness !== null
      ? external.completeness
      : null;
  const isFavorite =
    (entry.kind === "food" || entry.kind === "meal") &&
    Boolean(entry.row.favorite);

  return (
    <li
      onContextMenu={
        actions?.length
          ? (event) => {
              event.preventDefault();
              setIsMenuOpen(true);
            }
          : undefined
      }
      className={
        isHighlighted ? "list-none rounded-container bg-level-2" : "list-none"
      }
    >
      <Row gap={2} align="center" paddingX={2}>
        {selection && (
          <Checkbox
            checked={selection.isSelected}
            onChange={selection.onToggle}
            aria-label={t("foods.row.select", { name })}
          />
        )}
        <Pressable
          onPress={
            shouldPressSelect && selection ? selection.onToggle : onPress
          }
          shouldGrow
          paddingY={2}
        >
          <Row gap={3} align="center">
            {settings.foodsShowThumbnails && <FoodThumb url={image} />}
            <Stack gap={0} shouldGrow>
              <Row gap={1} align="center">
                {flag && (
                  <Text
                    as="span"
                    title={t("foods.row.origin", {
                      country: offCountryTagToName(external?.originTag),
                    })}
                  >
                    {flag}
                  </Text>
                )}
                <Text isTruncated>{name}</Text>
                {isFavorite && (
                  <span role="img" aria-label={t("foods.row.favorite")}>
                    <Heart aria-hidden size={12} fill="currentColor" />
                  </span>
                )}
              </Row>
              <Text variant="caption" isTruncated>
                {meta}
              </Text>
              {settings.foodsShowNotes &&
                (entry.kind === "food" || entry.kind === "meal") &&
                entry.row.notes && (
                  <Text variant="caption" isTruncated>
                    {entry.row.notes}
                  </Text>
                )}
            </Stack>
          </Row>
        </Pressable>
        {completeness !== null && (
          <Dot
            tone={TIER_TONES[offCompletenessTier(completeness)]}
            label={t("foods.row.completeness", {
              percent: Math.round(completeness * 100),
            })}
          />
        )}
        {external?.source === "usda" && (
          <Chip
            text={usdaBadge(external.dataType)}
            title={usdaTier(external.dataType)}
          />
        )}
        {sourceLabel && <Chip tone="muted" text={sourceLabel} />}
        {onInfo && (
          <Button
            size="sm"
            aria-label={t("foods.row.contents", { name })}
            onClick={onInfo}
          >
            <Info aria-hidden size={16} />
          </Button>
        )}
        {actions && actions.length > 0 && (
          <RowMenu
            items={actions}
            label={t("foods.row.actions", { name })}
            isOpen={isMenuOpen}
            onOpenChange={setIsMenuOpen}
          />
        )}
      </Row>
    </li>
  );
}
