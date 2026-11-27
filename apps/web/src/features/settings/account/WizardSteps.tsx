/** The steps of the setup assistant; each field saves as it is set */
import {
  Disclosure,
  KeyValue,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { setLanguage, SUPPORTED_LANGUAGES, type Language } from "@/i18n";
import {
  setThemePreference,
  THEME_PREFERENCES,
  useThemePreference,
  type ThemePreference,
} from "@/theme/theme";
import { PROVIDER_NAMES, readProvider } from "@/features/shared/ai";
import { requestNotificationPermission } from "@/features/shared/notifications";

import { useFirstSet, useShared, writeRef } from "../common/binding";
import { useEnvLocks } from "../common/envLocks";
import {
  CheckList,
  NumberRow,
  SecretRow,
  SegmentRow,
  SelectRow,
  TextRow,
} from "../common/fields";
import { BoundSecret, BoundSwitch, BoundText } from "../common/rows";
import { GENDERS, type Gender } from "../lib/body";
import { stringList } from "../lib/lists";
import type { UnitSystem } from "../lib/onboarding";
import { applyUnits } from "./applyUnits";
import { ActivityRow, HeightRow, WeightRow } from "./BodyData";

export function LookStep() {
  const { t, i18n } = useTranslation("settings");
  const theme = useThemePreference();
  return (
    <Stack gap={3}>
      <SegmentRow<Language>
        label={t("appearance.language")}
        value={i18n.language as Language}
        options={SUPPORTED_LANGUAGES.map((value) => ({
          value,
          label: t(`appearance.languages.${value}`),
        }))}
        onChange={(value) => {
          setLanguage(value);
          writeRef(["nt", "language"], value);
          writeRef(["ct", "language"], value);
          writeRef(["lt", "language"], value);
        }}
      />
      <SegmentRow<ThemePreference>
        label={t("appearance.theme")}
        value={theme}
        options={THEME_PREFERENCES.map((value) => ({
          value,
          label: t(`appearance.themes.${value}`),
        }))}
        onChange={(value) => {
          setThemePreference(value);
          writeRef(["lt", "appearance"], value);
        }}
      />
    </Stack>
  );
}

export function UnitsStep({
  system,
  onChange,
}: {
  system: UnitSystem | "";
  onChange: (system: UnitSystem) => void;
}) {
  const { t } = useTranslation("settings");
  return (
    <SegmentRow<UnitSystem | "">
      label={t("wizard.units")}
      hint={t("wizard.unitsHint")}
      value={system}
      options={(["metric", "imperial"] as const).map((value) => ({
        value,
        label: t(`regional.systems.${value}`),
      }))}
      onChange={(value) => {
        if (!value) return;
        applyUnits(value);
        onChange(value);
      }}
    />
  );
}

export function BodyStep() {
  const { t } = useTranslation("settings");
  const [gender, setGender] = useFirstSet<string>(
    ["nt", "gender"],
    ["lt", "gender"],
  );
  const [birthday, setBirthday] = useFirstSet<unknown>(
    ["nt", "dob"],
    ["lt", "dob"],
  );
  return (
    <Stack gap={3}>
      <SelectRow<Gender | "">
        label={t("profile.gender")}
        value={GENDERS.find((value) => value === gender) ?? ""}
        options={GENDERS.map((value) => ({
          value,
          label: t(`profile.genders.${value}`),
        }))}
        onChange={setGender}
      />
      <TextRow
        type="date"
        label={t("profile.birthday")}
        value={typeof birthday === "string" ? birthday : ""}
        onCommit={setBirthday}
      />
      <HeightRow />
      <WeightRow keyName="weight" />
      <WeightRow keyName="targetWeight" />
      <ActivityRow />
    </Stack>
  );
}

export function TrainingStep() {
  const { t } = useTranslation("settings");
  const [weekly, setWeekly] = useShared<number>(["lt", "weeklyWorkoutGoal"]);
  return (
    <SelectRow<number>
      label={t("training.weeklyGoal")}
      value={weekly}
      options={[2, 3, 4, 5, 6, 7].map((value) => ({
        value,
        label: t("training.workoutsPerWeek", { count: value }),
      }))}
      onChange={setWeekly}
    />
  );
}

const DIETS = ["vegetarian", "vegan", "glutenFree", "dairyFree"] as const;

export function CookingStep() {
  const { t } = useTranslation("settings");
  const [servings, setServings] = useShared<number>(["ct", "defaultServings"]);
  const [diet, setDiet] = useShared<unknown>(["ct", "dietaryPrefs"]);
  return (
    <Stack gap={3}>
      <NumberRow
        label={t("cooking.defaultServings")}
        value={servings}
        min={1}
        max={20}
        fallback={2}
        isInteger
        onCommit={setServings}
      />
      <CheckList<string>
        label={t("wizard.diet")}
        options={DIETS.map((value) => ({
          value,
          label: t(`wizard.diets.${value}`),
        }))}
        values={stringList(diet)}
        onChange={setDiet}
      />
    </Stack>
  );
}

const CLOUD_PROVIDERS = ["claude", "openai", "gemini"] as const;
const APPS = ["nt", "ct", "lt"] as const;

/**
 * The assistant's key. It goes to the settings the assistant reads (the old
 * wizard wrote NutriTrace's server config, which only an env lock uses).
 */
function AiCard() {
  const { t } = useTranslation("settings");
  const locks = useEnvLocks("nt");
  const [provider, setProvider] = useShared<string>(
    ["nt", "aiProvider"],
    ["ct", "aiProvider"],
    ["lt", "aiProvider"],
  );
  const [key] = useShared<string>(["nt", "aiApiKey"]);
  const save = (value: string) => {
    for (const app of APPS) {
      writeRef([app, "aiApiKey"], value);
      writeRef([app, "aiKeyVerified"], false);
      if (value) writeRef([app, "aiEnabled"], true);
    }
  };
  return (
    <Disclosure title={t("topics.assistant.title")}>
      {locks.data?.ai ? (
        <Text variant="small">{t("assistant.envLocked")}</Text>
      ) : (
        <Stack gap={3}>
          <SelectRow<string>
            label={t("assistant.provider")}
            value={readProvider(provider)}
            options={CLOUD_PROVIDERS.map((value) => ({
              value,
              label: PROVIDER_NAMES[value],
            }))}
            onChange={(next) => {
              setProvider(next);
              for (const app of APPS) writeRef([app, "aiModel"], "");
            }}
          />
          <SecretRow
            label={t("assistant.apiKey")}
            value={key}
            onCommit={save}
          />
        </Stack>
      )}
    </Disclosure>
  );
}

export function ServicesStep() {
  const { t } = useTranslation("settings");
  const [isLocal] = useShared<boolean>(["nt", "notifLocalEnabled"]);
  return (
    <Stack gap={3}>
      <Disclosure title="Open Food Facts">
        <Stack gap={3}>
          <BoundSwitch
            refs={[
              ["nt", "offEnabled"],
              ["ct", "offEnabled"],
            ]}
            label={t("sources.offEnabled")}
          />
          <BoundText
            refs={[
              ["nt", "offUsername"],
              ["ct", "offUsername"],
            ]}
            label={t("sources.offUsername")}
            hint={t("sources.offAccountHint")}
          />
          <BoundSecret
            refs={[
              ["nt", "offPassword"],
              ["ct", "offPassword"],
            ]}
            label={t("sources.offPassword")}
          />
        </Stack>
      </Disclosure>
      <Disclosure title="USDA FoodData Central">
        <Stack gap={3}>
          <BoundSwitch
            refs={[
              ["nt", "usdaEnabled"],
              ["ct", "usdaEnabled"],
            ]}
            label={t("sources.usdaEnabled")}
          />
          <BoundSecret
            refs={[
              ["nt", "usdaApiKey"],
              ["ct", "usdaApiKey"],
            ]}
            label={t("sources.usdaKey")}
          />
        </Stack>
      </Disclosure>
      <Disclosure title="Mealie">
        <Stack gap={3}>
          <BoundSwitch
            refs={[["nt", "mealieEnabled"]]}
            label={t("sources.mealieEnabled")}
          />
          <BoundText
            type="url"
            refs={[["nt", "mealieBaseUrl"]]}
            label={t("sources.mealieUrl")}
          />
          <BoundSecret
            refs={[["nt", "mealieApiToken"]]}
            label={t("sources.mealieToken")}
          />
        </Stack>
      </Disclosure>
      <AiCard />
      <BoundSwitch
        refs={[
          ["nt", "notifLocalEnabled"],
          ["ct", "notifLocalEnabled"],
          ["lt", "notifLocalEnabled"],
        ]}
        label={t("notifications.local")}
        onChanged={(isOn) => {
          if (isOn) void requestNotificationPermission();
        }}
      />
      {isLocal
        ? (
            [
              ["notifWaterReminders", "water"],
              ["notifMealReminders", "meals"],
              ["notifGoalCelebrations", "goalCelebrations"],
              ["notifWellnessAlerts", "wellnessAlerts"],
            ] as const
          ).map(([key, label]) => (
            <BoundSwitch
              key={key}
              refs={[["nt", key]]}
              label={t(`notifications.nutrition.${label}`)}
            />
          ))
        : null}
      <Text variant="small" tone="muted">
        {t("wizard.moreLater")}
      </Text>
    </Stack>
  );
}

export function SummaryRows({
  rows,
}: {
  rows: readonly (readonly [string, string])[];
}) {
  return (
    <Stack gap={1}>
      {rows.map(([label, value]) => (
        <KeyValue key={label} label={label} value={value} />
      ))}
    </Stack>
  );
}
