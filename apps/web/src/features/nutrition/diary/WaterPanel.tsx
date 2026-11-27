import {
  Button,
  Input,
  Meter,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { DiaryDay, WaterLog } from "../api";
import { DecimalField } from "../components/DecimalField";
import { parsePositive } from "../lib/decimal";
import {
  addWater,
  newUuid,
  removeWater,
  updateWater,
  waterTotal,
  type DiaryMutation,
} from "../lib/diary";
import { displayToMl, mlToDisplay, waterUnitLabel } from "../lib/water";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";

/** When the old UI had no containers set up */
const FALLBACK_VOLUMES = [250, 500, 1000];

export interface WaterPanelProps {
  day: DiaryDay;
  mutate: (mutation: DiaryMutation) => Promise<unknown>;
}

/** Water of one day: progress, quick adds, a custom amount and the log */
export function WaterPanel({ day, mutate }: WaterPanelProps) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const unit = settings.waterUnit;
  const [custom, setCustom] = useState("");
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const total = waterTotal(day.water);
  const goal = settings.waterGoalMl;
  const percent = goal > 0 ? Math.round((total / goal) * 100) : 0;
  const show = (ml: number) => format.number(mlToDisplay(ml, unit), 3);
  const withUnit = (ml: number) => `${show(ml)} ${waterUnitLabel(unit)}`;

  const add = (ml: number) =>
    void mutate(
      addWater({
        uuid: newUuid(),
        amount: ml,
        time: format.time(new Date()),
      }),
    );
  const addCustom = () => {
    const value = parsePositive(custom);
    if (value === null) return;
    add(displayToMl(value, unit));
    setCustom("");
    setIsCustomOpen(false);
  };

  const containers =
    settings.waterContainers.length > 0
      ? settings.waterContainers.map((container) => ({
          id: container.id,
          label: `${container.name} · ${withUnit(container.volumeMl)}`,
          ml: container.volumeMl,
        }))
      : FALLBACK_VOLUMES.map((ml) => ({
          id: String(ml),
          label: `+ ${withUnit(ml)}`,
          ml,
        }));

  return (
    <Stack gap={4}>
      {/* TODO(monolithium): upstream draws a bottle that fills; Meter until then */}
      <Meter
        label={t("diary.water.progress", {
          total: show(total),
          goal: show(goal),
          unit: waterUnitLabel(unit),
        })}
        value={Math.min(total, goal)}
        max={Math.max(1, goal)}
        valueText={t("diary.water.percent", { percent })}
        hint={percent >= 100 ? t("diary.water.reached") : undefined}
        size="lg"
      />

      <Stack gap={2}>
        <Text variant="label">{t("diary.water.quickAdd")}</Text>
        <Row gap={2} shouldWrap>
          {containers.map((container) => (
            <Button
              key={container.id}
              variant="secondary"
              size="md"
              text={container.label}
              onClick={() => {
                add(container.ml);
              }}
            />
          ))}
          <Button
            size="md"
            text={t("diary.water.custom")}
            aria-expanded={isCustomOpen}
            onClick={() => {
              setCustom("");
              setIsCustomOpen(!isCustomOpen);
            }}
          />
        </Row>
        {isCustomOpen && (
          <Row gap={2} align="end">
            <div className="min-w-0 flex-1">
              <DecimalField
                label={t("diary.water.amount", { unit: waterUnitLabel(unit) })}
                value={custom}
                onChange={setCustom}
                onEnter={addCustom}
                hasAutoFocus
              />
            </div>
            <Button
              variant="primary"
              size="lg"
              text={t("common.add")}
              onClick={addCustom}
            />
          </Row>
        )}
      </Stack>

      <Stack gap={1}>
        <Text variant="label">{t("diary.water.log")}</Text>
        {day.water.length === 0 && (
          <Text variant="small" tone="muted">
            {t("diary.water.empty")}
          </Text>
        )}
        {day.water.map((entry) => (
          <WaterRow
            key={entry.uuid}
            entry={entry}
            label={withUnit(entry.amount)}
            initial={String(mlToDisplay(entry.amount, unit))}
            onSave={(value) =>
              void mutate(updateWater(entry.uuid, displayToMl(value, unit)))
            }
            onRemove={() => void mutate(removeWater(entry.uuid))}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function WaterRow({
  entry,
  label,
  initial,
  onSave,
  onRemove,
}: {
  entry: WaterLog;
  label: string;
  initial: string;
  onSave: (value: number) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const value = parsePositive(draft);
    if (value !== null && draft !== initial) onSave(value);
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <Row gap={2} align="center">
        <div className="min-w-0 flex-1">
          <Input
            aria-label={t("diary.water.edit", { amount: label })}
            inputMode="decimal"
            value={draft}
            onValueChange={setDraft}
            onEnter={commit}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              setDraft(null);
            }}
            autoFocus
            fieldSize="md"
          />
        </div>
        <Button size="sm" aria-label={t("common.save")} onClick={commit}>
          <Check aria-hidden size={16} />
        </Button>
        <Button
          size="sm"
          aria-label={t("common.cancel")}
          onClick={() => {
            setDraft(null);
          }}
        >
          <X aria-hidden size={16} />
        </Button>
      </Row>
    );
  }

  return (
    <Row gap={2} align="center" justify="between">
      <Text>{label}</Text>
      <Row gap={1} align="center">
        <Text variant="caption">{entry.time}</Text>
        <Button
          size="sm"
          aria-label={t("diary.water.edit", { amount: label })}
          onClick={() => {
            setDraft(initial);
          }}
        >
          <Pencil aria-hidden size={16} />
        </Button>
        <Button
          size="sm"
          aria-label={t("diary.water.remove", { amount: label })}
          onClick={onRemove}
        >
          <Trash2 aria-hidden size={16} />
        </Button>
      </Row>
    </Row>
  );
}
