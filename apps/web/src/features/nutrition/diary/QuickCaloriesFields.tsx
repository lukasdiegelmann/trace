import { Input, Stack, Text } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { DecimalField } from "../components/DecimalField";
import { useNutritionFormat } from "../useNutritionFormat";
import type { QuickForm } from "./quickForm";

export interface QuickCaloriesFieldsProps {
  form: QuickForm;
  onChange: (form: QuickForm) => void;
  onEnter: () => void;
  hasEnergyFocus?: boolean;
}

/** The fields of a quick entry, shared by adding and editing one */
export function QuickCaloriesFields({
  form,
  onChange,
  onEnter,
  hasEnergyFocus,
}: QuickCaloriesFieldsProps) {
  const { t } = useTranslation("nutrition");
  const format = useNutritionFormat();
  const set = (key: keyof QuickForm) => (value: string) => {
    onChange({ ...form, [key]: value });
  };

  return (
    <Stack gap={3}>
      <Text variant="caption">{t("diary.quick.help")}</Text>
      <Input
        label={t("diary.quick.name")}
        value={form.name}
        onValueChange={set("name")}
        onEnter={onEnter}
        maxLength={60}
        fieldSize="lg"
      />
      <DecimalField
        label={t("diary.quick.energy", { unit: format.energyUnit })}
        value={form.energy}
        onChange={set("energy")}
        onEnter={onEnter}
        hasAutoFocus={hasEnergyFocus}
      />
      <div className="grid grid-cols-3 gap-2 compact:grid-cols-1">
        {(
          [
            ["proteins", "protein"],
            ["carbohydrates", "carbs"],
            ["fat", "fat"],
          ] as const
        ).map(([key, macro]) => (
          <DecimalField
            key={key}
            label={t("diary.quick.macro", { macro: t(`macros.${macro}`) })}
            value={form[key]}
            onChange={set(key)}
            onEnter={onEnter}
          />
        ))}
      </div>
    </Stack>
  );
}
