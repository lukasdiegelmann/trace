import {
  EmptyState,
  SegmentedControl,
  Spinner,
  Stat,
  Tile,
  useToast,
} from "@monocircuit/monolithium/components";
import { HeartPulse, MonitorOff, Scale } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { addDays, isIsoDay, localDateStr } from "../../lib/insights/dates";
import {
  chronotype,
  mergeDisplayData,
  mergeNights,
  readinessForToday,
  sleepDebt,
  sleepInsightDays,
  sparklineSeries,
  visibleTabs,
  weekActivity,
  type FormatSettings,
  type WellnessTab,
} from "../../lib/insights/wellness";
import { authorizeUrl, type Workout } from "../api";
import { InsightsHeader } from "../components/InsightsHeader";
import { SectionCard } from "../components/Panel";
import { useInsightsT } from "../useInsightsT";
import { useNtSettings } from "../useNtSettings";
import { ActivityTab } from "./ActivityTab";
import { BodyTab } from "./BodyTab";
import { ConnectCard } from "./ConnectCard";
import { DateBar } from "./DateBar";
import { HeartTab } from "./HeartTab";
import { isAutoSyncDue } from "./lastSync";
import { ProvidersPanel, type ConnectedProvider } from "./ProvidersPanel";
import { SleepTab } from "./SleepTab";
import { useDayName } from "./useDayName";
import { useGoalCelebration } from "./useGoalCelebration";
import { useOAuthReturn } from "./useOAuthReturn";
import { useWellnessData } from "./useWellnessData";
import { useWellnessSync } from "./useWellnessSync";
import { WorkoutSheet } from "./WorkoutSheet";

const SETTINGS_PATH = "/nutrition/wellness/settings";

export function WellnessPage() {
  const { t, locale } = useInsightsT();
  const toast = useToast();
  const navigate = useNavigate();
  const dayName = useDayName();
  const settings = useNtSettings();
  const { values } = settings;
  useOAuthReturn();

  // The shown day lives in the URL (Statistics links to one with ?date=)
  const [searchParams, setSearchParams] = useSearchParams();
  const today = localDateStr();
  const asked = searchParams.get("date");
  const date = isIsoDay(asked) && asked <= today ? asked : today;
  const setDate = (next: string) => {
    setSearchParams(next === today ? {} : { date: next }, { replace: true });
  };

  const { statuses, day, history, workouts, refresh } = useWellnessData(
    date,
    settings,
  );
  const { sync, syncWorkoutHistory, syncing, revoked, lastSync } =
    useWellnessSync(date, settings, refresh);

  const isFitbitConnected =
    !!statuses.data?.fitbit.connected && !revoked.includes("fitbit");
  const isGarminConnected =
    !!statuses.data?.garmin.connected && !revoked.includes("garmin");
  const isWithingsConnected =
    !!statuses.data?.withings.connected && !revoked.includes("withings");

  // Auto-sync of today once per visit, at most every 15 minutes. An unset
  // mode means "auto", as the old settings page shows it.
  const hasAutoSynced = useRef(false);
  const fitbitMode = values.fitbitSyncMode ?? "auto";
  const garminMode = values.garminSyncMode ?? "auto";
  const canAutoSync = settings.isReady && !!statuses.data;
  useEffect(() => {
    if (!canAutoSync || hasAutoSynced.current) return;
    hasAutoSynced.current = true;
    if (date !== today || !isAutoSyncDue(date)) return;
    void (async () => {
      if (isFitbitConnected && fitbitMode === "auto") {
        await sync("fitbit", { isSilent: true });
      }
      if (isGarminConnected && garminMode === "auto") {
        await sync("garmin", { isSilent: true });
      }
    })();
  }, [
    canAutoSync,
    date,
    today,
    isFitbitConnected,
    isGarminConnected,
    fitbitMode,
    garminMode,
    sync,
  ]);

  // A first visit without any workout fetches the history once
  const hasSyncedWorkouts = useRef(false);
  const isWorkoutListEmpty =
    !workouts.isLoading && workouts.data?.list.length === 0;
  useEffect(() => {
    if (!values.workoutsEnabled || !isFitbitConnected) return;
    if (!isWorkoutListEmpty || hasSyncedWorkouts.current) return;
    hasSyncedWorkouts.current = true;
    void syncWorkoutHistory();
  }, [
    values.workoutsEnabled,
    isFitbitConnected,
    isWorkoutListEmpty,
    syncWorkoutHistory,
  ]);

  const [picked, setPicked] = useState<WellnessTab>("activity");
  const [debtRange, setDebtRange] = useState(14);
  const [openWorkout, setOpenWorkout] = useState<Workout | null>(null);
  const [isConnecting, setConnecting] = useState(false);

  const connect = useCallback(
    async (provider: "google-health" | "withings") => {
      setConnecting(true);
      try {
        window.location.assign(await authorizeUrl(provider));
      } catch (error) {
        toast.error((error as Error).message);
        setConnecting(false);
      }
    },
    [toast],
  );

  const isLoading = day.isLoading;
  const dayData = day.data ?? {
    fitbit: {},
    garmin: {},
    withings: {},
  };
  const displayData = mergeDisplayData(
    dayData.garmin,
    dayData.fitbit,
    settings,
  );
  const celebrating = useGoalCelebration(
    day.isLoading ? null : { ...displayData, ...dayData.withings },
    settings.goals,
    values.goalCelebrations && !values.disableAnimations,
  );

  const recent = history.data;
  const weekDays = recent?.days.slice(-7) ?? [];
  const series = sparklineSeries(
    weekDays,
    recent?.garmin ?? {},
    recent?.fitbit ?? {},
  );
  const nights = recent
    ? mergeNights(
        sleepInsightDays(debtRange, recent.days[recent.days.length - 1]),
        recent.garmin,
        recent.fitbit,
      )
    : [];
  const debt = sleepDebt(nights, debtRange, settings.goals.sleep_duration_min);
  const type = chronotype(nights);
  // Readiness is always today's, whichever day the page shows
  const readiness = recent
    ? readinessForToday(
        mergeDisplayData(
          recent.garmin[today] ?? {},
          recent.fitbit[today] ?? {},
          settings,
        ),
        recent.days.filter((d) => d >= addDays(today, -30)),
        recent.garmin,
        recent.fitbit,
      )
    : null;

  const hasActivity =
    settings.isFitbitFamilyEnabled || settings.isGarminEnabled;
  const hasBody = settings.isWithingsEnabled || values.healthConnectEnabled;
  const tabs = visibleTabs({ hasActivity, hasBody });
  const tab = tabs.includes(picked) ? picked : (tabs[0] ?? "activity");

  const format: FormatSettings = {
    distUnit: values.distUnit,
    energyUnit: values.energyUnit,
    tempUnit: values.tempUnit,
    weightUnit: values.weightUnit,
    locale,
  };
  const openTrend = (metric: string) =>
    void navigate(`/nutrition/statistics?metric=${metric}&range=30`);

  const providers: ConnectedProvider[] = statuses.data
    ? [
        ...(isFitbitConnected
          ? [
              {
                id: "fitbit" as const,
                account: statuses.data.fitbit.fitbitUserId,
              },
            ]
          : []),
        ...(isGarminConnected
          ? [
              {
                id: "garmin" as const,
                account: statuses.data.garmin.garminUserId,
              },
            ]
          : []),
        ...(isWithingsConnected
          ? [
              {
                id: "withings" as const,
                account: statuses.data.withings.withingsUserId,
              },
            ]
          : []),
      ]
    : [];

  const dayLabel = date === today ? t("wellness.empty.today") : dayName(date);
  const emptyDayText = `${t("wellness.empty.noData", { day: dayLabel })} ${t(
    navigator.onLine ? "wellness.empty.syncHint" : "wellness.empty.offline",
  )}`;
  const shouldOfferFitbit =
    !isFitbitConnected &&
    !isGarminConnected &&
    !isWithingsConnected &&
    !settings.isFitbitFamilyEnabled;

  const tabProps = {
    data: displayData,
    wellnessMetrics: settings.wellnessMetrics,
    sources: settings,
    series,
    format,
    celebrating,
    isLoading,
    onTrend: openTrend,
  };

  const renderTab = () => {
    if (tab === "body") {
      if (isWithingsConnected || settings.isFitbitFamilyEnabled) {
        return (
          <BodyTab
            withings={dayData.withings}
            fitbit={dayData.fitbit}
            wellnessMetrics={settings.wellnessMetrics}
            format={format}
            celebrating={celebrating}
            isLoading={isLoading}
            emptyText={`${t("wellness.body.noData", { day: dayLabel })} ${t("wellness.body.syncHint")}`}
          />
        );
      }
      return statuses.data?.withings.configured ? (
        <ConnectCard
          icon={<Scale aria-hidden size={40} />}
          title={t("wellness.connect.withingsTitle")}
          text={t("wellness.connect.withingsText")}
          chips={[
            "weight",
            "bodyFat",
            "muscleMass",
            "bodyWater",
            "boneMass",
            "ecg",
          ].map((id) => t(`wellness.connect.chips.${id}`))}
          actionText={t("wellness.connect.withingsAction")}
          isBusy={isConnecting}
          onAction={() => void connect("withings")}
        />
      ) : null;
    }
    if (shouldOfferFitbit) {
      return statuses.data?.fitbit.configured ? (
        <ConnectCard
          icon={<HeartPulse aria-hidden size={40} />}
          title={t("wellness.connect.fitbitTitle")}
          text={t("wellness.connect.fitbitText")}
          chips={["activity", "sleep", "heartHrv", "spo2", "breathingRate"].map(
            (id) => t(`wellness.connect.chips.${id}`),
          )}
          actionText={t("wellness.connect.fitbitAction")}
          isBusy={isConnecting}
          onAction={() => void connect("google-health")}
        />
      ) : (
        <ConnectCard
          icon={<MonitorOff aria-hidden size={40} />}
          title={t("wellness.empty.noDeviceTitle")}
          text={t("wellness.empty.noDeviceText")}
          actionText={t("wellness.providers.manage")}
          onAction={() => void navigate(SETTINGS_PATH)}
        />
      );
    }
    return (
      <>
        {tab === "activity" ? (
          <ActivityTab
            {...tabProps}
            workouts={
              values.workoutsEnabled && !workouts.isLoading
                ? (workouts.data?.list ?? [])
                : []
            }
            onOpenWorkout={setOpenWorkout}
          />
        ) : tab === "sleep" ? (
          <SleepTab
            {...tabProps}
            debt={debt}
            debtRange={debtRange}
            onDebtRangeChange={setDebtRange}
            chronotype={type}
            timeFormat={values.timeFormat}
          />
        ) : (
          <HeartTab
            {...tabProps}
            garmin={isGarminConnected ? dayData.garmin : null}
            readiness={readiness}
          />
        )}
        {!isLoading && Object.keys(displayData).length === 0 ? (
          <EmptyState
            icon={<HeartPulse aria-hidden size={40} />}
            text={emptyDayText}
          />
        ) : null}
      </>
    );
  };

  const week = weekActivity(series);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
      <InsightsHeader
        title={t("wellness.title")}
        section="wellness"
        settingsPath={SETTINGS_PATH}
      />
      {!settings.isReady || !statuses.data ? (
        <div className="flex justify-center py-12">
          <Spinner label={t("common.loading")} />
        </div>
      ) : tabs.length === 0 ? (
        <ConnectCard
          icon={<HeartPulse aria-hidden size={40} />}
          title={t("wellness.empty.noIntegrationsTitle")}
          text={t("wellness.empty.noIntegrationsText")}
          chips={["activity", "sleep", "heart", "body"].map((id) =>
            t(`wellness.tabs.${id}`),
          )}
          actionText={t("wellness.providers.manage")}
          onAction={() => void navigate(SETTINGS_PATH)}
        />
      ) : (
        <>
          <DateBar
            date={date}
            dateFormat={values.dateFormat}
            onDateChange={setDate}
          />
          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="min-w-0 overflow-x-auto">
                <SegmentedControl<WellnessTab>
                  aria-label={t("wellness.tabs.label")}
                  value={tab}
                  onChange={setPicked}
                  options={tabs.map((value) => ({
                    value,
                    label: t(`wellness.tabs.${value}`),
                  }))}
                />
              </div>
              {renderTab()}
            </div>
            <aside className="flex min-w-0 flex-col gap-3">
              {readiness &&
              !readiness.isCalibrating &&
              tabs.includes("heart") ? (
                <Tile
                  label={t("wellness.readiness.open")}
                  onPress={() => {
                    setPicked("heart");
                  }}
                >
                  <Stat
                    label={t("wellness.readiness.todays")}
                    value={String(readiness.score)}
                    hint={t(`wellness.readiness.bands.${readiness.band}`)}
                  />
                </Tile>
              ) : null}
              <ProvidersPanel
                providers={providers}
                syncing={syncing}
                lastSync={lastSync}
                onSync={sync}
                onManage={() => void navigate(SETTINGS_PATH)}
              />
              {tab === "activity" && week.hasData ? (
                <SectionCard
                  title={t("wellness.week.title")}
                  hint={t("wellness.week.hint")}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <Stat
                      label={t("wellness.week.totalSteps")}
                      value={week.stepsTotal.toLocaleString(locale)}
                    />
                    <Stat
                      label={t("wellness.week.dailyAverage")}
                      value={week.stepsAvg.toLocaleString(locale)}
                    />
                    <Stat
                      label={t("wellness.week.daysOver10k")}
                      value={`${week.daysOver10k} / 7`}
                    />
                    <Stat
                      label={t("wellness.week.activeMinutes")}
                      value={week.activeMinutes.toLocaleString(locale)}
                      hint={
                        week.caloriesOut > 0
                          ? t("wellness.week.burned", {
                              value: week.caloriesOut.toLocaleString(locale),
                            })
                          : undefined
                      }
                    />
                  </div>
                </SectionCard>
              ) : null}
            </aside>
          </div>
        </>
      )}
      {openWorkout ? (
        <WorkoutSheet
          workout={openWorkout}
          date={date}
          distUnit={values.distUnit}
          energyUnit={values.energyUnit}
          timeFormat={values.timeFormat}
          onClose={() => {
            setOpenWorkout(null);
          }}
        />
      ) : null}
    </div>
  );
}
