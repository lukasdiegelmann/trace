import { Banner, Spinner, Stack } from "@monocircuit/monolithium/components";
import { useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { localDateStr } from "../../lib/insights/dates";
import {
  availableMetrics,
  buildSeries,
  completionStats,
  initialMetric,
  isDeviceMetric,
  isRange,
  metricGoal,
  metricUnit,
  goalDelta,
  rangeDays,
  summarize,
  visibleMetrics,
  weeklyTrend,
  type DiaryByDate,
  type Range,
} from "../../lib/insights/statistics";
import {
  getAllDiary,
  getFitbitData,
  getGarminData,
  getWithingsData,
  orEmpty,
} from "../api";
import { InsightsHeader } from "../components/InsightsHeader";
import { useAsync } from "../useAsync";
import { useInsightsT } from "../useInsightsT";
import { useNtSettings } from "../useNtSettings";
import { ChartCard } from "./ChartCard";
import { FastingCard } from "./FastingCard";
import { HistoryList } from "./HistoryList";
import { unitLabel } from "./labels";
import { MetricPicker } from "./MetricPicker";
import { RangeControls, type CustomRange } from "./RangeControls";
import { SummaryStats } from "./SummaryStats";

/** From, to, and whether to ask the fitbit family, Garmin and Withings */
type DeviceRequest = [string, string, boolean, boolean, boolean];

/** The wearable series a metric needs over its range */
async function loadDeviceData([
  from,
  to,
  hasFitbit,
  hasGarmin,
  hasWithings,
]: DeviceRequest) {
  const query = { from, to };
  const isInRange = !!from && !!to;
  const [fitbit, garmin, withings] = await Promise.all([
    orEmpty(isInRange && hasFitbit, () => getFitbitData(query)),
    orEmpty(isInRange && hasGarmin, () => getGarminData(query)),
    orEmpty(isInRange && hasWithings, () => getWithingsData(query)),
  ]);
  return { fitbit, garmin, withings };
}

/** The wearable series of a `DeviceRequest` written as JSON */
function useDeviceData(request: string) {
  const load = useCallback(
    () => loadDeviceData(JSON.parse(request) as DeviceRequest),
    [request],
  );
  return useAsync(load);
}

export function StatisticsPage() {
  const { t } = useInsightsT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const settings = useNtSettings();
  const { values } = settings;

  // Deep link: ?metric=…&range=… (from Wellness, Goals, the diary)
  const [picked, setPicked] = useState(() => searchParams.get("metric"));
  const [range, setRange] = useState<Range>(() => {
    const asked = searchParams.get("range");
    return isRange(asked) ? asked : "30";
  });
  const [custom, setCustom] = useState<CustomRange>(() => ({
    start: "",
    end: localDateStr(),
  }));

  const listOptions = {
    hiddenBodyStats: settings.hiddenBodyStats,
    isWaterShownInStats: values.waterShowInStats,
    wellnessMetrics: settings.wellnessMetrics,
    isFitbitFamilyEnabled: settings.isFitbitFamilyEnabled,
    isGarminEnabled: settings.isGarminEnabled,
    isWithingsEnabled: settings.isWithingsEnabled,
  };
  const metrics = visibleMetrics(
    listOptions,
    settings.statsHiddenMetrics,
    settings.statsMetricOrder,
  );
  const wanted =
    picked ??
    initialMetric(
      settings.statsMetricOrder,
      settings.statsHiddenMetrics,
      availableMetrics(listOptions),
      values.energyUnit,
    );
  // A hidden or unavailable metric snaps to the first visible one
  const metric = metrics.some((m) => m.key === wanted)
    ? wanted
    : (metrics[0]?.key ?? wanted);

  const [version, setVersion] = useState(0);
  const loadDiary = useCallback(async () => {
    const rows = await getAllDiary();
    return { rows, version };
  }, [version]);
  const diary = useAsync(loadDiary);
  const byDate: DiaryByDate = Object.fromEntries(
    (diary.data?.rows ?? []).map((row) => [row.date, row]),
  );

  const { isWellness, isBodyDevice } = isDeviceMetric(metric, settings);
  const days = rangeDays(range, {
    customStart: custom.start,
    customEnd: custom.end,
    isDeviceSeries: isWellness || isBodyDevice,
    diaryDays: Object.keys(byDate),
  });

  const isDeviceSeries = isWellness || isBodyDevice;
  // One string for what to load, so the loader only changes with it
  const deviceRequest = JSON.stringify([
    days?.[0] ?? "",
    days?.[days.length - 1] ?? "",
    isDeviceSeries && settings.isFitbitFamilyEnabled,
    isWellness && settings.isGarminEnabled,
    (isBodyDevice || metric === "wl_muscle") && settings.isWithingsEnabled,
  ]);
  const devices = useDeviceData(deviceRequest);

  const isLoading =
    (diary.data === undefined && !diary.error) || devices.isLoading;
  const rows =
    days && devices.data && !isLoading
      ? buildSeries(
          metric,
          days,
          { diary: byDate, ...devices.data },
          {
            ...settings,
            energyUnit: values.energyUnit,
            weightUnit: values.weightUnit,
            lengthUnit: values.lengthUnit,
            waterUnit: values.waterUnit,
            isTodayIncluded: values.statsIncludeToday,
          },
        )
      : [];

  const summary = summarize(rows);
  const unit = unitLabel(
    metricUnit(metric, {
      energyUnit: values.energyUnit,
      weightUnit: values.weightUnit,
      lengthUnit: values.lengthUnit,
      waterUnit: values.waterUnit,
    }),
    t,
  );
  const goal = metricGoal(settings.goals, metric, values.energyUnit);
  const completion =
    values.diaryShowCompletion && days && !isLoading
      ? completionStats(days, byDate)
      : null;
  const openDay = (date: string) =>
    void navigate(
      metric.startsWith("wl_")
        ? `/nutrition/wellness?date=${date}`
        : `/nutrition/diary?date=${date}`,
    );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
      <InsightsHeader
        title={t("statistics.title")}
        section="statistics"
        settingsPath="/nutrition/statistics/settings"
      />
      {!settings.isReady ? (
        <div className="flex justify-center py-12">
          <Spinner label={t("common.loading")} />
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <MetricPicker metrics={metrics} metric={metric} onPick={setPicked} />
          <Stack gap={4}>
            <RangeControls
              range={range}
              onRangeChange={setRange}
              custom={custom}
              onCustomChange={setCustom}
            />
            {diary.error ? (
              <Banner
                text={t("common.loadFailed", { message: diary.error.message })}
                actionText={t("common.retry")}
                onAction={() => {
                  setVersion((v) => v + 1);
                }}
              />
            ) : null}
            {summary ? (
              <SummaryStats
                summary={summary}
                unit={unit}
                delta={goalDelta(summary.avg, goal.value)}
                hasGoal={goal.value !== null}
                isMinimumGoal={goal.isMinimum}
                completion={completion}
                trend={weeklyTrend(rows)}
              />
            ) : null}
            <ChartCard
              metric={metric}
              metrics={metrics}
              range={range}
              unit={unit}
              rows={rows}
              summary={summary}
              goalValue={goal.value}
              completedDays={completion?.dates ?? null}
              isLoading={isLoading}
              settings={settings}
              onPickMetric={setPicked}
            />
            {summary ? (
              <HistoryList
                rows={rows}
                unit={unit}
                dateFormat={values.dateFormat}
                completedDays={completion?.dates ?? null}
                isWellness={metric.startsWith("wl_")}
                onOpenDay={openDay}
              />
            ) : null}
            {values.fastingEnabled ? <FastingCard /> : null}
          </Stack>
        </div>
      )}
    </div>
  );
}
