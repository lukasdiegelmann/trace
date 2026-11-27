import {
  Box,
  Button,
  Chip,
  EmptyState,
  Input,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AppDialog } from "../components/AppDialog";
import { useConfirm } from "../components/confirm";
import { useNotify } from "../components/useNotify";
import { migrateKilojoulesGoal, templateGoalCount } from "../lib/goals";
import { useNtSettings, type GoalTemplate } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";

/** Saved sets of goals: save the current ones, apply or delete a set */
export function Templates({ onApplied }: { onApplied: () => void }) {
  const { t } = useTranslation("nutrition");
  const { settings, set } = useNtSettings();
  const format = useNutritionFormat();
  const confirm = useConfirm();
  const notify = useNotify();
  const [name, setName] = useState<string | null>(null);
  const count = templateGoalCount(settings.goals, settings.waterGoalMl);

  const save = () => {
    const trimmed = name?.trim();
    if (!trimmed) return;
    set("goalTemplates", [
      ...settings.goalTemplates,
      {
        id: Date.now(),
        name: trimmed,
        createdAt: new Date().toISOString(),
        goals: { ...settings.goals },
        waterGoalMl: settings.waterGoalMl,
        goalCount: count,
      },
    ]);
    setName(null);
    notify.success(t("goals.templates.saved"));
  };

  const countOf = (template: GoalTemplate) =>
    template.goalCount ??
    templateGoalCount(template.goals, template.waterGoalMl ?? 0);

  const apply = async (template: GoalTemplate) => {
    const isConfirmed = await confirm({
      title: t("goals.templates.applyTitle"),
      description: t("goals.templates.applyText", {
        name: template.name,
        count: countOf(template),
      }),
      confirmText: t("goals.templates.apply"),
    });
    if (!isConfirmed) return;
    set("goals", migrateKilojoulesGoal({ ...template.goals }));
    if (template.waterGoalMl != null) {
      set("waterGoalMl", template.waterGoalMl);
    }
    notify.success(t("goals.templates.applied", { name: template.name }));
    onApplied();
  };

  const chips = (template: GoalTemplate) => {
    const out: string[] = [];
    const energy = template.goals.calories;
    const kcal = energy?.max ?? energy?.min;
    if (kcal != null) out.push(format.energy(kcal));
    for (const [id, short] of [
      ["proteins", t("macros.proteinShort")],
      ["carbohydrates", t("macros.carbsShort")],
      ["fat", t("macros.fatShort")],
    ] as const) {
      const goal = template.goals[id];
      const value = goal?.max ?? goal?.min;
      if (value != null) {
        out.push(
          `${short} ${format.number(value)}${goal?.isPercent ? "%" : " g"}`,
        );
      }
    }
    return out;
  };

  return (
    <Stack gap={3}>
      <Text variant="small" tone="muted">
        {t("goals.templates.intro")}
      </Text>
      <Button
        variant="primary"
        size="md"
        text={t("goals.templates.save")}
        onClick={() => {
          setName("");
        }}
      />
      {settings.goalTemplates.length === 0 && (
        <EmptyState text={t("goals.templates.empty")} />
      )}
      {settings.goalTemplates.map((template) => (
        <Box
          key={template.id}
          surface="surface"
          border="all"
          radius="lg"
          padding={3}
        >
          <Stack gap={2}>
            <Row gap={2} align="center" justify="between">
              <Stack gap={0} shouldGrow>
                <Text variant="heading" as="h3" isTruncated>
                  {template.name}
                </Text>
                <Text variant="caption">
                  {`${new Date(template.createdAt).toLocaleDateString(format.locale, { year: "numeric", month: "short", day: "numeric" })} · ${t("goals.templates.count", { count: countOf(template) })}`}
                </Text>
              </Stack>
              <Button
                size="sm"
                variant="secondary"
                text={t("goals.templates.apply")}
                onClick={() => void apply(template)}
              />
              <Button
                size="sm"
                aria-label={t("goals.templates.delete", {
                  name: template.name,
                })}
                onClick={() => {
                  set(
                    "goalTemplates",
                    settings.goalTemplates.filter(
                      (item) => item.id !== template.id,
                    ),
                  );
                }}
              >
                <Trash2 aria-hidden size={16} />
              </Button>
            </Row>
            <Row gap={1} shouldWrap>
              {chips(template).map((text) => (
                <Chip key={text} text={text} />
              ))}
            </Row>
          </Stack>
        </Box>
      ))}
      {name !== null && (
        <AppDialog
          title={t("goals.templates.saveTitle")}
          onClose={() => {
            setName(null);
          }}
          confirmText={t("goals.templates.saveTitle")}
          isConfirmDisabled={!name.trim()}
          onConfirm={save}
        >
          <Stack gap={2}>
            <Input
              label={t("goals.templates.name")}
              placeholder={t("goals.templates.placeholder")}
              value={name}
              onValueChange={setName}
              onEnter={save}
              autoFocus
              fieldSize="lg"
            />
            <Text variant="caption">
              {t("goals.templates.snapshot", { count })}
            </Text>
          </Stack>
        </AppDialog>
      )}
    </Stack>
  );
}
