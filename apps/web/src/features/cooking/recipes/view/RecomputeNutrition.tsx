import { Button, Row, Stack, Text } from "@monocircuit/monolithium/components";
import { Calculator, CircleCheck, Info } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useNotify } from "../../common/useNotify";
import {
  computeRecipeNutrition,
  linkByName,
  lookupCommonDensity,
  perServing,
  type RecipeNutritionResult,
  type SkipReason,
} from "../../lib/recipeNutrition";
import {
  getPantry,
  setPantryDensity,
  type PantryRow,
  type Recipe,
} from "../../recipesApi";

interface Result extends RecipeNutritionResult {
  pantryByName: Map<string, PantryRow>;
}

export interface RecomputeNutritionProps {
  recipe: Recipe;
  /** Saves the per-serving values; absent when the user can't edit */
  onSave?: (nutrition: Record<string, number>) => Promise<void>;
}

/** The recipe's nutrition worked out from the pantry's */
export function RecomputeNutrition({
  recipe,
  onSave,
}: RecomputeNutritionProps) {
  const { t } = useTranslation("cooking");
  const notify = useNotify();
  const [result, setResult] = useState<Result | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const compute = async () => {
    setIsBusy(true);
    try {
      const rows = await getPantry();
      const byId = new Map(rows.map((row) => [row.id, row]));
      const byName = new Map(
        rows.map((row) => [row.name.toLowerCase().trim(), row]),
      );
      setResult({
        ...computeRecipeNutrition(linkByName(recipe.ingredients, rows), byId),
        pantryByName: byName,
      });
    } catch (caught) {
      notify.failure(caught, t("recipeView.recompute.failed"));
    } finally {
      setIsBusy(false);
    }
  };

  const fixDensity = async (row: PantryRow, density: number) => {
    try {
      await setPantryDensity(row.id, density);
      notify.info(
        t("recipeView.recompute.densitySet", { name: row.name, density }),
      );
      await compute();
    } catch (caught) {
      notify.failure(caught, t("recipeView.recompute.failed"));
    }
  };

  const reasonText = (reason: SkipReason, name: string) =>
    reason.code === "unitMismatch"
      ? t("recipeView.recompute.reasons.unitMismatch", {
          unit: reason.unit || "—",
          servingUnit: reason.servingUnit,
        })
      : t(`recipeView.recompute.reasons.${reason.code}`, { name });

  const save = async () => {
    if (!result || !onSave) return;
    const { used, total, nutrition } = result;
    setIsBusy(true);
    try {
      await onSave(perServing(nutrition, recipe.servings));
      setResult(null);
      notify.info(t("recipeView.recompute.saved", { used, total }));
    } catch (caught) {
      notify.failure(caught, t("recipeView.recompute.failed"));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Stack
      gap={2}
      className="rounded-container border border-border bg-level-1 p-3 print:hidden"
    >
      {result === null ? (
        <>
          <Button
            size="md"
            variant="secondary"
            text={t("recipeView.recompute.action")}
            isLoading={isBusy}
            onClick={() => void compute()}
          >
            <Calculator aria-hidden size={16} />
          </Button>
          <Text variant="caption" tone="muted">
            {t("recipeView.recompute.hint")}
          </Text>
        </>
      ) : (
        <>
          <Row gap={2} align="center">
            {result.used === result.total ? (
              <CircleCheck aria-hidden size={18} className="text-success" />
            ) : (
              <Info aria-hidden size={18} />
            )}
            <Text>
              {t("recipeView.recompute.computed", {
                count: result.total,
                used: result.used,
                total: result.total,
              })}
            </Text>
          </Row>
          <Stack gap={2} as="ul">
            {result.skipped.map((skipped, index) => {
              const row = result.pantryByName.get(
                skipped.name.toLowerCase().trim(),
              );
              const density = lookupCommonDensity(skipped.name);
              return (
                <li key={index} className="flex flex-col gap-1">
                  <Text variant="small">
                    {skipped.name}: {reasonText(skipped.reason, skipped.name)}
                  </Text>
                  {skipped.reason.code === "needsDensity" && row && density ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      text={t("recipeView.recompute.setDensity", { density })}
                      onClick={() => void fixDensity(row, density)}
                    />
                  ) : null}
                </li>
              );
            })}
          </Stack>
          <Row gap={2} justify="end">
            <Button
              size="md"
              variant="ghost"
              text={t("cookingCommon.cancel")}
              onClick={() => {
                setResult(null);
              }}
            />
            {onSave ? (
              <Button
                size="md"
                variant="primary"
                text={t("recipeView.recompute.save")}
                isLoading={isBusy}
                onClick={() => void save()}
              />
            ) : null}
          </Row>
        </>
      )}
    </Stack>
  );
}
