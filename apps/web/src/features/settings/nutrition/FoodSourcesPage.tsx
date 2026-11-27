import { ExternalLink } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { api } from "@/api";
import { settingsStores } from "@/features/shared/settings";

import { flushSettings, useShared } from "../common/binding";
import { ConnectionCheck } from "../common/ConnectionCheck";
import { useConnectionCheck } from "../common/useConnectionCheck";
import {
  BoundSecret,
  BoundSelect,
  BoundSwitch,
  BoundText,
} from "../common/rows";
import { Section, SettingsScreen } from "../common/SettingsScreen";
import { useEnvLocks } from "../common/envLocks";
import { OFF_COUNTRIES, OFF_LANGUAGES, testUsdaKey } from "../lib/foodSources";
import { OffMirror } from "./OffMirror";

function OpenFoodFacts() {
  const { t, i18n } = useTranslation("settings");
  const [isOn] = useShared<boolean>(["nt", "offEnabled"], ["ct", "offEnabled"]);
  const languages = new Intl.DisplayNames([i18n.language], {
    type: "language",
  });
  const countries = OFF_COUNTRIES.map((value) => ({ value, label: value }));

  return (
    <Section title="Open Food Facts" hint={t("sources.offHint")}>
      <BoundSwitch
        refs={[
          ["nt", "offEnabled"],
          ["ct", "offEnabled"],
        ]}
        label={t("sources.offEnabled")}
      />
      {isOn ? (
        <>
          <BoundSelect<string>
            refs={[
              ["nt", "offSearchLanguage"],
              ["ct", "offSearchLanguage"],
            ]}
            label={t("sources.searchLanguage")}
            options={OFF_LANGUAGES.map((value) => ({
              value,
              label: languages.of(value) ?? value,
            }))}
          />
          <BoundSelect<string>
            refs={[
              ["nt", "offSearchCountry"],
              ["ct", "offSearchCountry"],
            ]}
            label={t("sources.searchCountry")}
            options={countries}
          />
          <BoundSelect<string>
            refs={[
              ["nt", "offUploadCountry"],
              ["ct", "offUploadCountry"],
            ]}
            label={t("sources.uploadCountry")}
            options={[
              { value: "Auto", label: t("sources.auto") },
              ...countries.filter((country) => country.value !== "World"),
            ]}
          />
          <BoundSelect<string>
            refs={[["nt", "offImportPortion"]]}
            label={t("sources.importPortion")}
            options={[
              { value: "per100g", label: t("sources.per100g") },
              { value: "perServing", label: t("sources.perServing") },
            ]}
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
          <ExternalLink
            href="https://world.openfoodfacts.org/cgi/user.pl"
            text={t("sources.offSignup")}
          />
        </>
      ) : null}
    </Section>
  );
}

function Usda() {
  const { t } = useTranslation("settings");
  const [isOn] = useShared<boolean>(
    ["nt", "usdaEnabled"],
    ["ct", "usdaEnabled"],
  );
  const [key] = useShared<string>(["nt", "usdaApiKey"], ["ct", "usdaApiKey"]);
  const check = useConnectionCheck(async () => {
    await flushSettings("nt", "ct");
    await testUsdaKey(key);
  });

  return (
    <Section title="USDA FoodData Central">
      <BoundSwitch
        refs={[
          ["nt", "usdaEnabled"],
          ["ct", "usdaEnabled"],
        ]}
        label={t("sources.usdaEnabled")}
      />
      {isOn ? (
        <>
          <BoundSecret
            refs={[
              ["nt", "usdaApiKey"],
              ["ct", "usdaApiKey"],
            ]}
            label={t("sources.usdaKey")}
            onCommitted={(next) => {
              check.reset();
              if (next) setTimeout(() => void check.run(), 0);
            }}
          />
          <ExternalLink
            href="https://fdc.nal.usda.gov/api-key-signup"
            text={t("sources.usdaSignup")}
          />
          <ConnectionCheck check={check} isConfigured={Boolean(key)} />
        </>
      ) : null}
    </Section>
  );
}

function Mealie() {
  const { t } = useTranslation("settings");
  const [isOn] = useShared<boolean>(["nt", "mealieEnabled"]);
  const [url] = useShared<string | undefined>(["nt", "mealieBaseUrl"]);
  const [token] = useShared<string | undefined>(["nt", "mealieApiToken"]);
  const check = useConnectionCheck(async () => {
    // The proxy only accepts the address that is saved.
    await flushSettings("nt");
    // Mealie's 401 comes through the proxy: the Trace session lives.
    await api.nt.post(
      "/mealie/proxy",
      { baseUrl: url, token, path: "/api/recipes?perPage=1&page=1" },
      { shouldVerify401: true },
    );
  });
  const autoTest = () => {
    check.reset();
    // After the render that shows the new value to the test.
    setTimeout(() => {
      const values = settingsStores.nt.getSnapshot().values;
      if (values.mealieBaseUrl && values.mealieApiToken) void check.run();
    }, 0);
  };

  return (
    <Section title="Mealie">
      <BoundSwitch
        refs={[["nt", "mealieEnabled"]]}
        label={t("sources.mealieEnabled")}
      />
      {isOn ? (
        <>
          <BoundText
            type="url"
            refs={[["nt", "mealieBaseUrl"]]}
            label={t("sources.mealieUrl")}
            placeholder="https://mealie.example.com"
            onCommitted={autoTest}
          />
          <BoundSecret
            refs={[["nt", "mealieApiToken"]]}
            label={t("sources.mealieToken")}
            onCommitted={autoTest}
          />
          <ConnectionCheck check={check} isConfigured={Boolean(url && token)} />
        </>
      ) : null}
    </Section>
  );
}

export function FoodSourcesPage() {
  const { t } = useTranslation("settings");
  const locks = useEnvLocks("nt");
  const [isOff] = useShared<boolean>(["nt", "offEnabled"]);
  const [isUsda] = useShared<boolean>(["nt", "usdaEnabled"]);
  const [isMealie] = useShared<boolean>(["nt", "mealieEnabled"]);
  const sources = [
    { value: "all", label: t("sources.all") },
    { value: "local", label: t("sources.local") },
    ...(isOff ? [{ value: "off", label: "Open Food Facts" }] : []),
    ...(isUsda ? [{ value: "usda", label: "USDA" }] : []),
  ];

  return (
    <SettingsScreen
      title={t("topics.foodSources.title")}
      description={t("sources.description")}
      backends={["nt", "ct"]}
    >
      <Section title={t("sources.defaults")}>
        <BoundSelect<string>
          refs={[["nt", "foodsDefaultSource"]]}
          label={t("sources.defaultNutrition")}
          options={[
            ...sources,
            ...(isMealie ? [{ value: "mealie", label: "Mealie" }] : []),
          ]}
        />
        <BoundSelect<string>
          refs={[["ct", "pantryDefaultSource"]]}
          label={t("sources.defaultPantry")}
          options={sources}
        />
      </Section>
      <OpenFoodFacts />
      {locks.data?.off_local ? (
        <OffMirror isOnly={Boolean(locks.data.off_local_only)} />
      ) : null}
      <Usda />
      <Mealie />
    </SettingsScreen>
  );
}
