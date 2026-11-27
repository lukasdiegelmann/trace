import { Button, Stack } from "@monocircuit/monolithium/components";
import { Calculator } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DecimalField } from "../components/DecimalField";
import {
  caloriesInputValue,
  setCaloriesInput,
  setFoodNutrient,
  type FoodFormState,
} from "../lib/foodForm";
import { nutrientFields } from "../lib/nutrientFields";
import { useNtSettings } from "../settings";

/** Every nutrient field of a serving; energy in the user's unit */
export function NutrientInputs({
  form,
  onChange,
}: {
  form: FoodFormState;
  onChange: (next: (form: FoodFormState) => FoodFormState) => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const [isShowingAll, setIsShowingAll] = useState(false);
  // While typed in kJ, the text stays as typed instead of a round trip
  const [typedKj, setTypedKj] = useState<string | null>(null);
  const isKj = settings.energyUnit === "kJ";

  return (
    <Stack gap={2}>
      <div className="grid grid-cols-2 gap-3 compact:grid-cols-1">
        {nutrientFields(settings, isShowingAll).map((field) => {
          const isEnergy = field.id === "calories";
          const name = field.label ?? t(`nutrients.${field.id as "calories"}`);
          const isDerived =
            (field.id === "salt" && Boolean(form.derived.salt)) ||
            (field.id === "sodium" && Boolean(form.derived.sodium));
          const label =
            isEnergy && isKj
              ? t("foodEditor.energyKj")
              : t("foodEditor.field", { name, unit: field.unit });
          return (
            <div
              key={field.id}
              className={field.subOf ? "pl-4" : undefined}
              onBlur={
                isEnergy
                  ? () => {
                      setTypedKj(null);
                    }
                  : undefined
              }
            >
              <div className="flex items-end gap-1">
                <div className="min-w-0 flex-1">
                  <DecimalField
                    label={label}
                    placeholder="0"
                    value={
                      isEnergy
                        ? (typedKj ??
                          caloriesInputValue(form, settings.energyUnit))
                        : (form.nutrients[field.id] ?? "")
                    }
                    onChange={(text) => {
                      if (isEnergy && isKj) setTypedKj(text);
                      onChange((current) =>
                        isEnergy
                          ? setCaloriesInput(current, text, settings.energyUnit)
                          : setFoodNutrient(current, field.id, text),
                      );
                    }}
                  />
                </div>
                {isDerived && (
                  <span
                    role="img"
                    aria-label={t("facts.derived")}
                    title={t("facts.derived")}
                  >
                    <Calculator aria-hidden size={14} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Button
        size="sm"
        text={t(isShowingAll ? "foodEditor.showLess" : "foodEditor.showAll")}
        aria-expanded={isShowingAll}
        onClick={() => {
          setIsShowingAll(!isShowingAll);
        }}
      />
    </Stack>
  );
}
