import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import {
  DEFAULT_NAMESPACE,
  resources,
  SUPPORTED_LANGUAGES,
  type Language,
} from "./resources";

export { SUPPORTED_LANGUAGES, type Language } from "./resources";

export const LANGUAGE_STORAGE_KEY = "trace.language";

function isLanguage(value: string | null | undefined): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

/** The stored choice, else the browser's first supported language, else German */
export function detectLanguage(
  stored: string | null,
  browserLanguages: readonly string[],
): Language {
  if (isLanguage(stored)) return stored;
  for (const tag of browserLanguages) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLanguage(base)) return base;
  }
  return "de";
}

function readStoredLanguage(): string | null {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  void i18next.changeLanguage(language);
}

export const i18n = i18next;

void i18next.use(initReactI18next).init({
  resources,
  lng: detectLanguage(readStoredLanguage(), navigator.languages),
  fallbackLng: "en",
  supportedLngs: SUPPORTED_LANGUAGES,
  defaultNS: DEFAULT_NAMESPACE,
  ns: Object.keys(resources.en),
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

i18next.on("languageChanged", (language) => {
  document.documentElement.lang = language;
});
document.documentElement.lang = i18next.language;
