import {
  Button,
  EmptyState,
  Row,
  Text,
} from "@monocircuit/monolithium/components";
import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";

import { api } from "@/api";
import { REST_TONES } from "@/lib/restTones";

import { useShared } from "../common/binding";
import { NumberRow, SelectRow } from "../common/fields";
import { BoundSelect, BoundSwitch } from "../common/rows";
import { LoadState, Section, SettingsScreen } from "../common/SettingsScreen";
import { SortableList } from "../common/SortableList";
import { useAction } from "../common/useAction";
import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";
import { formatBytes } from "../lib/foodSources";
import { stringList, toggleItem } from "../lib/lists";
import { monthsAgo } from "../lib/dates";
import { previewRestTone } from "../lib/restTones";

const REST_SECONDS = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
const MEASUREMENTS = [
  "weight",
  "bodyFat",
  "neck",
  "chest",
  "waist",
  "hips",
  "biceps",
  "thighs",
  "calves",
] as const;

type Switch =
  | "cardioEnabled"
  | "screenKeepAwake"
  | "caloriesBurnedEnabled"
  | "autoFillLastWeights"
  | "showCompletionSummary"
  | "autoCollapseCompleted"
  | "autoNameWorkouts"
  | "confirmExerciseRemoval"
  | "autoGenerateWarmups"
  | "trackRpe";

function RestTimer() {
  const { t } = useTranslation("settings");
  const [isOn] = useShared<boolean>(["lt", "restTimerEnabled"]);
  const [isAlert] = useShared<boolean>(["lt", "restAlert"]);
  const [isTone] = useShared<boolean>(["lt", "restAlertTone"]);
  const [duration, setDuration] = useShared<number>(["lt", "restDuration"]);
  const [toneId, setToneId] = useShared<string>(["lt", "restAlertToneId"]);
  const tone = (REST_TONES.find((item) => item.id === toneId)?.id ??
    "classic") as "classic";

  return (
    <Section title={t("training.restTimer")}>
      <BoundSwitch
        refs={[["lt", "restTimerEnabled"]]}
        label={t("training.restEnabled")}
      />
      {isOn ? (
        <>
          <SelectRow<number>
            label={t("training.restDuration")}
            value={duration}
            options={REST_SECONDS.map((value) => ({
              value,
              label: `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`,
            }))}
            onChange={setDuration}
          />
          <BoundSwitch
            refs={[["lt", "restAutoStart"]]}
            label={t("training.restAutoStart")}
          />
          <BoundSwitch
            refs={[["lt", "restAlert"]]}
            label={t("training.restAlert")}
          />
          {isAlert ? (
            <>
              <BoundSwitch
                refs={[["lt", "restAlertVibrate"]]}
                label={t("training.restVibrate")}
              />
              <BoundSwitch
                refs={[["lt", "restAlertTone"]]}
                label={t("training.restSound")}
              />
              {isTone ? (
                <Row gap={2} align="end">
                  <div className="min-w-0 flex-1">
                    <SelectRow<string>
                      label={t("training.tone")}
                      hint={t(`training.tones.${tone}.description`)}
                      value={tone}
                      options={REST_TONES.map((item) => ({
                        value: item.id,
                        label: t(`training.tones.${item.id as "classic"}.name`),
                      }))}
                      onChange={(value) => {
                        setToneId(value);
                        previewRestTone(value);
                      }}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="md"
                    aria-label={t("training.playTone")}
                    onClick={() => {
                      previewRestTone(tone);
                    }}
                  >
                    <Play aria-hidden />
                  </Button>
                </Row>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </Section>
  );
}

function Measurements() {
  const { t } = useTranslation("settings");
  const [stored, setStored] = useShared<unknown>(["lt", "bodyStatsVisible"]);
  const visible = stringList(stored);
  // Visible ones in their stored order, the others after them.
  const rows = [
    ...visible.filter((id) => MEASUREMENTS.some((m) => m === id)),
    ...MEASUREMENTS.filter((id) => !visible.includes(id)),
  ];

  return (
    <Section title={t("training.measurements")}>
      <SortableList
        label={t("training.measurements")}
        items={rows.map((id) => ({
          id,
          label: t(`training.measurement.${id as "weight"}`),
          isChecked: visible.includes(id),
        }))}
        onReorder={(ids) => {
          setStored(ids.filter((id) => visible.includes(id)));
        }}
        onToggle={(id, isOn) => {
          // Switching one on appends it at the end, as in the old UI.
          setStored(toggleItem(visible, id, isOn));
        }}
      />
    </Section>
  );
}

interface MediaUsage {
  clips: number;
  bytes: number;
  oldest: string | null;
}

function SetVideos() {
  const { t } = useTranslation("settings");
  const usage = useLoad(() => api.lt.get<MediaUsage>("/set-media/usage"), []);
  const { isBusy, run } = useAction();
  const { confirm, dialog } = useConfirm();

  const cleanUp = async (months: number) => {
    const before = monthsAgo(months);
    const isConfirmed = await confirm({
      title: t("training.videos.cleanTitle"),
      message: t("training.videos.cleanText", { date: before }),
      confirmText: t("actions.delete"),
      isDangerous: true,
    });
    if (!isConfirmed) return;
    await run(async () => {
      await api.lt.post("/set-media/cleanup", { before });
      await usage.reload();
    });
  };

  return (
    <Section title={t("training.videos.title")}>
      <LoadState
        isLoading={usage.isLoading}
        error={usage.error}
        onRetry={() => void usage.reload()}
        hasData={usage.data !== null}
      >
        {usage.data?.clips ? (
          <>
            <Text>
              {t("training.videos.usage", {
                count: usage.data.clips,
                size: formatBytes(usage.data.bytes),
                oldest: usage.data.oldest ?? "",
              })}
            </Text>
            <Row gap={2} shouldWrap>
              {[6, 1].map((months) => (
                <Button
                  key={months}
                  variant="secondary"
                  size="sm"
                  text={t("training.videos.olderThan", { count: months })}
                  isDisabled={isBusy}
                  onClick={() => void cleanUp(months)}
                />
              ))}
            </Row>
          </>
        ) : (
          <EmptyState text={t("training.videos.none")} />
        )}
      </LoadState>
      {dialog}
    </Section>
  );
}

export function TrainingPage() {
  const { t } = useTranslation("settings");
  const [weekly, setWeekly] = useShared<number>(["lt", "weeklyWorkoutGoal"]);
  const [cardio, setCardio] = useShared<number>([
    "lt",
    "weeklyCardioMinutesGoal",
  ]);
  const [isCardio] = useShared<boolean>(["lt", "cardioEnabled"]);
  const toggle = (key: Switch) => (
    <BoundSwitch
      key={key}
      refs={[["lt", key]]}
      label={t(`training.toggles.${key}`)}
    />
  );

  return (
    <SettingsScreen
      title={t("topics.training.title")}
      description={t("topics.training.description")}
      backends={["lt"]}
    >
      <Section title={t("training.goals")}>
        <SelectRow<number>
          label={t("training.weeklyGoal")}
          value={weekly}
          options={[2, 3, 4, 5, 6, 7].map((value) => ({
            value,
            label: t("training.workoutsPerWeek", { count: value }),
          }))}
          onChange={setWeekly}
        />
        {toggle("cardioEnabled")}
        {isCardio ? (
          <NumberRow
            label={t("training.cardioGoal")}
            hint={t("training.cardioGoalHint")}
            value={cardio}
            min={0}
            fallback={0}
            isInteger
            onCommit={setCardio}
          />
        ) : null}
        {toggle("screenKeepAwake")}
        {toggle("caloriesBurnedEnabled")}
      </Section>
      <Section title={t("training.logging")}>
        {(
          [
            "autoFillLastWeights",
            "showCompletionSummary",
            "autoCollapseCompleted",
            "autoNameWorkouts",
            "confirmExerciseRemoval",
            "autoGenerateWarmups",
            "trackRpe",
          ] as const
        ).map(toggle)}
        <BoundSelect<string>
          refs={[["lt", "exerciseReorderMethod"]]}
          label={t("training.reorder")}
          options={(["both", "drag", "buttons"] as const).map((value) => ({
            value,
            label: t(`training.reorderOptions.${value}`),
          }))}
        />
      </Section>
      <RestTimer />
      <Measurements />
      <SetVideos />
    </SettingsScreen>
  );
}
