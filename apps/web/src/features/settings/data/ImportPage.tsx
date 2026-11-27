import { Row, SegmentedControl } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import type { BackendId } from "@/api";

import { Section, SettingsScreen } from "../common/SettingsScreen";
import { useAppParam } from "../common/useAppParam";
import { NutritionFiles } from "./NutritionFiles";
import { NutritionImport } from "./NutritionImport";
import { RecipeImport } from "./RecipeImport";
import { WorkoutImport } from "./WorkoutImport";

const TABS = [
  ["nt", "groups.nutrition"],
  ["ct", "groups.cooking"],
  ["lt", "groups.training"],
] as const;

export function ImportPage() {
  const { t } = useTranslation("settings");
  const [tab, setTab] = useAppParam();
  return (
    <SettingsScreen
      title={t("topics.import.title")}
      description={t("importExport.description")}
    >
      <Row>
        <SegmentedControl<BackendId>
          aria-label={t("topics.import.title")}
          options={TABS.map(([value, key]) => ({ value, label: t(key) }))}
          value={tab}
          onChange={setTab}
        />
      </Row>
      {tab === "nt" ? (
        <>
          <NutritionFiles />
          <Section title={t("importExport.apps.title")}>
            <NutritionImport />
          </Section>
        </>
      ) : null}
      {tab === "ct" ? (
        <Section title={t("importExport.recipes.title")}>
          <RecipeImport />
        </Section>
      ) : null}
      {tab === "lt" ? (
        <Section title={t("importExport.workouts.title")}>
          <WorkoutImport />
        </Section>
      ) : null}
    </SettingsScreen>
  );
}
