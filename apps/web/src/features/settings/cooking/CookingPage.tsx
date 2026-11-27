import { Text } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import { useShared } from "../common/binding";
import { NumberRow } from "../common/fields";
import { BoundSelect, BoundSwitch } from "../common/rows";
import { Section, SettingsScreen } from "../common/SettingsScreen";

export function CookingPage() {
  const { t } = useTranslation("settings");
  const [servings, setServings] = useShared<number>(["ct", "defaultServings"]);
  const [engine] = useShared<string>(["ct", "urlImportEngine"]);
  const [isAi] = useShared<boolean>(["ct", "aiEnabled"]);
  const [isVerified] = useShared<boolean>(["ct", "aiKeyVerified"]);
  const canUseAi = isAi && isVerified;
  const smart = {
    value: "smart",
    label: t("cooking.engines.smart"),
    isDisabled: !canUseAi,
  };
  const standard = { value: "standard", label: t("cooking.engines.standard") };

  return (
    <SettingsScreen
      title={t("topics.cooking.title")}
      description={t("topics.cooking.description")}
      backends={["ct"]}
    >
      <Section title={t("cooking.recipes")}>
        <NumberRow
          label={t("cooking.defaultServings")}
          value={servings}
          min={1}
          max={20}
          fallback={2}
          isInteger
          onCommit={setServings}
        />
        <BoundSwitch
          refs={[["ct", "autoCreatePantryFromRecipes"]]}
          label={t("cooking.autoPantry")}
        />
        <BoundSwitch
          refs={[["ct", "mixSharedIntoRecipes"]]}
          label={t("cooking.mixShared")}
        />
      </Section>
      <Section title={t("cooking.urlImport")}>
        <BoundSelect<string>
          refs={[["ct", "urlImportEngine"]]}
          label={t("cooking.engine")}
          hint={t("cooking.engineHint")}
          options={[
            standard,
            { value: "enhanced", label: t("cooking.engines.enhanced") },
            smart,
          ]}
        />
        {engine === "smart" ? (
          <Text variant="small" tone="muted">
            {t("cooking.smartCost")}
          </Text>
        ) : null}
        {engine === "enhanced" ? (
          <BoundSelect<string>
            refs={[["ct", "urlImportFallback"]]}
            label={t("cooking.fallback")}
            options={[standard, smart]}
          />
        ) : null}
      </Section>
      <Section title={t("cooking.shopping")}>
        <BoundSelect<string>
          refs={[["ct", "shoppingGroupBy"]]}
          label={t("cooking.groupBy")}
          options={(["aisle", "recipe", "flat"] as const).map((value) => ({
            value,
            label: t(`cooking.groups.${value}`),
          }))}
        />
        <BoundSelect<string>
          refs={[["ct", "shoppingCheckedBehavior"]]}
          label={t("cooking.checked")}
          options={(["bottom", "hide"] as const).map((value) => ({
            value,
            label: t(`cooking.checkedOptions.${value}`),
          }))}
        />
      </Section>
    </SettingsScreen>
  );
}
