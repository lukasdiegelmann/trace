import {
  Button,
  DatePicker,
  Dialog,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { RecipePicker } from "../common/RecipePicker";
import { MEAL_TYPES, type MealType } from "../lib/cookDiary";
import { isoDate, shortDate } from "../lib/relativeTime";
import type { RecipeSummary } from "../manageApi";
import { MealIcon } from "./mealIcons";

/** Meal chips: one at most; a second tap clears it */
export function MealChips({
  value,
  onChange,
  label,
}: {
  value: MealType | null;
  onChange: (meal: MealType | null) => void;
  label: string;
}) {
  const { t } = useTranslation("cooking");
  return (
    <Row gap={1} shouldWrap role="group" aria-label={label}>
      {MEAL_TYPES.map((meal) => (
        <Button
          key={meal}
          size="sm"
          variant={value === meal ? "primary" : "secondary"}
          aria-pressed={value === meal}
          text={t(`diary.meals.${meal}`)}
          onClick={() => {
            onChange(value === meal ? null : meal);
          }}
        >
          <MealIcon meal={meal} />
        </Button>
      ))}
    </Row>
  );
}

export function PlanDialog({
  isBusy,
  onClose,
  onPlan,
}: {
  isBusy: boolean;
  onClose: () => void;
  onPlan: (plan: {
    recipe_id: number;
    date: string;
    meal_type: MealType | null;
  }) => void;
}) {
  const { t, i18n } = useTranslation("cooking");
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [meal, setMeal] = useState<MealType | null>(null);
  const [recipe, setRecipe] = useState<RecipeSummary | null>(null);
  return (
    <Dialog
      open
      isBusy={isBusy}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("diary.plan.title")}
      confirmText={t("diary.plan.confirm")}
      cancelText={t("cookingCommon.cancel")}
      isConfirmDisabled={!recipe || !date}
      onConfirm={() => {
        if (recipe) {
          onPlan({ recipe_id: recipe.id, date, meal_type: meal });
        }
      }}
    >
      <Stack gap={3}>
        <DatePicker
          label={t("diary.plan.date")}
          value={date || null}
          format={(value) => shortDate(value, i18n.language)}
          onChange={(value) => {
            setDate(value ?? "");
          }}
        />
        <Stack gap={1}>
          <Text variant="label">{t("diary.plan.meal")}</Text>
          <MealChips
            value={meal}
            onChange={setMeal}
            label={t("diary.plan.meal")}
          />
        </Stack>
        <RecipePicker selectedId={recipe?.id} onPick={setRecipe} />
      </Stack>
    </Dialog>
  );
}

export function RecipeFilterDialog({
  selectedId,
  onClose,
  onPick,
}: {
  selectedId: number | null;
  onClose: () => void;
  onPick: (recipe: RecipeSummary | null) => void;
}) {
  const { t } = useTranslation("cooking");
  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("diary.filterByRecipe")}
      cancelText={t("cookingCommon.done")}
    >
      <Stack gap={3}>
        {selectedId === null ? null : (
          <Button
            size="sm"
            variant="secondary"
            text={t("diary.clearRecipeFilter")}
            onClick={() => {
              onPick(null);
            }}
          />
        )}
        <RecipePicker selectedId={selectedId} onPick={onPick} />
      </Stack>
    </Dialog>
  );
}
