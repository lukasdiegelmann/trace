import { Input, Row, Stack, Text } from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { DiaryItem } from "../api";
import { AppDialog } from "../components/AppDialog";
import { DecimalField } from "../components/DecimalField";
import { MacroStats } from "../components/Macros";
import { UnitPicker } from "../components/UnitPicker";
import { useNotify } from "../components/useNotify";
import { parseDecimal, parsePositive, toInputValue } from "../lib/decimal";
import {
  portionChanges,
  quickCaloriesValues,
  timeOfDay,
  withTimeOfDay,
} from "../lib/diary";
import { calculate, round1 } from "../lib/nutrition";
import { amountAndUnit, parseAltUnits } from "../lib/units";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { itemName } from "./itemText";
import { QuickCaloriesFields } from "./QuickCaloriesFields";
import { quickFormOf, quickInputOf } from "./quickForm";

export interface EditItemDialogProps {
  item: DiaryItem;
  /** An ingredient of a split recipe has no logged time of its own */
  isIngredient?: boolean;
  onSave: (changes: Partial<DiaryItem>) => void;
  onClose: () => void;
}

export function EditItemDialog(props: EditItemDialogProps) {
  return props.item.type === "quick_calories" ? (
    <EditQuickDialog {...props} />
  ) : (
    <EditFoodDialog {...props} />
  );
}

/** The new `addedAt`, only when the time field was changed */
function timeChange(item: DiaryItem, time: string): Partial<DiaryItem> {
  if (!time || time === timeOfDay(item.addedAt)) return {};
  return { addedAt: withTimeOfDay(item.addedAt, time) };
}

function TimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation("nutrition");
  // TODO(monolithium): a time picker; Input's native time type until then
  return (
    <Input
      type="time"
      label={t("diary.edit.time")}
      value={value}
      onValueChange={onChange}
      fieldSize="lg"
    />
  );
}

function EditFoodDialog({
  item,
  isIngredient,
  onSave,
  onClose,
}: EditItemDialogProps) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const [portion, setPortion] = useState(toInputValue(item.portion ?? 100));
  const [unit, setUnit] = useState(item.unit || "g");
  const [quantity, setQuantity] = useState(toInputValue(item.quantity ?? 1));
  const [time, setTime] = useState(timeOfDay(item.addedAt));

  const edit = {
    portion: parsePositive(portion) ?? item.portion ?? 100,
    unit,
    quantity: parsePositive(quantity) ?? 1,
  };
  const changes = portionChanges(item, edit);
  const preview = calculate(changes);
  const save = () => {
    onSave({
      ...changes,
      ...(isIngredient ? {} : timeChange(item, time)),
    });
    onClose();
  };
  const shouldFocusPortion = settings.diaryDefaultField === "portion";

  return (
    <AppDialog onClose={onClose} title={itemName(item, t)} onConfirm={save}>
      <Stack gap={3}>
        <Row gap={2} align="end">
          <div className="min-w-0 flex-1">
            <DecimalField
              key={`portion-${shouldFocusPortion}`}
              label={t("diary.edit.portion")}
              value={portion}
              onChange={setPortion}
              onEnter={save}
              hasAutoFocus={shouldFocusPortion}
            />
          </div>
          <UnitPicker
            value={unit}
            onChange={setUnit}
            extraUnits={parseAltUnits(item.alt_units)}
          />
        </Row>
        <DecimalField
          label={t("diary.edit.servings")}
          value={quantity}
          onChange={setQuantity}
          onEnter={save}
          hasAutoFocus={!shouldFocusPortion}
        />
        {settings.diaryShowTimestamps && !isIngredient && (
          <TimeField value={time} onChange={setTime} />
        )}
        <Text variant="small" tone="muted">
          {t("diary.edit.total", {
            amount: amountAndUnit(round1(edit.portion * edit.quantity), unit),
          })}
        </Text>
        <MacroStats
          kcal={preview.calories || 0}
          grams={{
            protein: round1(preview.proteins || 0),
            carbs: round1(preview.carbohydrates || 0),
            fat: round1(preview.fat || 0),
          }}
        />
      </Stack>
    </AppDialog>
  );
}

function EditQuickDialog({
  item,
  isIngredient,
  onSave,
  onClose,
}: EditItemDialogProps) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const notify = useNotify();
  const [initial] = useState(() => quickFormOf(item, format.energyUnit));
  const [form, setForm] = useState(initial);
  const [time, setTime] = useState(timeOfDay(item.addedAt));

  const save = () => {
    const input = quickInputOf(form, format.energyUnit);
    if (!input) {
      notify.error(t("diary.quick.invalid", { unit: format.energyUnit }));
      return;
    }
    const values = quickCaloriesValues(input);
    // kJ round-trips lose calories: keep the stored value if it wasn't touched
    if (
      !Number.isNaN(parseDecimal(form.energy)) &&
      form.energy === initial.energy
    ) {
      values.nutrition.calories = item.nutrition.calories ?? 0;
    }
    onSave({
      ...values,
      ...(isIngredient ? {} : timeChange(item, time)),
    });
    onClose();
  };

  return (
    <AppDialog onClose={onClose} title={itemName(item, t)} onConfirm={save}>
      <Stack gap={3}>
        <QuickCaloriesFields
          form={form}
          onChange={setForm}
          onEnter={save}
          hasEnergyFocus
        />
        {settings.diaryShowTimestamps && (
          <TimeField value={time} onChange={setTime} />
        )}
      </Stack>
    </AppDialog>
  );
}
