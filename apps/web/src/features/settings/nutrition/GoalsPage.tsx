import {
  Button,
  EmptyState,
  ExternalLink,
  KeyValue,
  Row,
  Text,
} from "@monocircuit/monolithium/components";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useShared } from "../common/binding";
import { SegmentRow, SelectRow, TextRow } from "../common/fields";
import { BoundSwitch } from "../common/rows";
import { Section, SettingsScreen } from "../common/SettingsScreen";
import { parseNumberInput } from "../lib/numbers";
import {
  fromMl,
  isWaterUnit,
  newContainer,
  WATER_UNITS,
  type WaterContainer,
  type WaterUnit,
} from "../lib/water";

const ADAPTIVE_DOCS = "https://github.com/TraceApps/nutritrace#adaptive-tdee";

function CalorieGoal() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const [mode, setMode] = useShared<string>(["nt", "calorieGoalMode"]);
  const [factor, setFactor] = useShared<number>(["nt", "calorieGoalFactor"]);
  const [isFitbit] = useShared<boolean>(["nt", "fitbitEnabled"]);
  const [isGoogle] = useShared<boolean>(["nt", "googleHealthEnabled"]);
  const [isConnect] = useShared<boolean>(["nt", "healthConnectEnabled"]);
  const [isGarmin] = useShared<boolean>(["nt", "garminEnabled"]);
  // Withings measures the body, not what it burns: it doesn't count here.
  const hasWearable = isFitbit || isGoogle || isConnect || isGarmin;
  const known = mode === "dynamic" || mode === "adaptive" ? mode : "fixed";

  return (
    <Section title={t("goals.calories")}>
      <SelectRow<string>
        label={t("goals.mode")}
        hint={t(`goals.modes.${known}.description`)}
        value={known}
        options={(["fixed", "dynamic", "adaptive"] as const).map((value) => ({
          value,
          label: t(`goals.modes.${value}.label`),
          isDisabled: value === "dynamic" && !hasWearable,
        }))}
        onChange={setMode}
      />
      {!hasWearable ? (
        <Row gap={2} align="center" shouldWrap>
          <Text variant="small" tone="muted">
            {t("goals.dynamicNeedsWearable")}
          </Text>
          <Button
            variant="secondary"
            size="sm"
            text={t("topics.wellness.title")}
            onClick={() => void navigate("/nutrition/wellness/settings")}
          />
        </Row>
      ) : null}
      {known === "adaptive" ? (
        <ExternalLink href={ADAPTIVE_DOCS} text={t("goals.adaptiveDocs")} />
      ) : null}
      {known !== "fixed" ? (
        <SegmentRow<number>
          label={t("goals.factor")}
          value={factor}
          options={[
            { value: 0.8, label: t("goals.factors.lose") },
            { value: 1, label: t("goals.factors.maintain") },
            { value: 1.2, label: t("goals.factors.gain") },
          ]}
          onChange={setFactor}
        />
      ) : null}
      <Row>
        <Button
          variant="secondary"
          size="md"
          text={t("goals.editGoals")}
          onClick={() => void navigate("/nutrition/goals")}
        />
      </Row>
    </Section>
  );
}

function Water() {
  const { t, i18n } = useTranslation("settings");
  const [storedUnit, setUnit] = useShared<string>(["nt", "waterUnit"]);
  const [containers, setContainers] = useShared<WaterContainer[]>([
    "nt",
    "waterContainers",
  ]);
  const [name, setName] = useState("");
  const [volume, setVolume] = useState("");
  const [addUnit, setAddUnit] = useState<WaterUnit>("ml");
  const [isInvalid, setIsInvalid] = useState(false);
  const unit = isWaterUnit(storedUnit) ? storedUnit : "ml";
  const unitOptions = WATER_UNITS.map((value) => ({ value, label: value }));
  const list = Array.isArray(containers) ? containers : [];

  const add = () => {
    const container = newContainer(name, parseNumberInput(volume), addUnit);
    setIsInvalid(!container);
    if (!container) return;
    setContainers([...list, container]);
    setName("");
    setVolume("");
  };

  return (
    <>
      <Section title={t("goals.water")}>
        <SegmentRow<string>
          label={t("goals.waterUnit")}
          value={unit}
          options={unitOptions}
          onChange={setUnit}
        />
        <BoundSwitch
          refs={[["nt", "waterShowInDiary"]]}
          label={t("goals.waterInDiary")}
        />
        <BoundSwitch
          refs={[["nt", "waterShowInStats"]]}
          label={t("goals.waterInStats")}
        />
      </Section>
      <Section title={t("goals.containers")}>
        {list.length === 0 ? (
          <EmptyState text={t("goals.noContainers")} />
        ) : null}
        {list.map((container) => (
          <KeyValue
            key={container.id}
            label={container.name}
            value={
              <Row gap={2} align="center">
                <Text>
                  {`${new Intl.NumberFormat(i18n.language, {
                    maximumFractionDigits: 3,
                  }).format(fromMl(container.volumeMl, unit))} ${unit}`}
                </Text>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("actions.removeNamed", {
                    name: container.name,
                  })}
                  onClick={() => {
                    setContainers(
                      list.filter((other) => other.id !== container.id),
                    );
                  }}
                >
                  <X aria-hidden />
                </Button>
              </Row>
            }
          />
        ))}
        <TextRow
          label={t("goals.containerName")}
          value={name}
          onCommit={setName}
        />
        <TextRow
          label={t("goals.containerVolume")}
          inputMode="decimal"
          value={volume}
          onCommit={setVolume}
          error={isInvalid ? t("goals.containerInvalid") : undefined}
        />
        <SegmentRow<WaterUnit>
          label={t("goals.containerUnit")}
          value={addUnit}
          options={unitOptions}
          onChange={setAddUnit}
        />
        <Row>
          <Button
            variant="secondary"
            size="md"
            text={t("goals.addContainer")}
            onClick={add}
          />
        </Row>
      </Section>
    </>
  );
}

export function GoalsPage() {
  const { t } = useTranslation("settings");
  return (
    <SettingsScreen
      title={t("topics.goals.title")}
      description={t("topics.goals.description")}
      backends={["nt"]}
    >
      <CalorieGoal />
      <Water />
    </SettingsScreen>
  );
}
