import { Button, Row } from "@monocircuit/monolithium/components";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { MealIcon } from "@/features/shared/mealIcon";

import { useShared } from "../common/binding";
import { CheckList, NumberRow, SegmentRow, TextRow } from "../common/fields";
import { BoundSelect, BoundSwitch, BoundText } from "../common/rows";
import { Section, SettingsScreen } from "../common/SettingsScreen";
import { SortableList } from "../common/SortableList";
import { stringList } from "../lib/lists";

type DiaryToggle =
  | "diaryShowBrands"
  | "diaryShowTimestamps"
  | "diaryShowThumbnails"
  | "diaryShowAllNutrients"
  | "diaryShowNutritionUnits"
  | "diaryShowPortionSize"
  | "diaryShowMacroSummary"
  | "diaryPromptQuantity"
  | "diaryShowNutritionBar"
  | "diaryShowNotes"
  | "diaryShowCompletion"
  | "showUnitMetadata"
  | "warnUnitMismatch"
  | "diaryRailShowSummary"
  | "diaryRailShowWater"
  | "diaryRailShowBodyStats"
  | "diaryRailShowActivity"
  | "diaryRailShowNotes"
  | "showQuickCalories"
  | "diaryShowActivity"
  | "calorieAdjustFromActivity";

const FASTING_HOURS = [14, 16, 18, 20, 23];

function MealNames() {
  const { t } = useTranslation("settings");
  const [stored, setStored] = useShared<unknown>(["nt", "mealNames"]);
  const [draft, setDraft] = useState("");
  const names = stringList(stored);
  const save = (next: string[]) => {
    // An empty list would leave the diary without meals.
    const filled = next.map((name) => name.trim()).filter(Boolean);
    if (filled.length > 0) setStored(filled);
  };
  const add = () => {
    if (!draft.trim()) return;
    save([...names, draft]);
    setDraft("");
  };

  return (
    <Section title={t("diary.mealNames")} hint={t("diary.mealNamesHint")}>
      <SortableList
        label={t("diary.mealNames")}
        items={names.map((name, index) => ({ id: String(index), label: name }))}
        onReorder={(ids) => {
          save(ids.map((id) => names[Number(id)] ?? ""));
        }}
        renderLabel={(item, index) => (
          <Row gap={2} align="center">
            <MealIcon name={item.label} />
            <div className="min-w-0 flex-1">
              <TextRow
                label={t("diary.mealName", { number: index + 1 })}
                value={item.label}
                onCommit={(name) => {
                  save(names.map((old, i) => (i === index ? name : old)));
                }}
              />
            </div>
          </Row>
        )}
        renderActions={(item, index) => (
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("actions.removeNamed", { name: item.label })}
            isDisabled={names.length <= 1}
            onClick={() => {
              save(names.filter((_, i) => i !== index));
            }}
          >
            <X aria-hidden />
          </Button>
        )}
      />
      <TextRow
        label={t("diary.newMeal")}
        value={draft}
        isLive
        onCommit={setDraft}
        onSubmit={add}
        after={
          <Button
            variant="secondary"
            size="md"
            text={t("diary.addMeal")}
            isDisabled={!draft.trim()}
            onClick={add}
          />
        }
      />
    </Section>
  );
}

function Fasting() {
  const { t, i18n } = useTranslation("settings");
  const [isOn] = useShared<boolean>(["nt", "fastingEnabled"]);
  const [isScheduled] = useShared<boolean>(["nt", "fastingScheduleEnabled"]);
  const [hours, setHours] = useShared<number>(["nt", "fastingDefaultHours"]);
  const [days, setDays] = useShared<number[]>(["nt", "fastingScheduleDays"]);
  const [goal, setGoal] = useShared<number>(["nt", "fastingScheduleGoal"]);
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: "short" });

  return (
    <Section title={t("diary.fasting")}>
      <BoundSwitch
        refs={[["nt", "fastingEnabled"]]}
        label={t("diary.fastingEnabled")}
      />
      {isOn ? (
        <>
          <SegmentRow<number>
            label={t("diary.fastingDefault")}
            value={hours}
            options={FASTING_HOURS.map((value) => ({
              value,
              label: value === 23 ? "OMAD" : `${value}:${24 - value}`,
            }))}
            onChange={setHours}
          />
          <BoundSwitch
            refs={[["nt", "fastingNotifyOnGoal"]]}
            label={t("diary.fastingNotify")}
          />
          <BoundSwitch
            refs={[["nt", "fastingScheduleEnabled"]]}
            label={t("diary.fastingSchedule")}
          />
          {isScheduled ? (
            <>
              <BoundText
                type="time"
                refs={[["nt", "fastingScheduleTime"]]}
                label={t("diary.fastingStart")}
              />
              <CheckList<number>
                isInline
                label={t("diary.fastingDays")}
                // Sunday is 0; 2023-01-01 was a Sunday.
                options={[0, 1, 2, 3, 4, 5, 6].map((value) => ({
                  value,
                  label: weekday.format(new Date(2023, 0, 1 + value)),
                }))}
                values={days}
                onChange={setDays}
              />
              <NumberRow
                label={t("diary.fastingScheduleGoal")}
                value={goal}
                min={1}
                max={168}
                fallback={16}
                onCommit={setGoal}
              />
            </>
          ) : null}
        </>
      ) : null}
    </Section>
  );
}

export function DiaryPage() {
  const { t } = useTranslation("settings");
  const [hasQuick] = useShared<boolean>(["nt", "showQuickCalories"]);
  const [hasActivity] = useShared<boolean>(["nt", "diaryShowActivity"]);
  const [isAdjusting] = useShared<boolean>(["nt", "calorieAdjustFromActivity"]);
  const [policy, setPolicy] = useShared<string>(["nt", "manualActivityPolicy"]);
  const toggle = (key: DiaryToggle) => (
    <BoundSwitch
      key={key}
      refs={[["nt", key]]}
      label={t(`diary.toggles.${key}`)}
    />
  );

  return (
    <SettingsScreen
      title={t("topics.diary.title")}
      description={t("topics.diary.description")}
      backends={["nt"]}
    >
      <Section title={t("diary.rows")}>
        {(
          [
            "diaryShowBrands",
            "diaryShowTimestamps",
            "diaryShowThumbnails",
            "diaryShowAllNutrients",
            "diaryShowNutritionUnits",
            "diaryShowPortionSize",
          ] as const
        ).map(toggle)}
      </Section>
      <Section title={t("diary.cards")}>
        {(["diaryShowMacroSummary", "diaryPromptQuantity"] as const).map(
          toggle,
        )}
        <BoundSelect<string>
          refs={[["nt", "diaryDefaultField"]]}
          label={t("diary.defaultField")}
          options={[
            { value: "servings", label: t("diary.fields.servings") },
            { value: "portion", label: t("diary.fields.portion") },
          ]}
        />
        {(
          [
            "diaryShowNutritionBar",
            "diaryShowNotes",
            "diaryShowCompletion",
          ] as const
        ).map(toggle)}
      </Section>
      <Section title={t("diary.units")}>
        {(["showUnitMetadata", "warnUnitMismatch"] as const).map(toggle)}
      </Section>
      <Section title={t("diary.sidebar")} hint={t("diary.sidebarHint")}>
        {(
          [
            "diaryRailShowSummary",
            "diaryRailShowWater",
            "diaryRailShowBodyStats",
            "diaryRailShowActivity",
            "diaryRailShowNotes",
          ] as const
        ).map(toggle)}
      </Section>
      <Section title={t("diary.quickAndActivity")}>
        {toggle("showQuickCalories")}
        {hasQuick ? (
          <BoundSelect<string>
            refs={[["nt", "quickCaloriesDisplay"]]}
            label={t("diary.quickDisplay")}
            options={[
              { value: "summed", label: t("diary.quick.summed") },
              { value: "separate", label: t("diary.quick.separate") },
            ]}
          />
        ) : null}
        {toggle("diaryShowActivity")}
        {hasActivity ? toggle("calorieAdjustFromActivity") : null}
        {hasActivity && isAdjusting ? (
          <SegmentRow<string>
            label={t("diary.policy")}
            hint={t(`diary.policies.${policy as "additive"}.description`)}
            value={policy}
            options={(
              ["wearable_wins", "manual_wins", "additive"] as const
            ).map((value) => ({
              value,
              label: t(`diary.policies.${value}.label`),
            }))}
            onChange={setPolicy}
          />
        ) : null}
      </Section>
      <Fasting />
      <MealNames />
    </SettingsScreen>
  );
}
