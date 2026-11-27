import {
  Box,
  Button,
  Chip,
  KeyValue,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { Maximize2, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import type { DiaryDay } from "../api";
import { useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { BodyStatsWidget } from "./BodyStats";
import { DaySummary } from "./DaySummary";
import { NotesField } from "./NotesCard";
import type { DayGoalState } from "./useDayGoal";
import type { DiaryDayState } from "./useDiaryDay";
import { WaterPanel } from "./WaterPanel";
import { setNote } from "../lib/diary";
import { trendPath } from "../lib/trendLink";

function Widget({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <Box surface="surface" border="all" radius="lg" padding={3}>
        <Stack gap={3}>
          <Row gap={2} align="center" justify="between">
            <Text variant="heading" as="h3">
              {title}
            </Text>
            {action}
          </Row>
          {children}
        </Stack>
      </Box>
    </section>
  );
}

/** The wide screen's side column: the widgets the settings switch on */
export function RailWidgets({
  day,
  goal,
  mutate,
  onOpenSummary,
  onOpenWater,
  onOpenBodyStats,
}: {
  day: DiaryDay;
  goal: DayGoalState;
  mutate: DiaryDayState["mutate"];
  onOpenSummary: () => void;
  onOpenWater: () => void;
  onOpenBodyStats: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const navigate = useNavigate();
  const open = (onClick: () => void, label: string) => (
    <Button size="sm" aria-label={label} onClick={onClick}>
      <Maximize2 aria-hidden size={14} />
    </Button>
  );

  return (
    <Stack gap={3}>
      {settings.diaryRailShowSummary && (
        <Widget
          title={t("diary.rail.summary")}
          action={
            <Row gap={1}>
              <Button
                size="sm"
                aria-label={t("diary.rail.calorieTrend")}
                onClick={() => {
                  void navigate(trendPath("calories") ?? "/nutrition");
                }}
              >
                <TrendingUp aria-hidden size={14} />
              </Button>
              {open(onOpenSummary, t("diary.openSummary"))}
            </Row>
          }
        >
          <DaySummary
            items={day.items}
            goals={settings.goals}
            date={day.date}
            goalKcal={goal.goal.kcal}
            adjustedKcal={goal.adjustedKcal}
          />
        </Widget>
      )}
      {settings.diaryRailShowWater && settings.waterShowInDiary && (
        <Widget
          title={t("diary.water.title")}
          action={open(onOpenWater, t("diary.openWater"))}
        >
          <WaterPanel day={day} mutate={mutate} />
        </Widget>
      )}
      {settings.diaryRailShowBodyStats && (
        <Widget title={t("diary.body.title")}>
          <BodyStatsWidget day={day} mutate={mutate} onOpen={onOpenBodyStats} />
        </Widget>
      )}
      {settings.diaryRailShowActivity && <ActivityImpact goal={goal} />}
      {settings.diaryRailShowNotes && settings.diaryShowNotes && (
        <Widget title={t("diary.notes.title")}>
          <NotesField
            key={day.date}
            value={day.notes}
            onSave={(text) => mutate(setNote(text))}
          />
        </Widget>
      )}
    </Stack>
  );
}

/** How the day's goal comes about; nothing to show for a plain fixed goal */
function ActivityImpact({ goal }: { goal: DayGoalState }) {
  const { t } = useTranslation("nutrition");
  const { settings } = useNtSettings();
  const format = useNutritionFormat();
  const mode = settings.calorieGoalMode;
  const activeKcal = goal.activity.data?.sum.effective ?? 0;
  if (activeKcal <= 0 && mode === "fixed") return null;

  const rows: [string, number][] = [];
  const source = goal.goal.source;
  if (source === "dynamic" && goal.caloriesOut?.calories_out != null) {
    rows.push([t("diary.rail.wearableBurn"), goal.caloriesOut.calories_out]);
    rows.push([t("diary.rail.baseGoal"), goal.goal.kcal]);
  } else if (source === "adaptive" && goal.adaptive?.tdee != null) {
    rows.push([t("diary.rail.learnedTdee"), goal.adaptive.tdee]);
  } else if (activeKcal > 0) {
    rows.push([t("diary.rail.baseGoal"), goal.goal.kcal]);
  }
  if (activeKcal > 0) rows.push([t("diary.rail.todaysActive"), activeKcal]);
  if (rows.length > 0) {
    rows.push([t("diary.rail.adjustedGoal"), goal.adjustedKcal]);
  }

  return (
    <Widget
      title={t("diary.rail.impact")}
      action={
        mode === "fixed" ? undefined : (
          <Chip text={t(`diary.rail.mode.${mode}`)} />
        )
      }
    >
      <Stack gap={1}>
        {rows.map(([label, kcal]) => (
          <KeyValue key={label} label={label} value={format.energy(kcal)} />
        ))}
      </Stack>
    </Widget>
  );
}
