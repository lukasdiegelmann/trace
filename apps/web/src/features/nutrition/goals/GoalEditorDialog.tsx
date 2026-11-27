import {
  Button,
  Checkbox,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AppDialog } from "../components/AppDialog";
import { DecimalField } from "../components/DecimalField";
import { useConfirm } from "../components/confirm";
import { useNotify } from "../components/useNotify";
import {
  goalEntryOf,
  goalFormOf,
  goalStorageId,
  isWellnessGoal,
  removeGoal,
  saveGoal,
  togglePercent,
  type GoalForm,
} from "../lib/goals";
import { MACRO_DENSITY } from "../lib/nutrition";
import { useNtSettings } from "../settings";
import { useGoalStats } from "./useGoalStats";

function Toggle({
  label,
  hint,
  isChecked,
  onChange,
}: {
  label: string;
  hint?: string;
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
}) {
  return (
    <Stack gap={0}>
      <Checkbox checked={isChecked} onChange={onChange} label={label} />
      {hint && <Text variant="caption">{hint}</Text>}
    </Stack>
  );
}

/** Weekday names, Sunday first, in the UI language */
function weekdayNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: "long" });
  // 2026-09-06 is a Sunday
  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(2026, 8, 6 + index)),
  );
}

export function GoalEditorDialog({
  statId,
  calGoalKcal,
  onClose,
}: {
  statId: string;
  /** The day's calorie goal, the basis of percent targets */
  calGoalKcal: number;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("nutrition");
  const { settings, set } = useNtSettings();
  const confirm = useConfirm();
  const notify = useNotify();
  const stats = useGoalStats();
  const entry = settings.goals[goalStorageId(statId)];
  const [form, setForm] = useState(() =>
    goalFormOf(entry, statId, settings.energyUnit),
  );
  const change = (changes: Partial<GoalForm>) => {
    setForm((current) => ({ ...current, ...changes }));
  };
  const name = stats.name(statId);
  const unit = form.isPercent
    ? t("goals.editor.percentUnit")
    : stats.unit(statId);

  const save = () => {
    set(
      "goals",
      saveGoal(
        settings.goals,
        statId,
        goalEntryOf(form, statId, settings.energyUnit),
      ),
    );
    notify.success(t("goals.toast.saved"));
    onClose();
  };
  const remove = async () => {
    const isConfirmed = await confirm({
      title: t("goals.editor.removeTitle", { name }),
      confirmText: t("common.remove"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    set("goals", removeGoal(settings.goals, statId));
    onClose();
  };

  return (
    <AppDialog
      title={t("goals.editor.title", { name, unit: stats.unit(statId) })}
      onClose={onClose}
      confirmText={t("goals.editor.save")}
      onConfirm={save}
    >
      <Stack gap={4}>
        {!isWellnessGoal(statId) && (
          <Stack gap={2}>
            <Text variant="label">{t("goals.editor.display")}</Text>
            <Toggle
              label={t("goals.editor.showDiary")}
              isChecked={form.isShownInDiary}
              onChange={(isShownInDiary) => {
                change({ isShownInDiary });
              }}
            />
            <Toggle
              label={t("goals.editor.showStats")}
              isChecked={form.isShownInStats}
              onChange={(isShownInStats) => {
                change({ isShownInStats });
              }}
            />
          </Stack>
        )}
        <Stack gap={2}>
          <Text variant="label">{t("goals.editor.behavior")}</Text>
          <Toggle
            label={t("goals.editor.sameEveryDay")}
            hint={t(
              form.isShared
                ? "goals.editor.oneTarget"
                : "goals.editor.perWeekday",
            )}
            isChecked={form.isShared}
            onChange={(isShared) => {
              change({ isShared });
            }}
          />
          <Toggle
            label={t("goals.editor.minimum")}
            hint={t(
              form.isMin ? "goals.editor.minTrue" : "goals.editor.minFalse",
            )}
            isChecked={form.isMin}
            onChange={(isMin) => {
              change({ isMin });
            }}
          />
          {statId in MACRO_DENSITY && (
            <Toggle
              label={t("goals.editor.percent")}
              hint={t("goals.editor.percentHint")}
              isChecked={form.isPercent}
              onChange={(isPercent) => {
                setForm((current) =>
                  togglePercent(current, isPercent, statId, calGoalKcal),
                );
              }}
            />
          )}
          <Toggle
            label={t("goals.editor.autoAdjust")}
            hint={t("goals.editor.autoAdjustHint")}
            isChecked={form.isAutoAdjust}
            onChange={(isAutoAdjust) => {
              change({ isAutoAdjust });
            }}
          />
        </Stack>
        {form.isShared ? (
          <DecimalField
            label={t("goals.editor.value", { unit })}
            value={form.value}
            onChange={(value) => {
              change({ value });
            }}
            onEnter={save}
            hasAutoFocus
          />
        ) : (
          <Stack gap={2}>
            {weekdayNames(i18n.language).map((day, index) => (
              <DecimalField
                key={day}
                label={t("goals.editor.valueDay", { day, unit })}
                value={form.days[index]}
                onChange={(value) => {
                  change({
                    days: form.days.map((v, i) => (i === index ? value : v)),
                  });
                }}
                onEnter={save}
                hasAutoFocus={index === 0}
              />
            ))}
          </Stack>
        )}
        {entry && (
          <Button
            variant="danger"
            size="md"
            text={t("goals.editor.remove")}
            onClick={() => void remove()}
          >
            <Trash2 aria-hidden size={14} />
          </Button>
        )}
      </Stack>
    </AppDialog>
  );
}
