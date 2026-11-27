import {
  Button,
  KeyValue,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { BodyStats, DiaryDay } from "../api";
import { AppDialog } from "../components/AppDialog";
import { DecimalField } from "../components/DecimalField";
import {
  BODY_STAT_KEYS,
  LENGTH_KEYS,
  readBodyStat,
  tagBodyStats,
  type BodyStatKey,
} from "../lib/bodyStats";
import { parseDecimal } from "../lib/decimal";
import { mergeBodyStats, type DiaryMutation } from "../lib/diary";
import { useNtSettings } from "../settings";

type Mutate = (mutation: DiaryMutation) => Promise<unknown>;

/** Each field's unit in the user's settings */
function useStatUnits() {
  const { settings } = useNtSettings();
  const { weightUnit, lengthUnit } = settings;
  return {
    weightUnit,
    lengthUnit,
    unitOf: (key: BodyStatKey) =>
      key === "weight"
        ? weightUnit
        : key === "body_fat" || key === "body_water"
          ? "%"
          : lengthUnit,
    read: (stats: BodyStats, key: BodyStatKey) =>
      readBodyStat(stats, key, weightUnit, lengthUnit),
  };
}

export function BodyStatsDialog({
  day,
  mutate,
  onClose,
}: {
  day: DiaryDay;
  mutate: Mutate;
  onClose: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const units = useStatUnits();
  const fields = BODY_STAT_KEYS.filter(
    (key) => !settings.hiddenBodyStats.includes(key),
  );
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      fields.map((key) => [key, String(units.read(day.body_stats, key) ?? "")]),
    ),
  );

  const save = () => {
    const stats: Record<string, number | string> = {};
    for (const key of fields) {
      const typed = values[key].trim();
      // Only what changed: an untouched field keeps its stored unit and value
      if (typed === String(units.read(day.body_stats, key) ?? "")) continue;
      const number = parseDecimal(typed);
      stats[key] = Number.isFinite(number) ? number : "";
    }
    if (Object.keys(stats).length > 0) {
      void mutate(
        mergeBodyStats(
          tagBodyStats(
            retag(day.body_stats, stats, units),
            units.weightUnit,
            units.lengthUnit,
          ),
        ),
      );
    }
    onClose();
  };

  return (
    <AppDialog title={t("diary.body.title")} onClose={onClose} onConfirm={save}>
      <div className="grid grid-cols-2 gap-3 compact:grid-cols-1">
        {fields.map((key, index) => (
          <DecimalField
            key={key}
            label={t("diary.body.field", {
              name: t(`bodyStats.${key}`),
              unit: units.unitOf(key),
            })}
            value={values[key]}
            onChange={(value) => {
              setValues({ ...values, [key]: value });
            }}
            onEnter={save}
            hasAutoFocus={index === 0}
          />
        ))}
      </div>
    </AppDialog>
  );
}

/**
 * One unit tag covers all lengths: when a length is written, the other stored
 * lengths are rewritten in the same unit so the tag stays true for them.
 */
function retag(
  stored: BodyStats,
  changes: Record<string, number | string>,
  units: ReturnType<typeof useStatUnits>,
): BodyStats {
  const out: Record<string, unknown> = { ...changes };
  if (LENGTH_KEYS.some((key) => key in changes)) {
    for (const key of LENGTH_KEYS) {
      const value = units.read(stored, key);
      if (!(key in out) && value !== null) out[key] = value;
    }
  }
  return out;
}

/** The rail's body stats: today's weight in place, the measurements below */
export function BodyStatsWidget({
  day,
  mutate,
  onOpen,
}: {
  day: DiaryDay;
  mutate: Mutate;
  onOpen: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const units = useStatUnits();
  const weight = units.read(day.body_stats, "weight");
  const [draft, setDraft] = useState<string | null>(null);
  const measurements = LENGTH_KEYS.map((key) => ({
    key,
    value: units.read(day.body_stats, key),
  })).filter((entry) => entry.value !== null);

  const commit = () => {
    if (draft === null) return;
    const typed = draft.trim();
    const number = parseDecimal(typed);
    setDraft(null);
    if (typed !== "" && !Number.isFinite(number)) return;
    const value = typed === "" || number <= 0 ? null : number;
    void mutate(
      mergeBodyStats(
        value === null
          ? { weight: null }
          : tagBodyStats({ weight: value }, units.weightUnit, units.lengthUnit),
      ),
    );
  };

  return (
    <Stack gap={2}>
      {draft !== null ? (
        <Stack gap={2}>
          <div
            onKeyDown={(event) => {
              if (event.key === "Escape") setDraft(null);
            }}
          >
            <DecimalField
              label={t("diary.body.field", {
                name: t("bodyStats.weight"),
                unit: units.weightUnit,
              })}
              value={draft}
              onChange={setDraft}
              onEnter={commit}
              hasAutoFocus
            />
          </div>
          <Row gap={2} justify="end">
            <Button
              size="sm"
              text={t("common.cancel")}
              onClick={() => {
                setDraft(null);
              }}
            />
            <Button
              size="sm"
              variant="primary"
              text={t("common.save")}
              onClick={commit}
            />
          </Row>
        </Stack>
      ) : weight === null ? (
        <Row gap={2} align="center" justify="between">
          <Text variant="small" tone="muted">
            {t("diary.body.notLogged")}
          </Text>
          <Button
            size="sm"
            variant="secondary"
            text={t("diary.body.log")}
            onClick={() => {
              setDraft("");
            }}
          />
        </Row>
      ) : (
        <Row gap={2} align="center" justify="between">
          <Text variant="heading">{`${weight} ${units.weightUnit}`}</Text>
          <Button
            size="sm"
            aria-label={t("diary.body.editWeight")}
            onClick={() => {
              setDraft(String(weight));
            }}
          >
            <Pencil aria-hidden size={16} />
          </Button>
        </Row>
      )}
      {measurements.length === 0 ? (
        <Text variant="caption">{t("diary.body.noMeasurements")}</Text>
      ) : (
        measurements.map(({ key, value }) => (
          <KeyValue
            key={key}
            label={t(`bodyStats.${key}`)}
            value={`${value ?? ""} ${units.lengthUnit}`}
          />
        ))
      )}
      <Button size="sm" text={t("diary.body.logStats")} onClick={onOpen} />
    </Stack>
  );
}
