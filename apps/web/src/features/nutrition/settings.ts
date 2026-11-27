/**
 * A typed view of NutriTrace's settings on top of the shared store
 * (`@/features/shared/settings`): the generated definitions keep objects and
 * unions loose, these screens read them narrowed. A missing or `null` value
 * (never set, or an older shape) falls back to the old UI's default.
 */
/* eslint-disable @typescript-eslint/naming-convention -- the backend's keys */
import { useCallback, useEffect, useMemo } from "react";

import {
  settingsStores,
  useSettings,
  type NtSettings as StoredNtSettings,
} from "@/features/shared/settings";
import { ntDefaults } from "@/features/shared/settings/definitions/nt";

import type { Goals } from "./api";

export interface WaterContainer {
  id: string;
  name: string;
  volumeMl: number;
}

export interface FastingPreset {
  name: string;
  hours: number;
}

export interface GoalTemplate {
  id: number;
  name: string;
  createdAt: string;
  goals: Goals;
  /** Older templates may lack these two */
  waterGoalMl?: number;
  goalCount?: number;
}

export interface CustomUnit {
  abbr: string;
  full?: string;
}

export interface CustomNutriment {
  id: string;
  label: string;
  unit: string;
  category?: string;
}

export type FoodCategory = string | { name: string; label?: string };

/** The settings these screens read, with the types their values really have */
export interface NtSettings {
  energyUnit: "kcal" | "kJ";
  weightUnit: "kg" | "lb" | "st";
  heightUnit: "cm" | "ft";
  lengthUnit: "in" | "cm";
  distUnit: string;
  dateFormat: "ISO" | "US" | "EU" | "natural";
  timeFormat: "12h" | "24h";
  waterUnit: "ml" | "oz" | "L" | "G";
  bannerStyle: string;

  mealNames: string[];
  goals: Goals;
  goalTemplates: GoalTemplate[];
  calorieGoalMode: "fixed" | "dynamic" | "adaptive";
  calorieGoalFactor: number;
  waterGoalMl: number;
  waterContainers: WaterContainer[];
  waterShowInDiary: boolean;

  fastingEnabled: boolean;
  fastingDefaultHours: number;
  fastingNotifyOnGoal: boolean;
  fastingCustomPresets: FastingPreset[];
  fastingScheduleEnabled: boolean;
  fastingScheduleTime: string;
  fastingScheduleDays: number[];
  fastingScheduleGoal: number;
  fastingScheduleLastFired: string | null;

  diaryShowNutritionBar: boolean;
  diaryTotalsMode: "consumed" | "remaining";
  macroLegendMode: "percent" | "grams";
  diaryShowBrands: boolean;
  diaryShowTimestamps: boolean;
  diaryShowThumbnails: boolean;
  diaryShowAllNutrients: boolean;
  diaryShowNutritionUnits: boolean;
  diaryShowMacroSummary: boolean;
  diaryPromptQuantity: boolean;
  diaryShowPortionSize: boolean;
  diaryShowNotes: boolean;
  diaryShowCompletion: boolean;
  diaryDefaultField: "servings" | "portion";
  showUnitMetadata: boolean;
  warnUnitMismatch: boolean;
  showQuickCalories: boolean;
  quickCaloriesDisplay: "summed" | "separate";
  hiddenBodyStats: string[];
  bodyStatsOrder: string[];
  goalCelebrations: boolean;
  disableAnimations: boolean;
  forceMobileLayout: boolean;
  diaryRailShowSummary: boolean;
  diaryRailShowWater: boolean;
  diaryRailShowBodyStats: boolean;
  diaryRailShowActivity: boolean;
  diaryRailShowNotes: boolean;

  diaryShowActivity: boolean;
  manualActivityPolicy: "wearable_wins" | "manual_wins" | "additive";
  calorieAdjustFromActivity: boolean;

  visibleNutriments: string[] | null;
  nutrimentsOrder: string[];
  customNutriments: CustomNutriment[];
  customUnits: CustomUnit[];
  foodCategories: FoodCategory[];

  foodsShowCategories: boolean;
  foodsShowLabels: boolean;
  foodsShowNotes: boolean;
  foodsShowThumbnails: boolean;
  foodsShowYesterdayMeals: boolean;
  foodsYesterdayCollapsed: boolean;
  foodsSavedCollapsed: boolean;
  foodsSort: string;
  mealsSort: string;
  recipesSort: string;
  foodsDefaultSource: string;
  defaultShareVisibility: "private" | "group";
  barcodeBeep: boolean;
  barcodeFlashlight: boolean;
  cropPhotos: boolean;

  offEnabled: boolean;
  offSearchLanguage: string;
  offSearchCountry: string;
  offUploadCountry: string;
  offImportPortion: string;
  offUsername: string;
  offPassword: string;
  usdaEnabled: boolean;
  usdaApiKey: string;
  mealieEnabled: boolean;
  mealieBaseUrl: string;
  mealieApiToken: string;
  cooktraceEnabled: boolean;
  cooktraceBaseUrl: string;
  cooktraceApiToken: string;

  wellnessEnabled: boolean;
  fitbitEnabled: boolean;
  googleHealthEnabled: boolean;
  healthConnectEnabled: boolean;
  garminEnabled: boolean;
  notifMealReminders: boolean;
  notifLocalEnabled: boolean;
  notifPushService: string;
  weight_kg: number | null;
}

export type NtSettingKey = keyof NtSettings & keyof StoredNtSettings;

/** Keys the generated definitions leave `undefined` (no store upstream) */
const MISSING_DEFAULTS: Partial<NtSettings> = {
  mealieEnabled: false,
  mealieBaseUrl: "",
  mealieApiToken: "",
  cooktraceEnabled: false,
  cooktraceBaseUrl: "",
  cooktraceApiToken: "",
  weight_kg: null,
};

const NULLABLE = new Set<string>([
  "visibleNutriments",
  "fastingScheduleLastFired",
  "weight_kg",
]);

export function toNtSettings(values: StoredNtSettings): NtSettings {
  const out: Record<string, unknown> = { ...values };
  for (const [key, fallback] of Object.entries(ntDefaults)) {
    const value = out[key];
    if (value === undefined || (value === null && !NULLABLE.has(key))) {
      out[key] = fallback;
    } else if (Array.isArray(fallback) && !Array.isArray(value)) {
      out[key] = fallback;
    }
  }
  for (const [key, fallback] of Object.entries(MISSING_DEFAULTS)) {
    if (out[key] === undefined) out[key] = fallback;
  }
  return out as unknown as NtSettings;
}

export function setNtSetting<K extends NtSettingKey>(
  key: K,
  value: NtSettings[K],
): void {
  settingsStores.nt.set(key, value as unknown as StoredNtSettings[K]);
}

export interface NtSettingsValue {
  settings: NtSettings;
  /** The server has answered (or failed to) */
  isLoaded: boolean;
  set: typeof setNtSetting;
  reload: () => Promise<void>;
}

/** All settings: `const { settings, set } = useNtSettings()` */
export function useNtSettings(): NtSettingsValue {
  const { values, status, reload } = useSettings("nt");
  const settings = useMemo(() => toNtSettings(values), [values]);
  return {
    settings,
    isLoaded: status === "ready" || status === "error",
    set: setNtSetting,
    reload,
  };
}

/** One setting and its setter: `const [unit, setUnit] = useNtSetting("energyUnit")` */
export function useNtSetting<K extends NtSettingKey>(
  key: K,
): [NtSettings[K], (value: NtSettings[K]) => void] {
  const { settings } = useNtSettings();
  const setter = useCallback(
    (value: NtSettings[K]) => {
      setNtSetting(key, value);
    },
    [key],
  );
  return [settings[key], setter];
}

/** Asks the server again whenever the tab comes back, as the old PWA did */
export function useReloadSettingsOnReturn(): void {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void settingsStores.nt.reload();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
