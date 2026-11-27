import {
  Input,
  SegmentedControl,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";

import {
  clampDays,
  RECOMMENDED_SYNC_RANGES,
  SYNC_INTERVALS,
  SYNC_MODES,
  SYNC_RANGE_LIMITS,
  type SyncDevice,
} from "../../lib/insights/visibility";
import type { InsightSettings } from "../useNtSettings";
import { useInsightsT } from "../useInsightsT";

/** Daily "sync at" shows this until a time is picked */
const DEFAULT_SYNC_AT = "14:00";
const DAY_MINUTES = 1440;

type RangeKey = "wellnessSyncRange" | "garminSyncRange" | "withingsSyncRange";
const RANGE_KEYS: Record<keyof typeof SYNC_RANGE_LIMITS, RangeKey> = {
  fitbit: "wellnessSyncRange",
  garmin: "garminSyncRange",
  withings: "withingsSyncRange",
};

/** How many days a manual sync reaches back */
export function SyncRange({
  device,
  settings,
}: {
  device: keyof typeof SYNC_RANGE_LIMITS;
  settings: InsightSettings;
}) {
  const { t } = useInsightsT();
  const key = RANGE_KEYS[device];
  const range = settings.values[key];
  const { advanced, max } = SYNC_RANGE_LIMITS[device];
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) settings.set(key, clampDays(draft, max));
    setDraft(null);
  };

  return (
    <Stack gap={2}>
      <Text variant="label">{t("wellnessSettings.syncRange")}</Text>
      <Text variant="caption">{t("wellnessSettings.syncRangeHint")}</Text>
      <div className="min-w-0 overflow-x-auto">
        <SegmentedControl
          aria-label={t("wellnessSettings.syncRange")}
          value={range}
          onChange={(days) => {
            settings.set(key, days);
          }}
          options={[...RECOMMENDED_SYNC_RANGES, ...advanced].map((days) => ({
            value: days,
            label: `${t(`wellnessSettings.ranges.${days}`)}${days > 90 ? " ⚠" : ""}`,
          }))}
        />
      </div>
      <div className="w-40">
        <Input
          name={`${device}-range`}
          type="number"
          min={1}
          max={max}
          fieldSize="sm"
          label={t("wellnessSettings.customDays", { max })}
          value={draft ?? String(range)}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onBlur={commit}
          onEnter={commit}
        />
      </div>
      <Text variant="caption">
        {t(`wellnessSettings.rangeWarning.${device}`)}
      </Text>
    </Stack>
  );
}

/** Auto, manual or scheduled; scheduled with an interval and its times */
export function SyncSchedule({
  device,
  settings,
}: {
  device: SyncDevice;
  settings: InsightSettings;
}) {
  const { t } = useInsightsT();
  const { values, set } = settings;
  const modeKey = `${device}SyncMode` as const;
  const intervalKey = `${device}SyncInterval` as const;
  const startKey = `${device}SyncWindowStart` as const;
  const endKey = `${device}SyncWindowEnd` as const;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const mode = text(values[modeKey]) || "auto";
  const interval = Number(values[intervalKey]) || DAY_MINUTES;
  const start = text(values[startKey]);
  const end = text(values[endKey]);

  return (
    <Stack gap={2}>
      <Text variant="label">{t("wellnessSettings.syncMode")}</Text>
      <SegmentedControl
        aria-label={t("wellnessSettings.syncMode")}
        value={mode}
        onChange={(next) => {
          set(modeKey, next);
        }}
        options={SYNC_MODES.map((value) => ({
          value: value,
          label: t(`wellnessSettings.modes.${value}`),
        }))}
      />
      {mode === "scheduled" ? (
        <>
          <Text variant="label">{t("wellnessSettings.interval")}</Text>
          <div className="min-w-0 overflow-x-auto">
            <SegmentedControl
              aria-label={t("wellnessSettings.interval")}
              value={interval}
              onChange={(next) => {
                set(intervalKey, next);
              }}
              options={SYNC_INTERVALS.map((value) => ({
                value: value,
                label: t(`wellnessSettings.intervals.${value}`),
              }))}
            />
          </div>
          {/* TODO(monolithium): a time picker; the native time field until then. */}
          {interval >= DAY_MINUTES ? (
            <div className="w-40">
              <Input
                name={`${device}-sync-at`}
                type="time"
                fieldSize="sm"
                label={t("wellnessSettings.syncAt")}
                value={start || DEFAULT_SYNC_AT}
                onChange={(event) => {
                  set(startKey, event.target.value);
                  set(endKey, null);
                }}
              />
            </div>
          ) : (
            <Stack gap={2}>
              <Text variant="caption">
                {t("wellnessSettings.activeWindowHint")}
              </Text>
              <div className="flex flex-wrap gap-3">
                <div className="w-40">
                  <Input
                    name={`${device}-window-start`}
                    type="time"
                    fieldSize="sm"
                    label={t("wellnessSettings.windowStart")}
                    value={start}
                    onChange={(event) => {
                      set(startKey, event.target.value || null);
                    }}
                  />
                </div>
                <div className="w-40">
                  <Input
                    name={`${device}-window-end`}
                    type="time"
                    fieldSize="sm"
                    label={t("wellnessSettings.windowEnd")}
                    value={end}
                    onChange={(event) => {
                      set(endKey, event.target.value || null);
                    }}
                  />
                </div>
              </div>
            </Stack>
          )}
        </>
      ) : null}
    </Stack>
  );
}
