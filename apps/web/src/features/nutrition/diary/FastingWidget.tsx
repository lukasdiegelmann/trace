import {
  Box,
  Button,
  DatePicker,
  Input,
  Meter,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { CheckCircle2, Pencil, Timer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { fastsApi, settingsApi, type Fast } from "../api";
import { useConfirm } from "../components/confirm";
import { DecimalField } from "../components/DecimalField";
import { RowMenu } from "../components/RowMenu";
import { useNotify } from "../components/useNotify";
import { localDateStr } from "../lib/dates";
import { parsePositive } from "../lib/decimal";
import { notifyDevice } from "../lib/notify";
import { timeOfDay } from "../lib/diary";
import {
  elapsedMs,
  FASTING_PRESETS,
  hoursAndMinutes,
  MAX_CUSTOM_PRESETS,
  scheduleDecision,
  startEditError,
} from "../lib/fasting";
import { setNtSetting, useNtSettings } from "../settings";
import { useNutritionFormat } from "../useNutritionFormat";
import { useResource } from "../useResource";

function useNow(isRunning: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [isRunning]);
  return now;
}

/** The fast already announced; outlives the day views, which remount */
let announcedFast: number | null = null;

/** "3 hours ago" in the UI language */
function timeAgo(iso: string, locale: string, now: Date): string {
  const minutes = Math.round((new Date(iso).getTime() - now.getTime()) / 60000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return format.format(hours, "hour");
  return format.format(Math.round(hours / 24), "day");
}

export function FastingWidget() {
  const { settings, isLoaded } = useNtSettings();
  const notify = useNotify();
  const { t } = useTranslation("nutrition");
  const fasting = useResource("fasting", async () => {
    const [active, history] = await Promise.all([
      fastsApi.active(),
      fastsApi.history(),
    ]);
    return { active: active?.id ? active : null, history };
  });
  const { data, reload } = fasting;

  const start = useCallback(
    async (hours: number) => {
      try {
        await fastsApi.start(hours);
        notify.success(t("diary.fasting.startedToast", { hours }));
        reload();
        return true;
      } catch (caught) {
        notify.failure(caught);
        reload();
        return false;
      }
    },
    [notify, reload, t],
  );

  // The auto-start schedule, checked on arrival and when the tab comes back
  const hasActive = Boolean(data?.active);
  const isReady = isLoaded && data !== null;
  useEffect(() => {
    if (!isReady) return;
    const check = () => {
      const decision = scheduleDecision(
        {
          isEnabled: settings.fastingScheduleEnabled,
          time: settings.fastingScheduleTime,
          days: settings.fastingScheduleDays,
          lastFired: settings.fastingScheduleLastFired,
        },
        hasActive,
      );
      if (decision.action === "none") return;
      // Remembered first, so a second check can't start a second fast
      setNtSetting("fastingScheduleLastFired", decision.day);
      if (decision.action === "start") {
        void start(settings.fastingScheduleGoal || 16);
      }
    };
    check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    isReady,
    hasActive,
    start,
    settings.fastingScheduleEnabled,
    settings.fastingScheduleTime,
    settings.fastingScheduleDays,
    settings.fastingScheduleLastFired,
    settings.fastingScheduleGoal,
  ]);

  if (!data) return null;
  return (
    <section aria-label={t("diary.fasting.title")}>
      <Box surface="surface" border="all" radius="lg" padding={3}>
        {data.active ? (
          <ActiveFast fast={data.active} onChanged={reload} />
        ) : (
          <IdleFast
            last={data.history.find((fast) => fast.end_at) ?? null}
            onStart={start}
          />
        )}
      </Box>
    </section>
  );
}

function IdleFast({
  last,
  onStart,
}: {
  last: Fast | null;
  onStart: (hours: number) => Promise<boolean>;
}) {
  const { t } = useTranslation("nutrition");
  const { settings, set } = useNtSettings();
  const format = useNutritionFormat();
  const confirm = useConfirm();
  const [selected, setSelected] = useState<number | null>(null);
  const [customHours, setCustomHours] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [menu, setMenu] = useState<number | null>(null);
  const [now] = useState(() => new Date());
  const hours =
    customHours !== null
      ? parsePositive(customHours)
      : (selected ?? settings.fastingDefaultHours);
  const presets = settings.fastingCustomPresets;

  const choose = (value: number) => {
    setSelected(value);
    setCustomHours(null);
  };

  return (
    <Stack gap={3}>
      <Row gap={2} align="center">
        <Timer aria-hidden size={18} />
        <Text variant="heading" as="h2">
          {t("diary.fasting.title")}
        </Text>
      </Row>
      {last?.end_at && (
        <Text variant="caption">
          {t("diary.fasting.last", {
            hours: format.number(
              elapsedMs(last.start_at, new Date(last.end_at)) / 3600000,
              1,
            ),
            ago: timeAgo(last.end_at, format.locale, now),
          })}
        </Text>
      )}
      <Row gap={2} shouldWrap align="center">
        {FASTING_PRESETS.map((preset) => (
          <Button
            key={preset.name}
            size="sm"
            variant="secondary"
            text={preset.name}
            aria-pressed={customHours === null && hours === preset.hours}
            isActive={customHours === null && hours === preset.hours}
            onClick={() => {
              choose(preset.hours);
            }}
          />
        ))}
        {presets.map((preset, index) => (
          <Row gap={0} align="center" key={`${preset.name}-${index}`}>
            <Button
              size="sm"
              variant="secondary"
              text={preset.name}
              onClick={() => {
                choose(preset.hours);
              }}
            />
            <RowMenu
              label={t("diary.fasting.presetActions", { name: preset.name })}
              isOpen={menu === index}
              onOpenChange={(isOpen) => {
                setMenu(isOpen ? index : null);
              }}
              items={[
                {
                  id: "remove",
                  text: t("diary.fasting.removePreset"),
                  tone: "danger",
                  onSelect: () => {
                    void confirm({
                      title: t("diary.fasting.removePresetTitle", {
                        name: preset.name,
                      }),
                      confirmText: t("common.remove"),
                      isDangerous: true,
                    }).then((isConfirmed) => {
                      if (!isConfirmed) return;
                      set(
                        "fastingCustomPresets",
                        presets.filter((_, i) => i !== index),
                      );
                    });
                  },
                },
              ]}
            />
          </Row>
        ))}
        <Button
          size="sm"
          text={t("diary.fasting.custom")}
          aria-expanded={customHours !== null}
          onClick={() => {
            setCustomHours(customHours === null ? String(hours ?? 16) : null);
          }}
        />
      </Row>
      {customHours !== null && (
        <Stack gap={2}>
          <DecimalField
            label={t("diary.fasting.hours")}
            value={customHours}
            onChange={setCustomHours}
          />
          {presets.length < MAX_CUSTOM_PRESETS && (
            <Row gap={2} align="end">
              <div className="min-w-0 flex-1">
                <Input
                  label={t("diary.fasting.presetName")}
                  value={presetName}
                  onValueChange={setPresetName}
                  maxLength={20}
                  fieldSize="lg"
                />
              </div>
              <Button
                size="lg"
                variant="secondary"
                text={t("diary.fasting.savePreset")}
                isDisabled={!presetName.trim() || hours === null}
                onClick={() => {
                  if (!presetName.trim() || hours === null) return;
                  set("fastingCustomPresets", [
                    ...presets,
                    { name: presetName.trim(), hours },
                  ]);
                  setPresetName("");
                }}
              />
            </Row>
          )}
        </Stack>
      )}
      <Button
        variant="primary"
        size="md"
        text={t("diary.fasting.start")}
        isDisabled={hours === null}
        onClick={() => {
          if (hours === null) return;
          set("fastingDefaultHours", hours);
          void onStart(hours);
        }}
      />
    </Stack>
  );
}

function ActiveFast({
  fast,
  onChanged,
}: {
  fast: Fast;
  onChanged: () => void;
}) {
  const { t } = useTranslation("nutrition");
  const format = useNutritionFormat();
  const confirm = useConfirm();
  const notify = useNotify();
  const now = useNow(true);
  const [edit, setEdit] = useState<{ date: string; time: string } | null>(null);

  const elapsed = elapsedMs(fast.start_at, now);
  const goalMs = fast.goal_hours * 3600000;
  const isReached = elapsed >= goalMs;
  const { settings } = useNtSettings();
  const shouldNotify = settings.fastingNotifyOnGoal;
  const hasLocalNotifications = settings.notifLocalEnabled;
  const pushService = settings.notifPushService;
  useEffect(() => {
    if (!isReached || !shouldNotify || announcedFast === fast.id) return;
    announcedFast = fast.id;
    void notifyDevice(
      t("diary.fasting.notifyTitle"),
      t("diary.fasting.notifyBody", { hours: fast.goal_hours }),
      { hasLocal: hasLocalNotifications, pushService },
      settingsApi.push,
    );
  }, [
    isReached,
    shouldNotify,
    hasLocalNotifications,
    pushService,
    fast.id,
    fast.goal_hours,
    t,
  ]);
  const { hours, minutes } = hoursAndMinutes(elapsed);
  const stamp = (date: Date) =>
    `${format.date(localDateStr(date))}, ${format.time(date)}`;

  const end = async () => {
    const isConfirmed = await confirm({
      title: t("diary.fasting.endTitle"),
      description: t("diary.fasting.endText", { hours, minutes }),
      confirmText: t("diary.fasting.end"),
    });
    if (!isConfirmed) return;
    try {
      await fastsApi.end(fast.id);
      notify.success(t("diary.fasting.endedToast"));
    } catch (caught) {
      notify.failure(caught);
    }
    onChanged();
  };

  const editedStart = edit ? new Date(`${edit.date}T${edit.time}:00`) : null;
  const editError = editedStart ? startEditError(editedStart, now) : null;
  const saveStart = async () => {
    if (!editedStart || editError) return;
    try {
      await fastsApi.update(fast.id, { start_at: editedStart.toISOString() });
      setEdit(null);
    } catch (caught) {
      notify.failure(caught);
    }
    onChanged();
  };

  return (
    <Stack gap={3}>
      <Row gap={2} align="center">
        {isReached ? (
          <CheckCircle2 aria-hidden size={18} />
        ) : (
          <Timer aria-hidden size={18} />
        )}
        <Text variant="heading" as="h2">
          {t(isReached ? "diary.fasting.reached" : "diary.fasting.running", {
            hours,
            minutes,
          })}
        </Text>
      </Row>
      <Row gap={2} shouldWrap align="center">
        <Text variant="caption">
          {t("diary.fasting.started", {
            time: stamp(new Date(fast.start_at)),
          })}
        </Text>
        <Button
          size="sm"
          aria-label={t("diary.fasting.editStart")}
          onClick={() => {
            setEdit({
              date: localDateStr(new Date(fast.start_at)),
              time: timeOfDay(fast.start_at),
            });
          }}
        >
          <Pencil aria-hidden size={14} />
        </Button>
        <Text variant="caption">
          {`${t("diary.fasting.goal", { hours: fast.goal_hours })} · ${t(
            "diary.fasting.target",
            {
              time: stamp(new Date(new Date(fast.start_at).getTime() + goalMs)),
            },
          )}`}
        </Text>
      </Row>
      {edit && (
        <Stack gap={2}>
          <Row gap={2} shouldWrap align="end">
            <DatePicker
              label={t("diary.fasting.startDate")}
              value={edit.date}
              onChange={(date) => {
                if (date) setEdit({ ...edit, date });
              }}
              maxDate={localDateStr(now)}
              format={format.date}
            />
            {/* TODO(monolithium): a time picker */}
            <Input
              type="time"
              label={t("diary.fasting.startTime")}
              value={edit.time}
              onValueChange={(time) => {
                setEdit({ ...edit, time });
              }}
              fieldSize="lg"
            />
          </Row>
          {editError && (
            <Text variant="small" tone="danger" role="alert">
              {t(`diary.fasting.errors.${editError}`)}
            </Text>
          )}
          <Row gap={2} justify="end">
            <Button
              size="sm"
              text={t("common.cancel")}
              onClick={() => {
                setEdit(null);
              }}
            />
            <Button
              size="sm"
              variant="primary"
              text={t("common.save")}
              isDisabled={editError !== null}
              onClick={() => void saveStart()}
            />
          </Row>
        </Stack>
      )}
      <Meter
        ariaLabel={t("diary.fasting.progress")}
        value={Math.min(elapsed, goalMs)}
        max={Math.max(1, goalMs)}
      />
      <Button
        variant="secondary"
        size="md"
        text={t("diary.fasting.end")}
        onClick={() => void end()}
      />
    </Stack>
  );
}
