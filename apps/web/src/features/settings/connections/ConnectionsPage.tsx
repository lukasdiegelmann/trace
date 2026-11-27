import { Banner, Text } from "@monocircuit/monolithium/components";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { settingsStores } from "@/features/shared/settings";

import { flushSettings, useShared } from "../common/binding";
import { ConnectionCheck } from "../common/ConnectionCheck";
import { BoundSecret, BoundSwitch, BoundText } from "../common/rows";
import { Section, SettingsScreen } from "../common/SettingsScreen";
import { useConnectionCheck } from "../common/useConnectionCheck";
import { BulkImport } from "./BulkImport";
import {
  cooktraceGet,
  importPantry,
  importRecipes,
  pantryRefusal,
} from "./cooktraceBulk";
import { NtFoodsImport } from "./NtFoodsImport";
import { NutriTraceLink } from "./NutriTraceLink";

/** NutriTrace reads recipes and pantry from CookTrace */
function CookTraceInNutriTrace() {
  const { t } = useTranslation("settings");
  const [isOn] = useShared<boolean>(["nt", "cooktraceEnabled"]);
  const [url] = useShared<string | undefined>(["nt", "cooktraceBaseUrl"]);
  const [token] = useShared<string | undefined>(["nt", "cooktraceApiToken"]);
  const connection = { baseUrl: url ?? "", token: token ?? "" };
  const check = useConnectionCheck(async () => {
    await flushSettings("nt");
    const me = await cooktraceGet<{
      user?: { username?: string };
      scopes?: string[];
    }>(connection, "/api/v1/me");
    if (!me.scopes?.includes("read:recipes")) {
      throw new Error(t("connections.missingRecipeScope"));
    }
    return t("connections.connectedAs", { name: me.user?.username ?? "" });
  });
  const isConfigured = Boolean(url && token);
  const { run, reset: resetCheck } = check;
  const autoTest = () => {
    resetCheck();
    // After the render that shows the new value to the test.
    setTimeout(() => {
      const values = settingsStores.nt.getSnapshot().values;
      if (values.cooktraceBaseUrl && values.cooktraceApiToken) void run();
    }, 0);
  };
  // A saved connection is tested once when the page opens.
  const shouldTest = isOn && isConfigured;
  const hasTested = useRef(false);
  useEffect(() => {
    if (!shouldTest || hasTested.current) return;
    hasTested.current = true;
    void run();
  }, [shouldTest, run]);

  return (
    <Section
      title={t("connections.nutritionFromCooking")}
      hint={t("connections.nutritionFromCookingHint")}
    >
      <BoundSwitch
        refs={[["nt", "cooktraceEnabled"]]}
        label={t("connections.cooktraceEnabled")}
      />
      {isOn ? (
        <>
          <BoundText
            type="url"
            refs={[["nt", "cooktraceBaseUrl"]]}
            label={t("connections.ctUrl")}
            hint={t("connections.ntUrlHint", {
              url: `${window.location.origin}/ct`,
            })}
            onCommitted={autoTest}
          />
          <BoundSecret
            refs={[["nt", "cooktraceApiToken"]]}
            label={t("connections.ctToken")}
            hint={t("connections.scopes.nt")}
            onCommitted={autoTest}
          />
          <ConnectionCheck check={check} isConfigured={isConfigured} />
          {isConfigured && check.state.status === "ok" ? (
            <>
              <BulkImport
                label={t("connections.importRecipes")}
                confirmText={t("connections.importRecipesText")}
                run={async (onProgress) => {
                  await flushSettings("nt");
                  return importRecipes(connection, onProgress);
                }}
              />
              <BulkImport
                label={t("connections.importPantry")}
                confirmText={t("connections.importPantryText")}
                run={async (onProgress) => {
                  await flushSettings("nt");
                  try {
                    return await importPantry(connection, onProgress);
                  } catch (caught) {
                    const refusal = pantryRefusal(caught);
                    if (!refusal) throw caught;
                    throw new Error(t(`connections.pantryRefused.${refusal}`), {
                      cause: caught,
                    });
                  }
                }}
              />
            </>
          ) : null}
        </>
      ) : null}
    </Section>
  );
}

function NutritionInCooking() {
  const { t } = useTranslation("settings");
  const [isLinked] = useShared<boolean>(["ct", "ntFederationEnabled"]);
  const [url] = useShared<string>(["ct", "ntInstanceUrl"]);
  return (
    <>
      <Section
        title={t("connections.cookingFromNutrition")}
        hint={t("connections.cookingFromNutritionHint")}
      >
        <NutriTraceLink backend="ct" />
      </Section>
      <Section title={t("connections.importFromNt")}>
        {isLinked && url ? (
          <NtFoodsImport />
        ) : (
          <Text tone="muted">{t("connections.connectFirst")}</Text>
        )}
      </Section>
    </>
  );
}

function TrainingToNutrition() {
  const { t } = useTranslation("settings");
  const [isEstimating] = useShared<boolean>(["lt", "caloriesBurnedEnabled"]);
  return (
    <Section
      title={t("connections.trainingToNutrition")}
      hint={t("connections.trainingToNutritionHint")}
    >
      {!isEstimating ? <Banner text={t("connections.needsCalories")} /> : null}
      <NutriTraceLink backend="lt" />
      <BoundSwitch
        refs={[["lt", "ntFederationEnabled"]]}
        label={t("connections.sendWorkouts")}
      />
      <Text variant="small" tone="muted">
        {t("connections.wearableWins")}
      </Text>
    </Section>
  );
}

export function ConnectionsPage() {
  const { t } = useTranslation("settings");
  return (
    <SettingsScreen
      title={t("topics.connections.title")}
      description={t("connections.description")}
      backends={["nt", "ct", "lt"]}
    >
      <CookTraceInNutriTrace />
      <NutritionInCooking />
      <TrainingToNutrition />
    </SettingsScreen>
  );
}
