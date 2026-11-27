import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AppDialog } from "../components/AppDialog";
import type { QuickCaloriesInput } from "../lib/diary";
import { useNutritionFormat } from "../useNutritionFormat";
import { QuickCaloriesFields } from "./QuickCaloriesFields";
import { EMPTY_QUICK_FORM, quickInputOf } from "./quickForm";

export function QuickAddDialog({
  meal,
  onAdd,
  onClose,
}: {
  meal: string;
  onAdd: (input: QuickCaloriesInput) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const format = useNutritionFormat();
  const [form, setForm] = useState(EMPTY_QUICK_FORM);
  const input = quickInputOf(form, format.energyUnit);

  const add = () => {
    if (!input) return;
    onAdd(input);
    onClose();
  };

  return (
    <AppDialog
      onClose={onClose}
      title={t("diary.quick.title", { meal })}
      confirmText={t("common.add")}
      isConfirmDisabled={!input}
      onConfirm={add}
    >
      <QuickCaloriesFields
        form={form}
        onChange={setForm}
        onEnter={add}
        hasEnergyFocus
      />
    </AppDialog>
  );
}
