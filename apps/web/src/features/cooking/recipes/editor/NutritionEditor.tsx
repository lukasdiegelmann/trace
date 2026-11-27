import {
  Button,
  Disclosure,
  Input,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Calculator } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSetting } from "@/features/shared/settings";

import { useConfirm } from "../../common/useConfirm";
import { NUTRIMENTS, visibleNutrimentIds } from "../../lib/nutriments";
import type { DraftGroup } from "../../lib/recipeEditor";
import {
  computeRecipeNutrition,
  linkByName,
  perServing,
} from "../../lib/recipeNutrition";
import { getPantry } from "../../recipesApi";

export interface NutritionEditorProps {
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  groups: DraftGroup[];
  servings: string;
}

/** Nutrition per serving: typed, or worked out from the pantry */
export function NutritionEditor({
  values,
  onChange,
  groups,
  servings,
}: NutritionEditorProps) {
  const { t } = useTranslation("cooking");
  const [visible] = useSetting("ct", "visibleNutriments");
  const { confirm, dialog } = useConfirm();
  const [status, setStatus] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const ids = new Set(visibleNutrimentIds(visible));

  const calculate = async () => {
    setIsBusy(true);
    setStatus(t("recipeEditor.nutrition.loading"));
    try {
      const rows = await getPantry();
      const result = computeRecipeNutrition(
        linkByName(groups, rows),
        new Map(rows.map((row) => [row.id, row])),
      );
      if (result.used === 0) {
        setStatus(t("recipeEditor.nutrition.noData"));
      } else {
        const hasTyped = Object.values(values).some(
          (value) => Number(value) > 0,
        );
        const isConfirmed =
          !hasTyped ||
          (await confirm({
            title: t("recipeEditor.nutrition.replaceTitle"),
            message: t("recipeEditor.nutrition.replaceMessage"),
            confirmText: t("recipeEditor.nutrition.replace"),
          }));
        if (!isConfirmed) {
          setStatus("");
        } else {
          const computed = perServing(result.nutrition, Number(servings));
          onChange(
            Object.fromEntries(
              Object.entries(computed).map(([key, value]) => [
                key,
                String(value),
              ]),
            ),
          );
          const skipped = result.total - result.used;
          setStatus(
            skipped === 0
              ? t("recipeEditor.nutrition.computedAll", {
                  count: result.total,
                })
              : t("recipeEditor.nutrition.computedSome", {
                  used: result.used,
                  total: result.total,
                  skipped,
                }),
          );
        }
      }
    } catch (caught) {
      setStatus(
        t("recipeEditor.nutrition.failed", {
          message: caught instanceof Error ? caught.message : "",
        }),
      );
    }
    setIsBusy(false);
  };

  return (
    <Disclosure
      title={t("recipeEditor.nutrition.title")}
      defaultOpen={Object.values(values).some(Boolean)}
    >
      <Stack gap={3} paddingTop={2}>
        <Text variant="caption" tone="muted">
          {t("recipeEditor.nutrition.hint")}
        </Text>
        <Button
          className="self-start"
          variant="secondary"
          size="sm"
          text={t("recipeEditor.nutrition.calculate")}
          isLoading={isBusy}
          onClick={() => void calculate()}
        >
          <Calculator aria-hidden size={14} />
        </Button>
        {status ? (
          <Text variant="small" role="status">
            {status}
          </Text>
        ) : null}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
          {NUTRIMENTS.filter((nutriment) => ids.has(nutriment.id)).map(
            (nutriment) => (
              <Input
                key={nutriment.id}
                type="number"
                min={0}
                step="any"
                label={`${t(`cookingCommon.nutriments.${nutriment.labelKey as "calories"}`)} (${nutriment.unit})`}
                value={values[nutriment.id] ?? ""}
                onValueChange={(value) => {
                  onChange({ ...values, [nutriment.id]: value });
                }}
              />
            ),
          )}
        </div>
      </Stack>
      {dialog}
    </Disclosure>
  );
}
