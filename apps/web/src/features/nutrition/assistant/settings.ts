/** The settings the assistant reads, outside React */
/* eslint-disable @typescript-eslint/naming-convention -- the stored keys */
import { settingsStores } from "@/features/shared/settings";

import { toNtSettings, type NtSettings } from "../settings";

/** The settings the old assistant reads beyond what the screens type */
export interface AssistantSettings extends NtSettings {
  tempUnit: string;
  activityAutoEstimate: boolean;
  aiGoalInsights: boolean;
  gender: unknown;
  dob: unknown;
  height_cm: unknown;
  target_weight: unknown;
  activity: unknown;
  localUserName: unknown;
  localUserNickname: unknown;
}

export async function loadAssistantSettings(): Promise<AssistantSettings> {
  await settingsStores.nt.ensureLoaded();
  return toNtSettings(
    settingsStores.nt.getSnapshot().values,
  ) as AssistantSettings;
}

/** A setting stored as a string; "" for anything else */
export function textSetting(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export const DEFAULT_MEAL_NAMES = ["Breakfast", "Lunch", "Dinner", "Snacks"];

export function mealNamesOf(settings: { mealNames: string[] }): string[] {
  return settings.mealNames.length > 0
    ? settings.mealNames
    : DEFAULT_MEAL_NAMES;
}
