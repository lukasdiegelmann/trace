import { Grid, Input, Row, Text } from "@monocircuit/monolithium/components";
import { Calculator } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";

import {
  isDerived,
  nutrientValue,
  setNutrient,
  type Nutriment,
  type Nutrition,
} from "../lib/nutriments";

/** One number per nutrient; typing sodium or salt derives the other */
export function NutrientFields({
  nutriments,
  nutrition,
  onChange,
}: {
  nutriments: readonly Nutriment[];
  nutrition: Nutrition;
  onChange: (nutrition: Nutrition) => void;
}) {
  const { t } = useTranslation("cooking");
  /** The text being typed, so "0." isn't rewritten mid-way */
  const [typing, setTyping] = useState<{ id: string; text: string } | null>(
    null,
  );
  return (
    <Grid columns={2} gap={2}>
      {nutriments.map((nutriment) => {
        const label = `${t(`cookingCommon.nutriments.${nutriment.labelKey as "calories"}`)} (${nutriment.unit})`;
        const stored = nutrientValue(nutrition, nutriment.id);
        return (
          <Row key={nutriment.id} gap={1} align="end">
            <Input
              label={label}
              inputMode="decimal"
              wrapperClassName="min-w-0 flex-1"
              value={
                typing?.id === nutriment.id
                  ? typing.text
                  : stored === undefined
                    ? ""
                    : String(stored)
              }
              onChange={(event) => {
                const text = event.target.value.replace(",", ".");
                if (!/^\d*\.?\d*$/.test(text)) return;
                setTyping({ id: nutriment.id, text });
                onChange(
                  setNutrient(
                    nutrition,
                    nutriment.id,
                    text === "." ? "" : text,
                  ),
                );
              }}
              onBlur={() => {
                setTyping(null);
              }}
            />
            {isDerived(nutrition, nutriment.id) ? (
              <Text as="span" tone="muted">
                <Calculator
                  size={14}
                  role="img"
                  aria-label={t(
                    nutriment.id === "sodium"
                      ? "cookingCommon.derivedFromSalt"
                      : "cookingCommon.derivedFromSodium",
                  )}
                />
              </Text>
            ) : null}
          </Row>
        );
      })}
    </Grid>
  );
}
