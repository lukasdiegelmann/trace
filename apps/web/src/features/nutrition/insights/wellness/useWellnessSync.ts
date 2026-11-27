import { useToast } from "@monocircuit/monolithium/components";
import { useCallback, useState } from "react";

import { ApiError } from "@/api";

import { checkWellnessGoals } from "../../lib/goalChecks";
import { localDateStr } from "../../lib/insights/dates";
import { syncFrom } from "../../lib/insights/wellness";
import { syncFitbit, syncProvider, syncWorkouts } from "../api";
import type { InsightSettings } from "../useNtSettings";
import { useInsightsT } from "../useInsightsT";
import { readLastSync, startCooldown, writeLastSync } from "./lastSync";

export type SyncProviderId = "fitbit" | "garmin" | "withings";

const PROVIDER_NAMES: Record<SyncProviderId, string> = {
  fitbit: "Fitbit",
  garmin: "Garmin",
  withings: "Withings",
};

/** Workouts reach back this many days when `wellnessSyncRange` is unset */
const DEFAULT_WORKOUT_RANGE = 7;

/** A provider that answers like this has lost its grant */
function isRevoked(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    /revoked|not connected/i.test(message) ||
    (error instanceof ApiError && error.status === 401)
  );
}

export interface SyncOptions {
  /** Auto-sync: one day, no messages */
  isSilent?: boolean;
}

/**
 * The sync buttons of the Wellness page (Wellness.svelte sync, syncGarmin,
 * syncWithings, syncWorkouts): a manual sync reaches back the provider's
 * sync range from the shown day.
 */
export function useWellnessSync(
  date: string,
  settings: InsightSettings,
  onSynced: () => void,
) {
  const { t } = useInsightsT();
  const toast = useToast();
  const { values } = settings;
  const [syncing, setSyncing] = useState<SyncProviderId[]>([]);
  const [revoked, setRevoked] = useState<SyncProviderId[]>([]);
  const [lastSync, setLastSync] = useState(readLastSync);

  const workoutRange = values.wellnessSyncRange || DEFAULT_WORKOUT_RANGE;
  const hasWorkouts = values.workoutsEnabled;
  const syncWorkoutHistory = useCallback(async () => {
    if (!hasWorkouts) return;
    try {
      await syncWorkouts(syncFrom(date, workoutRange), date);
      onSynced();
    } catch {
      // Workouts are a bonus to the metrics: a failure stays quiet.
    }
  }, [date, hasWorkouts, workoutRange, onSynced]);

  const ranges: Record<SyncProviderId, number> = {
    fitbit: values.wellnessSyncRange || 1,
    garmin: values.garminSyncRange || 1,
    withings: values.withingsSyncRange || 1,
  };
  const { fitbit: fitbitRange, garmin: garminRange } = ranges;
  const withingsRange = ranges.withings;

  const sync = useCallback(
    async (provider: SyncProviderId, options: SyncOptions = {}) => {
      const isSilent = options.isSilent ?? false;
      const range = {
        fitbit: fitbitRange,
        garmin: garminRange,
        withings: withingsRange,
      }[provider];
      setSyncing((current) => [...current, provider]);
      try {
        let message: string;
        if (provider === "fitbit") {
          const isRange = !isSilent && range > 1;
          const result = await syncFitbit(
            isRange ? { from: syncFrom(date, range), to: date } : { date },
          );
          startCooldown(date);
          message = !isRange
            ? t("wellness.sync.done")
            : t(
                result.rateLimited
                  ? "wellness.sync.rateLimited"
                  : "wellness.sync.days",
                { count: result.synced ?? 0 },
              );
        } else {
          const from = isSilent ? date : syncFrom(date, range);
          const result = await syncProvider(provider, { from, to: date });
          startCooldown(date);
          message = t("wellness.sync.daysFrom", {
            count:
              (provider === "withings" ? result.dates : result.synced) ?? 0,
            provider: PROVIDER_NAMES[provider],
          });
        }
        setLastSync(writeLastSync(PROVIDER_NAMES[provider]));
        // A sync of the shown day reaches today only when that is today
        if (date === localDateStr()) {
          void checkWellnessGoals().catch(() => {});
        }
        if (!isSilent) toast.info(message);
      } catch (error) {
        if (!isSilent) {
          if (isRevoked(error)) {
            setRevoked((current) => [...current, provider]);
            toast.error(
              t("wellness.sync.revoked", {
                provider: PROVIDER_NAMES[provider],
              }),
            );
          } else {
            toast.error(
              t("wellness.sync.failed", {
                provider: PROVIDER_NAMES[provider],
                message: (error as Error).message,
              }),
            );
          }
        }
      }
      setSyncing((current) => current.filter((p) => p !== provider));
      onSynced();
      if (provider === "fitbit") void syncWorkoutHistory();
    },
    [
      date,
      fitbitRange,
      garminRange,
      withingsRange,
      t,
      toast,
      onSynced,
      syncWorkoutHistory,
    ],
  );

  return { sync, syncWorkoutHistory, syncing, revoked, lastSync };
}
