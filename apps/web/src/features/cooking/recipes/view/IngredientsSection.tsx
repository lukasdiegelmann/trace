import {
  Button,
  Checkbox,
  Menu,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { displayQtyParts, parseQty } from "../../lib/qty";
import { scaledServings } from "../../lib/scale";
import {
  convertQty,
  lookupCommonDensity,
  unitFamily,
  VOLUME_TARGETS,
  WEIGHT_TARGETS,
  type PantryById,
} from "../../lib/recipeNutrition";
import type { Ingredient, IngredientGroup } from "../../recipesApi";

import { ScaleControl } from "./ScaleControl";

/** Grams per cup: the linked pantry row's, else the built-in table's */
function densityOf(item: Ingredient, pantry: PantryById): number | null {
  const linked =
    item.pantry_item_id === undefined
      ? undefined
      : pantry.get(item.pantry_item_id);
  return linked?.g_per_cup || lookupCommonDensity(item.name);
}

const isConvertible = (item: Ingredient) => {
  const family = unitFamily(item.unit);
  return (
    (family === "volume" || family === "weight") && parseQty(item.qty) !== null
  );
};

/** The units a quantity can be shown in; across families only by density */
function targetsOf(item: Ingredient, pantry: PantryById): string[] {
  const own = (item.unit ?? "").toLowerCase().trim();
  const isVolume = unitFamily(item.unit) === "volume";
  const same = isVolume ? VOLUME_TARGETS : WEIGHT_TARGETS;
  const other = isVolume ? WEIGHT_TARGETS : VOLUME_TARGETS;
  const all = densityOf(item, pantry) ? [...same, ...other] : same;
  return all.filter((unit) => unit !== own);
}

function converted(
  item: Ingredient,
  scale: number,
  target: string,
  pantry: PantryById,
): string | null {
  const qty = parseQty(item.qty);
  if (qty === null) return null;
  const value = convertQty(
    qty * scale,
    item.unit,
    target,
    densityOf(item, pantry),
  );
  if (value === null) return null;
  const rounded =
    Math.abs(value - Math.round(value)) < 0.05
      ? Math.round(value)
      : Math.round(value * 10) / 10;
  return String(rounded);
}

/** "1 ½ cup", the fraction set smaller as in cookbooks */
export function Amount({
  item,
  scale,
}: {
  item: Pick<Ingredient, "qty" | "unit">;
  scale: number;
}) {
  const parts = displayQtyParts(item.qty, item.unit, scale);
  return (
    <>
      {parts.whole}
      {parts.whole && parts.fraction ? " " : ""}
      {parts.fraction ? (
        <span className="text-[0.85em]">{parts.fraction}</span>
      ) : null}
      {item.unit ? ` ${item.unit}` : ""}
    </>
  );
}

export interface IngredientsSectionProps {
  groups: IngredientGroup[];
  servings: number | null;
  scale: number;
  onScale: (scale: number) => void;
  /** Without it (the public page) there is no unit conversion */
  pantry?: PantryById;
  hasServingsInput?: boolean;
  /** Set while cooking: ingredients can be ticked off */
  checked?: string[];
  onToggle?: (key: string) => void;
}

export function IngredientsSection({
  groups,
  servings,
  scale,
  onScale,
  pantry,
  hasServingsInput,
  checked,
  onToggle,
}: IngredientsSectionProps) {
  const { t } = useTranslation("cooking");
  const [units, setUnits] = useState<Record<string, string>>({});
  const hasIngredients = groups.some((group) => group.items.length > 0);

  const amount = (item: Ingredient, key: string) => {
    if (!item.qty && !item.unit) return null;
    const target = units[key] as string | undefined;
    const value =
      target && pantry ? converted(item, scale, target, pantry) : null;
    const content =
      value !== null ? (
        `${value} ${target}`
      ) : (
        <Amount item={item} scale={scale} />
      );
    if (!pantry || !isConvertible(item)) {
      return (
        <Text as="strong" className="font-semibold">
          {content}
        </Text>
      );
    }
    const choose = (unit: string) => () => {
      setUnits((previous) => ({ ...previous, [key]: unit }));
    };
    return (
      <Menu
        label={t("recipeView.convert")}
        items={[
          {
            id: "original",
            text: t("recipeView.originalUnit", { unit: item.unit || "—" }),
            isChecked: !target,
            onSelect: choose(""),
          },
          ...targetsOf(item, pantry).map((unit) => ({
            id: unit,
            text: unit,
            isChecked: target === unit,
            onSelect: choose(unit),
          })),
        ]}
      >
        <Button
          variant="secondary"
          size="sm"
          aria-label={`${t("recipeView.convert")}: ${item.name}`}
        >
          <span>{content}</span>
        </Button>
      </Menu>
    );
  };

  return (
    <Stack gap={3} as="section">
      <Row gap={2} align="baseline">
        <Text variant="heading" as="h2">
          {t("recipeView.ingredients")}
        </Text>
        {servings ? (
          <Text variant="caption" tone="muted">
            {t("recipeView.servingsCount", {
              count: scaledServings(servings, scale),
            })}
          </Text>
        ) : null}
      </Row>
      <ScaleControl
        scale={scale}
        onChange={onScale}
        servings={servings}
        hasServingsInput={hasServingsInput}
      />
      {hasIngredients ? null : (
        <Text tone="muted">{t("recipeView.noIngredients")}</Text>
      )}
      {groups.map((group, groupIndex) => (
        <Stack gap={1} key={groupIndex}>
          {group.name ? (
            <Text variant="label" as="h3">
              {group.name}
            </Text>
          ) : null}
          <Stack gap={2} as="ul">
            {group.items.map((item, itemIndex) => {
              const key = `${groupIndex}-${itemIndex}`;
              const isChecked = checked?.includes(key) ?? false;
              return (
                <li key={key} className="flex items-center gap-2">
                  {onToggle ? (
                    <Checkbox
                      checked={isChecked}
                      onChange={() => {
                        onToggle(key);
                      }}
                      aria-label={item.name}
                    />
                  ) : null}
                  <div
                    className={`flex flex-wrap items-center gap-x-2 ${
                      isChecked ? "line-through opacity-55" : ""
                    } ${onToggle ? "text-lg" : "text-body"}`}
                  >
                    {amount(item, key)}
                    <span>
                      {item.name}
                      {item.note ? (
                        <span className="text-muted italic">
                          {" "}
                          — {item.note}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </li>
              );
            })}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}
