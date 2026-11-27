import { Box, Row, Stack, Text } from "@monocircuit/monolithium/components";
import { Calculator } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { NutritionMap } from "../api";
import { nutritionFacts, type NutritionFactRow } from "../lib/nutritionFacts";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";

/** The Nutrition Facts label of one serving (NutritionFactsBox.svelte) */
export function NutritionFactsBox({
  nutrition,
  serving,
}: {
  nutrition: NutritionMap;
  /** "100 g"; null reads "per serving" */
  serving: string | null;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const facts = nutritionFacts(
    nutrition,
    settings.visibleNutriments,
    format.energyUnit,
  );

  const row = (fact: NutritionFactRow) => (
    <Row
      key={fact.id}
      gap={2}
      justify="between"
      align="center"
      paddingY={1}
      border="top"
    >
      <div style={{ paddingLeft: `${fact.depth}rem` }}>
        <Row gap={1} align="center">
          <Text variant={fact.isBold ? "body" : "small"}>
            {fact.id === "added-sugars"
              ? t("facts.includesAddedSugars")
              : t(`nutrients.${fact.id as "calories"}`)}{" "}
            {format.number(Number(fact.text), 1)} {fact.unit}
          </Text>
          {fact.isDerived && (
            <span role="img" aria-label={t("facts.derived")}>
              <Calculator aria-hidden size={12} />
            </span>
          )}
        </Row>
      </div>
      {fact.dvPercent !== null && (
        <Text variant="small">{`${fact.dvPercent}%`}</Text>
      )}
    </Row>
  );

  return (
    <section aria-label={t("facts.title")}>
      <Box border="all" radius="lg" padding={3}>
        <Stack gap={1}>
          <Text variant="heading" as="h3">
            {t("facts.title")}
          </Text>
          <Text variant="small">
            {t("facts.servingSize", {
              serving: serving ?? t("facts.perServing"),
            })}
          </Text>
          {facts.isEmpty ? (
            <Text tone="muted">{t("facts.empty")}</Text>
          ) : (
            <>
              {facts.energy !== null && (
                <Row justify="between" align="end" border="top" paddingY={1}>
                  <Text variant="heading">
                    {t(
                      format.energyUnit === "kJ"
                        ? "facts.energy"
                        : "facts.calories",
                    )}
                  </Text>
                  <Text variant="title" as="span">
                    {format.number(facts.energy, 0)}
                  </Text>
                </Row>
              )}
              <Row justify="end">
                <Text variant="caption" title={t("facts.dvHint")}>
                  {t("facts.dv")}
                </Text>
              </Row>
              {facts.macros.map(row)}
              {facts.vitaminsAndMinerals.length > 0 && (
                <Stack gap={0}>
                  <Text variant="label">{t("facts.vitamins")}</Text>
                  {facts.vitaminsAndMinerals.map(row)}
                </Stack>
              )}
            </>
          )}
        </Stack>
      </Box>
    </section>
  );
}
