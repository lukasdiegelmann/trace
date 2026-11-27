/**
 * Height, weight and activity as the apps' calculations read them:
 * NutriTrace's height_cm, weight_kg, target_weight, activity and LiftTrace's
 * heightCm, currentWeightKg. All stored metric.
 */
import { Row } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { useFirstSet, useShared, type SettingRef } from "../common/binding";
import { NumberRow, SelectRow } from "../common/fields";
import { Section } from "../common/SettingsScreen";
import {
  ACTIVITIES,
  cmToFeetInches,
  feetInchesToCm,
  round1,
  weightFromKg,
  weightToKg,
  type Activity,
} from "../lib/body";

export function HeightRow() {
  const { t } = useTranslation("settings");
  const [unit] = useShared<string>(["nt", "heightUnit"]);
  const [height, setHeight] = useFirstSet<unknown>(
    ["lt", "heightCm"],
    ["nt", "height_cm"],
  );
  const cm = Number(height) || 0;
  if (unit !== "ft") {
    return (
      <NumberRow
        label={t("body.heightCm")}
        value={cm || NaN}
        min={0}
        max={300}
        onCommit={setHeight}
      />
    );
  }
  const { feet, inches } = cmToFeetInches(cm);
  return (
    <Row gap={2}>
      <NumberRow
        label={t("body.heightFt")}
        value={cm ? feet : NaN}
        min={0}
        max={9}
        isInteger
        onCommit={(next) => {
          setHeight(feetInchesToCm(next, cm ? inches : 0));
        }}
      />
      <NumberRow
        label={t("body.heightIn")}
        value={cm ? inches : NaN}
        min={0}
        max={11}
        isInteger
        onCommit={(next) => {
          setHeight(feetInchesToCm(cm ? feet : 0, next));
        }}
      />
    </Row>
  );
}

export function WeightRow({ keyName }: { keyName: "weight" | "targetWeight" }) {
  const { t } = useTranslation("settings");
  const [unit] = useShared<string>(["nt", "weightUnit"]);
  const refs: [SettingRef, ...SettingRef[]] =
    keyName === "weight"
      ? [
          ["lt", "currentWeightKg"],
          ["nt", "weight_kg"],
        ]
      : [["nt", "target_weight"]];
  const [value, setValue] = useFirstSet<unknown>(...refs);
  const kg = Number(value) || 0;
  return (
    <NumberRow
      label={t(`body.${keyName}`, { unit })}
      value={kg ? round1(weightFromKg(kg, unit)) : NaN}
      min={0}
      onCommit={(next) => {
        setValue(round1(weightToKg(next, unit)));
      }}
    />
  );
}

export function ActivityRow() {
  const { t } = useTranslation("settings");
  const [activity, setActivity] = useShared<unknown>(["nt", "activity"]);
  return (
    <SelectRow<Activity | "">
      label={t("body.activity")}
      value={ACTIVITIES.find((a) => a === activity) ?? ""}
      options={ACTIVITIES.map((value) => ({
        value,
        label: t(`body.activities.${value}`),
      }))}
      onChange={setActivity}
    />
  );
}

export function BodyData() {
  const { t } = useTranslation("settings");
  return (
    <Section title={t("body.title")} hint={t("body.hint")}>
      <HeightRow />
      <WeightRow keyName="weight" />
      <WeightRow keyName="targetWeight" />
      <ActivityRow />
    </Section>
  );
}
