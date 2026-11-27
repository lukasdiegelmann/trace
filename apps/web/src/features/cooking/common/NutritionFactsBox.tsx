import { Box, Row, Stack, Text } from "@monocircuit/monolithium/components";
import { Calculator } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";

import {
  displayEnergy,
  dvPercent,
  energyLabelKey,
  energyUnitSuffix,
  formatNutrient,
  isDerived,
  nutrimentDepth,
  NUTRIMENTS,
  visibleNutrimentIds,
  type Nutriment,
  type Nutrition,
} from "../lib/nutriments";

export interface NutritionFactsBoxProps {
  nutrition: Nutrition | null | undefined;
  /** Recipe context: the number of servings */
  servings?: number | null;
  /** Recipe context: grams per serving (computeRecipeMass) */
  recipeMassG?: number | null;
  /** Pantry context: "100 g"; wins over the recipe values */
  servingDescription?: string;
  /** Packaged-food line (pantry only) */
  servingsPerContainer?: number | null;
  /** Every value, ignoring the `visibleNutriments` setting */
  shouldShowAll?: boolean;
}

const INDENT = ["", "pl-3.5", "pl-7", "pl-10"] as const;

/** The FDA-style "Nutrition Facts" panel (cooktrace NutritionFactsBox) */
export function NutritionFactsBox({
  nutrition,
  servings,
  recipeMassG,
  servingDescription,
  servingsPerContainer,
  shouldShowAll = false,
}: NutritionFactsBoxProps) {
  const { t } = useTranslation("cooking");
  const [visible] = useSetting("ct", "visibleNutriments");
  const [energyUnit] = useSetting("ct", "energyUnit");

  const visibleIds = new Set(visibleNutrimentIds(visible));
  const rows = NUTRIMENTS.filter((nutriment) => {
    if (!shouldShowAll && !visibleIds.has(nutriment.id)) return false;
    return Number(nutrition?.[nutriment.id] ?? 0) > 0;
  });
  if (rows.length === 0) return null;

  const calories = rows.find((nutriment) => nutriment.id === "calories");
  const macros = rows.filter((nutriment) => nutriment.fdaBlock === "macros");
  const micros = rows.filter((nutriment) => nutriment.fdaBlock === "micros");

  const serving =
    servingDescription ||
    (recipeMassG
      ? `~${recipeMassG}g`
      : servings
        ? t("cookingCommon.nutritionFacts.oneOf", { total: servings })
        : t("cookingCommon.nutritionFacts.perServing"));

  const line = (nutriment: Nutriment) => {
    const value = nutrition?.[nutriment.id];
    const percent = dvPercent(nutriment, value);
    const depth = nutrimentDepth(nutriment);
    const label = t(
      `cookingCommon.nutriments.${nutriment.labelKey as "calories"}`,
    );
    const amount = formatNutrient(value, nutriment.unit);
    const isBold = nutriment.isBold && depth === 0;
    return (
      <Row
        key={nutriment.id}
        justify="between"
        gap={2}
        className={`border-b border-border py-0.5 ${INDENT[depth] ?? ""}`}
      >
        <Row gap={1.5} align="center">
          <Text as="span" variant="small">
            {nutriment.id === "added-sugars" ? (
              t("cookingCommon.nutritionFacts.includes", { amount, label })
            ) : (
              <>
                {isBold ? <strong>{label}</strong> : label} {amount}
              </>
            )}
          </Text>
          {isDerived(nutrition, nutriment.id) ? (
            <Calculator
              size={12}
              role="img"
              aria-label={t(
                nutriment.id === "sodium"
                  ? "cookingCommon.derivedFromSalt"
                  : "cookingCommon.derivedFromSodium",
              )}
            />
          ) : null}
        </Row>
        <Text as="span" variant="small">
          {percent === null ? "" : `${percent}%`}
        </Text>
      </Row>
    );
  };

  return (
    <Box
      border="all"
      radius="lg"
      padding={3}
      surface="surface"
      className="w-full max-w-sm"
      role="group"
      aria-label={t("cookingCommon.nutritionFacts.title")}
    >
      <Stack gap={1}>
        <Text variant="title" as="h3">
          {t("cookingCommon.nutritionFacts.title")}
        </Text>
        {servingsPerContainer ? (
          <Text variant="small">
            {t("cookingCommon.nutritionFacts.perContainer", {
              total: servingsPerContainer,
            })}
          </Text>
        ) : !servingDescription && servings ? (
          <Text variant="small">
            {t("cookingCommon.nutritionFacts.perRecipe", { total: servings })}
          </Text>
        ) : null}
        <Row justify="between" gap={2} className="border-b-4 border-fg pb-1">
          <Text as="span" variant="small">
            <strong>{t("cookingCommon.nutritionFacts.servingSize")}</strong>
          </Text>
          <Text as="span" variant="small">
            {serving}
          </Text>
        </Row>
        {calories ? (
          <Row justify="between" align="end" className="border-b-2 border-fg">
            <Stack gap={0}>
              <Text variant="caption">
                {t("cookingCommon.nutritionFacts.amountPerServing")}
              </Text>
              <Text variant="heading" as="span">
                {t(`cookingCommon.nutriments.${energyLabelKey(energyUnit)}`)}
              </Text>
            </Stack>
            <Text variant="title" as="span">
              {displayEnergy(nutrition?.[calories.id], energyUnit)}
              {energyUnit === "kJ" ? ` ${energyUnitSuffix(energyUnit)}` : ""}
            </Text>
          </Row>
        ) : null}
        <Text variant="caption" align="end">
          {t("cookingCommon.nutritionFacts.dailyValue")}
        </Text>
        <Stack gap={0}>{macros.map(line)}</Stack>
        {micros.length > 0 ? (
          <Stack gap={0} className="border-t-4 border-fg">
            {micros.map(line)}
          </Stack>
        ) : null}
        <Text
          variant="caption"
          tone="muted"
          className="border-t-4 border-fg pt-1"
        >
          {t("cookingCommon.nutritionFacts.footnote")}
        </Text>
      </Stack>
    </Box>
  );
}
