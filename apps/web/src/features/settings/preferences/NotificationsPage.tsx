import {
  Button,
  Chip,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "@/api";
import { requestNotificationPermission } from "@/features/shared/notifications";

import { useBackendUser } from "../common/admin";
import { flushSettings, useShared, type SettingRef } from "../common/binding";
import {
  SecretRow,
  SelectRow,
  SwitchRow,
  TextRow,
  type Option,
} from "../common/fields";
import { Section, SettingsScreen } from "../common/SettingsScreen";
import { useAction } from "../common/useAction";
import { useLoad } from "../common/useLoad";
import {
  isPushConfigured,
  PUSH_SERVICES,
  sendTestPush,
  type TestResult,
} from "../lib/channels";
import {
  isInCoaching,
  showsCoachTab,
  type CoachingState,
} from "../lib/coaching";
import { MealTimes } from "./MealTimes";

type ChannelKey =
  | "notifPushService"
  | "appriseUrl"
  | "appriseTag"
  | "gotifyUrl"
  | "gotifyToken"
  | "ntfyUrl"
  | "ntfyTopic"
  | "ntfyToken";

/** One channel setting, the same in all three backends */
function useChannel(key: ChannelKey): [string, (value: string) => void] {
  return useShared<string>(["nt", key], ["ct", key], ["lt", key]);
}

function Toggle({
  setting,
  label,
  hint,
}: {
  setting: SettingRef;
  label: string;
  hint?: string;
}) {
  const [isOn, setOn] = useShared<boolean>(setting);
  return (
    <SwitchRow label={label} hint={hint} isChecked={isOn} onChange={setOn} />
  );
}

function TimeSetting({
  setting,
  label,
}: {
  setting: SettingRef;
  label: string;
}) {
  const [value, setValue] = useShared<string>(setting);
  return (
    <TextRow type="time" label={label} value={value} onCommit={setValue} />
  );
}

function NumberChoice({
  setting,
  label,
  options,
}: {
  setting: SettingRef;
  label: string;
  options: Option<number>[];
}) {
  const [value, setValue] = useShared<number>(setting);
  return (
    <SelectRow<number>
      label={label}
      value={value}
      options={options}
      onChange={setValue}
    />
  );
}

/** Sunday is 0, as the servers count */
function useWeekdays(): Option<number>[] {
  const { i18n } = useTranslation();
  const format = new Intl.DateTimeFormat(i18n.language, { weekday: "long" });
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    value: day,
    // 2023-01-01 was a Sunday.
    label: format.format(new Date(2023, 0, 1 + day)),
  }));
}

function Channels() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const [isLocal, setLocal] = useShared<boolean>(
    ["nt", "notifLocalEnabled"],
    ["ct", "notifLocalEnabled"],
    ["lt", "notifLocalEnabled"],
  );
  const [permission, setPermission] = useState(() =>
    "Notification" in window ? Notification.permission : "unsupported",
  );
  const [service, setService] = useChannel("notifPushService");
  const [appriseUrl, setAppriseUrl] = useChannel("appriseUrl");
  const [appriseTag, setAppriseTag] = useChannel("appriseTag");
  const [gotifyUrl, setGotifyUrl] = useChannel("gotifyUrl");
  const [gotifyToken, setGotifyToken] = useChannel("gotifyToken");
  const [ntfyUrl, setNtfyUrl] = useChannel("ntfyUrl");
  const [ntfyTopic, setNtfyTopic] = useChannel("ntfyTopic");
  const [ntfyToken, setNtfyToken] = useChannel("ntfyToken");
  const [results, setResults] = useState<TestResult[] | null>(null);
  const { isBusy, run } = useAction();

  const askPermission = async () => {
    setPermission(await requestNotificationPermission());
  };
  const isConfigured = isPushConfigured(service, {
    appriseUrl,
    gotifyUrl,
    gotifyToken,
    ntfyUrl,
    ntfyTopic,
  });

  return (
    <Section
      title={t("notifications.channels")}
      hint={t("notifications.channelsHint")}
    >
      <SwitchRow
        label={t("notifications.local")}
        isChecked={isLocal}
        onChange={(isOn) => {
          setLocal(isOn);
          setResults(null);
          if (isOn) void askPermission();
        }}
      />
      {isLocal && permission !== "granted" ? (
        <Stack gap={2}>
          <Text variant="small" tone="warning">
            {t(`notifications.permission.${permission as "denied"}`)}
          </Text>
          {permission === "default" ? (
            <Row>
              <Button
                variant="secondary"
                size="sm"
                text={t("notifications.grant")}
                onClick={() => void askPermission()}
              />
            </Row>
          ) : null}
        </Stack>
      ) : null}
      <SelectRow
        label={t("notifications.service")}
        value={service}
        options={PUSH_SERVICES.map((value) => ({
          value,
          label: t(`notifications.services.${value}`),
        }))}
        onChange={(value) => {
          setService(value);
          setResults(null);
        }}
      />
      {service === "apprise" ? (
        <>
          <TextRow
            type="url"
            label={t("notifications.appriseUrl")}
            value={appriseUrl}
            onCommit={setAppriseUrl}
          />
          <TextRow
            label={t("notifications.appriseTag")}
            hint={t("optional")}
            value={appriseTag}
            onCommit={setAppriseTag}
          />
        </>
      ) : null}
      {service === "gotify" ? (
        <>
          <TextRow
            type="url"
            label={t("notifications.gotifyUrl")}
            value={gotifyUrl}
            onCommit={setGotifyUrl}
          />
          <SecretRow
            label={t("notifications.gotifyToken")}
            value={gotifyToken}
            onCommit={setGotifyToken}
          />
        </>
      ) : null}
      {service === "ntfy" ? (
        <>
          <TextRow
            type="url"
            label={t("notifications.ntfyUrl")}
            value={ntfyUrl}
            placeholder="https://ntfy.sh"
            onCommit={setNtfyUrl}
          />
          <TextRow
            label={t("notifications.ntfyTopic")}
            value={ntfyTopic}
            onCommit={setNtfyTopic}
          />
          <SecretRow
            label={t("notifications.ntfyToken")}
            hint={t("optional")}
            value={ntfyToken}
            onCommit={setNtfyToken}
          />
        </>
      ) : null}
      {service !== "none" ? (
        <Stack gap={2}>
          <Row gap={2} align="center" shouldWrap>
            {isConfigured ? (
              <Chip text={t("notifications.configured")} />
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              text={t("notifications.sendTest")}
              isLoading={isBusy}
              isDisabled={!isConfigured}
              onClick={() =>
                void run(async () => {
                  setResults(null);
                  // The servers read the saved address and token.
                  await flushSettings("nt", "ct", "lt");
                  setResults(await sendTestPush(service));
                })
              }
            />
          </Row>
          {results?.map((result) => (
            <Text
              key={result.backend}
              variant="small"
              tone={result.error ? "danger" : "success"}
              role="status"
            >
              {result.error
                ? t("notifications.testFailed", {
                    backend: tCommon(`backends.${result.backend}`),
                    message: result.error,
                  })
                : t("notifications.testSent", {
                    backend: tCommon(`backends.${result.backend}`),
                  })}
            </Text>
          ))}
        </Stack>
      ) : null}
    </Section>
  );
}

function NutritionNotifications() {
  const { t } = useTranslation("settings");
  const weekdays = useWeekdays();
  const [isWater] = useShared<boolean>(["nt", "notifWaterReminders"]);
  const [isMeals] = useShared<boolean>(["nt", "notifMealReminders"]);
  const [isWeighIn] = useShared<boolean>(["nt", "notifWeighIn"]);
  const [isBedtime] = useShared<boolean>(["nt", "notifBedtime"]);
  const [isWindDown] = useShared<boolean>(["nt", "notifBedtimeWindDown"]);
  const [isWeekly] = useShared<boolean>(["nt", "notifWeeklySummary"]);
  const n = (key: string) => t(`notifications.nutrition.${key as "water"}`);
  const minutes = (value: number) => ({
    value,
    label: t("units.minutes", { count: value }),
  });

  return (
    <Section title={t("groups.nutrition")}>
      <Toggle setting={["nt", "notifWaterReminders"]} label={n("water")} />
      {isWater ? (
        <NumberChoice
          setting={["nt", "notifWaterInterval"]}
          label={n("waterInterval")}
          options={[60, 90, 120, 180].map(minutes)}
        />
      ) : null}
      <Toggle setting={["nt", "notifMealReminders"]} label={n("meals")} />
      {isMeals ? <MealTimes /> : null}
      <Toggle setting={["nt", "notifWeighIn"]} label={n("weighIn")} />
      {isWeighIn ? (
        <TimeSetting
          setting={["nt", "notifWeighInTime"]}
          label={n("weighInTime")}
        />
      ) : null}
      <Toggle setting={["nt", "notifBedtime"]} label={n("bedtime")} />
      {isBedtime ? (
        <>
          <TimeSetting
            setting={["nt", "notifBedtimeTime"]}
            label={n("bedtimeTime")}
          />
          <Toggle
            setting={["nt", "notifBedtimeWindDown"]}
            label={n("windDown")}
          />
          {isWindDown ? (
            <NumberChoice
              setting={["nt", "notifBedtimeWindDownMin"]}
              label={n("windDownBefore")}
              options={[15, 30, 45, 60, 90].map(minutes)}
            />
          ) : null}
          <Toggle
            setting={["nt", "notifBedtimeSmart"]}
            label={n("bedtimeSmart")}
          />
        </>
      ) : null}
      <Toggle
        setting={["nt", "notifGoalCelebrations"]}
        label={n("goalCelebrations")}
      />
      <Toggle setting={["nt", "notifStepGoal"]} label={n("stepGoal")} />
      <Toggle
        setting={["nt", "notifWellnessAlerts"]}
        label={n("wellnessAlerts")}
      />
      <Toggle
        setting={["nt", "notifWorkoutSummary"]}
        label={n("workoutSummary")}
      />
      <Toggle setting={["nt", "notifSyncFailures"]} label={n("syncFailures")} />
      <Toggle setting={["nt", "notifWeeklySummary"]} label={n("weekly")} />
      {isWeekly ? (
        <>
          <NumberChoice
            setting={["nt", "weeklySummaryDay"]}
            label={t("notifications.weeklyDay")}
            options={weekdays}
          />
          <TimeSetting
            setting={["nt", "weeklySummaryTime"]}
            label={t("notifications.weeklyTime")}
          />
        </>
      ) : null}
    </Section>
  );
}

function CookingNotifications() {
  const { t } = useTranslation("settings");
  const [isExpiry] = useShared<boolean>(["ct", "notifExpiryEnabled"]);
  const c = (key: string) => t(`notifications.cooking.${key as "cookDay"}`);
  return (
    <Section title={t("groups.cooking")}>
      <Toggle setting={["ct", "notifCookDayReminder"]} label={c("cookDay")} />
      <Toggle setting={["ct", "notifThawAlert"]} label={c("thaw")} />
      <Toggle setting={["ct", "notifShoppingNudge"]} label={c("shopping")} />
      <Toggle setting={["ct", "notifRecipeComments"]} label={c("comments")} />
      <Toggle
        setting={["ct", "notifWeeklySummary"]}
        label={c("weekly")}
        hint={c("weeklyHint")}
      />
      <Toggle setting={["ct", "notifExpiryEnabled"]} label={c("expiry")} />
      {isExpiry ? (
        <>
          <NumberChoice
            setting={["ct", "notifExpiryDaysBefore"]}
            label={c("expiryDays")}
            options={[1, 3, 5, 7, 14].map((value) => ({
              value,
              label: t("units.days", { count: value }),
            }))}
          />
          <TimeSetting
            setting={["ct", "notifExpiryTime"]}
            label={c("expiryTime")}
          />
        </>
      ) : null}
    </Section>
  );
}

function TrainingNotifications() {
  const { t } = useTranslation("settings");
  const weekdays = useWeekdays();
  const user = useBackendUser("lt");
  const coaching = useLoad(
    () => api.lt.get<CoachingState>("/coaching/state"),
    [],
  );
  const [service] = useShared<string>(["lt", "notifPushService"]);
  const [isLocal] = useShared<boolean>(["lt", "notifLocalEnabled"]);
  const [isReminder] = useShared<boolean>(["lt", "notifWorkoutReminder"]);
  const [isStreak] = useShared<boolean>(["lt", "notifStreakAlert"]);
  const [isMessage] = useShared<boolean>(["lt", "notifCoachMessage"]);
  const [isWeekly] = useShared<boolean>(["lt", "notifWeeklySummary"]);
  const isCoach = user?.role === "trainer" || user?.role === "admin";
  const isCoached = isInCoaching(coaching.data);
  const hasCoachTab = showsCoachTab(coaching.data);
  const r = (key: string) => t(`notifications.training.${key as "reminder"}`);

  return (
    <>
      <Section title={t("groups.training")}>
        {isLocal || service !== "none" ? (
          <>
            <Toggle
              setting={["lt", "notifWorkoutReminder"]}
              label={r("reminder")}
            />
            {isReminder ? (
              <TimeSetting
                setting={["lt", "notifWorkoutTime"]}
                label={r("reminderTime")}
              />
            ) : null}
            <Toggle setting={["lt", "notifRestDay"]} label={r("restDay")} />
            <Toggle setting={["lt", "notifStreakAlert"]} label={r("streak")} />
            {isStreak ? (
              <TimeSetting
                setting={["lt", "notifStreakTime"]}
                label={r("streakTime")}
              />
            ) : null}
          </>
        ) : null}
        <Toggle
          setting={["lt", "notifWorkoutComplete"]}
          label={r("complete")}
        />
        <Toggle setting={["lt", "notifPRCelebrations"]} label={r("records")} />
        <Toggle setting={["lt", "notifCoachFeedback"]} label={r("feedback")} />
        <Toggle setting={["lt", "notifWeeklySummary"]} label={r("weekly")} />
        {isWeekly ? (
          <>
            <NumberChoice
              setting={["lt", "weeklySummaryDay"]}
              label={t("notifications.weeklyDay")}
              options={weekdays}
            />
            <TimeSetting
              setting={["lt", "weeklySummaryTime"]}
              label={t("notifications.weeklyTime")}
            />
          </>
        ) : null}
      </Section>
      {isCoach || isCoached ? (
        <Section title={t("notifications.training.coaching")}>
          {isCoached ? (
            <>
              <Toggle
                setting={["lt", "notifCoachMessage"]}
                label={r("coachMessage")}
              />
              {isMessage ? (
                <Toggle
                  setting={["lt", "notifCoachMessageEmail"]}
                  label={r("coachMessageEmail")}
                />
              ) : null}
            </>
          ) : null}
          {isCoached && hasCoachTab ? (
            <Toggle
              setting={["lt", "notifCoachRecommendation"]}
              label={r("recommendation")}
            />
          ) : null}
          {isCoach && isCoached ? (
            <Toggle
              setting={["lt", "notifClientAnswer"]}
              label={r("clientAnswer")}
            />
          ) : null}
          {isCoach ? (
            <>
              <Toggle
                setting={["lt", "notifMemberCompletes"]}
                label={r("memberCompletes")}
              />
              <Toggle
                setting={["lt", "notifMemberMissed"]}
                label={r("memberMissed")}
              />
              <Toggle
                setting={["lt", "notifMemberReply"]}
                label={r("memberReply")}
              />
            </>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}

export function NotificationsPage() {
  const { t } = useTranslation("settings");
  const [service] = useShared<string>(["nt", "notifPushService"]);
  const [isLocal] = useShared<boolean>(["nt", "notifLocalEnabled"]);

  return (
    <SettingsScreen
      title={t("topics.notifications.title")}
      description={t("notifications.description")}
      backends={["nt", "ct", "lt"]}
    >
      <Channels />
      {isLocal || service !== "none" ? (
        <>
          <NutritionNotifications />
          <CookingNotifications />
        </>
      ) : (
        <Text tone="muted">{t("notifications.noChannel")}</Text>
      )}
      <TrainingNotifications />
    </SettingsScreen>
  );
}
