/**
 * Every namespace with its German and English strings. A feature adds its
 * own `locales/{de,en}.json` and registers them here under its name.
 */
import authDe from "@/auth/locales/de.json";
import authEn from "@/auth/locales/en.json";
import assistantDe from "@/features/assistant/locales/de.json";
import assistantEn from "@/features/assistant/locales/en.json";
import cookingDe from "@/features/cooking/locales/de.json";
import cookingEn from "@/features/cooking/locales/en.json";
import nutritionDe from "@/features/nutrition/locales/de.json";
import nutritionEn from "@/features/nutrition/locales/en.json";
import settingsDe from "@/features/settings/locales/de";
import settingsEn from "@/features/settings/locales/en";
import {
  trainingDiaryDe,
  trainingDiaryEn,
} from "@/features/training/diary/locales";
import trainingDe from "@/features/training/locales/de.json";
import trainingEn from "@/features/training/locales/en.json";
import { trainingAreasDe, trainingAreasEn } from "@/features/training/locales";

import commonDe from "./locales/de.json";
import commonEn from "./locales/en.json";

export const SUPPORTED_LANGUAGES = ["de", "en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** English is the reference: its keys are the types, German must match */
export const resources = {
  en: {
    common: commonEn,
    auth: authEn,
    assistant: assistantEn,
    nutrition: nutritionEn,
    cooking: cookingEn,
    training: {
      ...trainingEn,
      ...trainingAreasEn,
      ...trainingDiaryEn,
    },
    settings: settingsEn,
  },
  de: {
    common: commonDe,
    auth: authDe,
    assistant: assistantDe,
    nutrition: nutritionDe,
    cooking: cookingDe,
    training: {
      ...trainingDe,
      ...trainingAreasDe,
      ...trainingDiaryDe,
    },
    settings: settingsDe,
  },
} as const;

export const DEFAULT_NAMESPACE = "common";
