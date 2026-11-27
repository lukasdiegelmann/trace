import {
  ActionList,
  DatePicker,
  InplaceMultiSelect,
  Input,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AppDialog } from "../components/AppDialog";
import { localDateStr } from "../lib/dates";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";

/** Picks the meal an entry (or a whole meal) moves to */
export function MoveDialog({
  title,
  onPick,
  onClose,
}: {
  title: string;
  onPick: (meal: number) => void;
  onClose: () => void;
}) {
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  return (
    <AppDialog title={title} onClose={onClose}>
      <ActionList
        label={title}
        items={settings.mealNames.map((name, index) => ({
          id: String(index),
          text: format.mealName(name),
          onSelect: () => {
            onPick(index);
            onClose();
          },
        }))}
      />
    </AppDialog>
  );
}

export interface CopyDialogProps {
  /** What is copied: an entry's or a meal's name */
  name: string;
  meal: number;
  /** Prefilled when a meal was dropped on a day */
  date?: string;
  onCopy: (date: string, meal: number) => Promise<void>;
  onClose: () => void;
}

export function CopyDialog({
  name,
  meal,
  date,
  onCopy,
  onClose,
}: CopyDialogProps) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const [target, setTarget] = useState<string | null>(date ?? localDateStr());
  const [slot, setSlot] = useState(String(meal));
  const [isBusy, setIsBusy] = useState(false);

  return (
    <AppDialog
      title={t("diary.copy.title", { name })}
      onClose={onClose}
      confirmText={t("diary.copy.confirm")}
      isConfirmDisabled={!target}
      isBusy={isBusy}
      onConfirm={async () => {
        if (!target || isBusy) return;
        setIsBusy(true);
        await onCopy(target, Number(slot));
        onClose();
      }}
    >
      <Stack gap={3}>
        <DatePicker
          label={t("diary.copy.date")}
          value={target}
          onChange={setTarget}
          format={format.date}
        />
        <InplaceMultiSelect
          formField
          isFullWidth
          label={t("diary.copy.meal")}
          value={slot}
          onChange={setSlot}
          options={settings.mealNames.map((mealName, index) => ({
            value: String(index),
            label: format.mealName(mealName),
          }))}
        />
      </Stack>
    </AppDialog>
  );
}

export function SaveMealDialog({
  suggestion,
  count,
  onSave,
  onClose,
}: {
  suggestion: string;
  count: number;
  onSave: (name: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const [name, setName] = useState(suggestion);
  const [isBusy, setIsBusy] = useState(false);
  const save = async () => {
    if (!name.trim() || isBusy) return;
    setIsBusy(true);
    if (await onSave(name.trim())) onClose();
    else setIsBusy(false);
  };
  return (
    <AppDialog
      title={t("diary.saveMeal.title")}
      onClose={onClose}
      isConfirmDisabled={!name.trim()}
      isBusy={isBusy}
      onConfirm={save}
    >
      <Stack gap={3}>
        <Input
          label={t("diary.saveMeal.name")}
          value={name}
          onValueChange={setName}
          onEnter={() => void save()}
          autoFocus
          fieldSize="lg"
        />
        <Text variant="caption">{t("diary.saveMeal.count", { count })}</Text>
      </Stack>
    </AppDialog>
  );
}
