import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  readStartPage,
  setStartPage,
  START_PAGES,
  type StartPage,
} from "@/features/shared/startPage";
import { setLanguage, SUPPORTED_LANGUAGES, type Language } from "@/i18n";
import {
  setThemePreference,
  THEME_PREFERENCES,
  useThemePreference,
  type ThemePreference,
} from "@/theme/theme";

import { useShared, writeRef } from "../common/binding";
import { SegmentRow, SelectRow, SwitchRow } from "../common/fields";
import { Section, SettingsScreen } from "../common/SettingsScreen";

export function AppearancePage() {
  const { t, i18n } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const theme = useThemePreference();
  const [start, setStart] = useState(readStartPage);
  const [hasCelebrations, setCelebrations] = useShared<boolean>(
    ["nt", "goalCelebrations"],
    ["lt", "goalCelebrations"],
  );

  return (
    <SettingsScreen
      title={t("topics.appearance.title")}
      description={t("appearance.description")}
      backends={["nt", "ct", "lt"]}
    >
      <Section>
        <SegmentRow<ThemePreference>
          label={t("appearance.theme")}
          value={theme}
          options={THEME_PREFERENCES.map((value) => ({
            value,
            label: t(`appearance.themes.${value}`),
          }))}
          onChange={(value) => {
            setThemePreference(value);
            // Only LiftTrace syncs the theme; the others keep it per device.
            writeRef(["lt", "appearance"], value);
          }}
        />
        <SegmentRow<Language>
          label={t("appearance.language")}
          hint={t("appearance.languageHint")}
          value={i18n.language as Language}
          options={SUPPORTED_LANGUAGES.map((value) => ({
            value,
            label: t(`appearance.languages.${value}`),
          }))}
          onChange={(value) => {
            setLanguage(value);
            // The servers write notifications and AI prompts in it.
            writeRef(["nt", "language"], value);
            writeRef(["ct", "language"], value);
            writeRef(["lt", "language"], value);
          }}
        />
        <SelectRow<StartPage>
          label={t("appearance.startPage")}
          hint={t("appearance.startPageHint")}
          value={start}
          options={START_PAGES.map((value) => ({
            value,
            label: tCommon(
              `nav.${value.slice(1) as "nutrition" | "cooking" | "training" | "settings"}`,
            ),
          }))}
          onChange={(value) => {
            setStart(value);
            setStartPage(value);
          }}
        />
        <SwitchRow
          label={t("appearance.celebrations")}
          hint={t("appearance.celebrationsHint")}
          isChecked={hasCelebrations}
          onChange={setCelebrations}
        />
      </Section>
    </SettingsScreen>
  );
}
