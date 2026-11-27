/* eslint-disable @typescript-eslint/naming-convention -- LiftTrace's setting keys */
/**
 * The diary's view of LiftTrace's settings: the shared store
 * (`@/features/shared/settings`), with the narrower types of the values the
 * diary reads. The generated definitions only say `string` or `unknown`.
 */
import { useMemo } from "react";

import {
  settingsStores,
  useSettings,
  type LtSettings as SharedLtSettings,
} from "@/features/shared/settings";

import type { LoadType, SetType } from "../lib/workoutTypes";

export interface LtDiarySettings {
  weightUnit: "lbs" | "kg";
  dateFormat: "US" | "EU" | "ISO";
  screenKeepAwake: boolean;
  autoFillLastWeights: boolean;
  showCompletionSummary: boolean;
  exerciseReorderMethod: "drag" | "buttons" | "both";
  autoCollapseCompleted: boolean;
  autoNameWorkouts: boolean;
  confirmExerciseRemoval: boolean;
  autoGenerateWarmups: boolean;
  trackRpe: boolean;
  restTimerEnabled: boolean;
  restDuration: number;
  restAutoStart: boolean;
  restAlert: boolean;
  restAlertVibrate: boolean;
  restAlertTone: boolean;
  restAlertToneId: string;
  restPerExercise: Record<string, number>;
  exerciseLoadTypes: Record<string, LoadType | undefined>;
  exerciseSetTypes: Record<string, SetType | undefined>;
  bodyStatsVisible: string[];
  caloriesBurnedEnabled: boolean;
  heightCm: number | null;
  currentWeightKg: number | null;
  dob: string | null;
  gender: string | null;
  ntFederationEnabled: boolean;
  cardioEnabled: boolean;
  customEquipment: string[];
  notifLocalEnabled: boolean;
  notifPushService: string;
  notifWorkoutComplete: boolean;
  notifPRCelebrations: boolean;
}

export type LtSettingKey = keyof LtDiarySettings & keyof SharedLtSettings;

function asDiary(values: SharedLtSettings): LtDiarySettings {
  return values as unknown as LtDiarySettings;
}

/** The current values outside React (the old UI's `get(store)`) */
export function getLtSettings(): LtDiarySettings {
  return asDiary(settingsStores.lt.getSnapshot().values);
}

/** Shows the value at once and saves it debounced, as the old stores did */
export function setLtSetting<K extends LtSettingKey>(
  key: K,
  value: LtDiarySettings[K],
): void {
  settingsStores.lt.set(key, value as SharedLtSettings[K]);
}

/** The settings, loading them on first use and re-rendering on change */
export function useLtSettings(): LtDiarySettings {
  const { values } = useSettings("lt");
  return useMemo(() => asDiary(values), [values]);
}
