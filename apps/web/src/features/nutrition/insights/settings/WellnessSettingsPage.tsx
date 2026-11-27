import {
  Button,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";

import {
  FITBIT_VISIBILITY,
  GARMIN_VISIBILITY,
  HEALTH_CONNECT_VISIBILITY,
  WITHINGS_VISIBILITY,
} from "../../lib/insights/visibility";
import { InsightsHeader } from "../components/InsightsHeader";
import { SectionCard } from "../components/Panel";
import { ToggleRow } from "../components/ToggleRow";
import { useInsightsT } from "../useInsightsT";
import { useNtSettings } from "../useNtSettings";
import { ProviderConnection } from "./ProviderConnection";
import { SyncRange, SyncSchedule } from "./SyncSettings";
import { useWellnessConfig } from "./useWellnessConfig";
import { VisibleMetrics } from "./VisibleMetrics";

/** components/settings/SettingsWellness.svelte, without the Android parts */
export function WellnessSettingsPage() {
  const { t } = useInsightsT();
  const settings = useNtSettings();
  const { config, reload } = useWellnessConfig();
  const { values, set } = settings;

  const hasWearable =
    values.fitbitEnabled ||
    values.garminEnabled ||
    values.withingsEnabled ||
    values.healthConnectEnabled;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <InsightsHeader
        title={t("wellnessSettings.title")}
        backPath="/nutrition/wellness"
      />
      {!settings.isReady || !config ? (
        <div className="flex justify-center py-12">
          <Spinner label={t("common.loading")} />
        </div>
      ) : (
        <>
          <SectionCard>
            <ToggleRow
              label={t("wellnessSettings.master")}
              hint={t("wellnessSettings.masterHint")}
              isChecked={values.wellnessEnabled}
              onChange={(isOn) => {
                set("wellnessEnabled", isOn);
              }}
            />
            {values.wellnessEnabled ? (
              <ToggleRow
                label={t("wellnessSettings.mirrorWeight")}
                hint={t("wellnessSettings.mirrorWeightHint")}
                isChecked={values.mirrorWellnessWeight}
                onChange={(isOn) => {
                  set("mirrorWellnessWeight", isOn);
                }}
              />
            ) : null}
          </SectionCard>

          {values.wellnessEnabled ? (
            <>
              <SectionCard title={t("wellnessSettings.fitbitTitle")}>
                <ToggleRow
                  label={t("wellnessSettings.enable", { provider: "Fitbit" })}
                  hint={t("wellnessSettings.fitbitHint")}
                  isChecked={values.fitbitEnabled}
                  onChange={(isOn) => {
                    set("fitbitEnabled", isOn);
                  }}
                />
                {values.fitbitEnabled ? (
                  <Stack gap={4}>
                    <SyncRange device="fitbit" settings={settings} />
                    <SyncSchedule device="fitbit" settings={settings} />
                    {config.hasLegacyFitbit ? (
                      <Text variant="small" tone="warning">
                        {t("wellnessSettings.relink")}
                      </Text>
                    ) : null}
                    <ProviderConnection
                      provider="google-health"
                      name="Fitbit"
                      status={config.status["google-health"]}
                      account={[
                        config.fitbitUserId
                          ? `Fitbit ID: ${config.fitbitUserId}`
                          : t("wellnessSettings.viaGoogle"),
                        config.status["google-health"].googleUserId
                          ? t("wellnessSettings.googleUser", {
                              id: config.status["google-health"].googleUserId,
                            })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      credentials={config.credentials["google-health"]}
                      alsoDisconnect={["fitbit"]}
                      onChanged={reload}
                    />
                    <VisibleMetrics
                      ids={FITBIT_VISIBILITY}
                      settings={settings}
                    />
                    <ToggleRow
                      label={t("wellnessSettings.workouts")}
                      hint={t("wellnessSettings.workoutsHint")}
                      isChecked={values.workoutsEnabled}
                      onChange={(isOn) => {
                        set("workoutsEnabled", isOn);
                      }}
                    />
                  </Stack>
                ) : null}
              </SectionCard>

              <SectionCard title={t("wellnessSettings.garminTitle")}>
                <ToggleRow
                  label={t("wellnessSettings.enable", { provider: "Garmin" })}
                  hint={t("wellnessSettings.garminHint")}
                  isChecked={values.garminEnabled}
                  onChange={(isOn) => {
                    set("garminEnabled", isOn);
                  }}
                />
                {values.garminEnabled ? (
                  <Stack gap={4}>
                    <SyncRange device="garmin" settings={settings} />
                    <SyncSchedule device="garmin" settings={settings} />
                    <ProviderConnection
                      provider="garmin"
                      name="Garmin"
                      status={config.status.garmin}
                      account={
                        config.status.garmin.garminUserId ||
                        t("wellnessSettings.accountLinked", {
                          provider: "Garmin",
                        })
                      }
                      credentials={config.credentials.garmin}
                      onChanged={reload}
                    />
                    <VisibleMetrics
                      ids={GARMIN_VISIBILITY}
                      settings={settings}
                    />
                  </Stack>
                ) : null}
              </SectionCard>

              <SectionCard title={t("wellnessSettings.withingsTitle")}>
                <ToggleRow
                  label={t("wellnessSettings.enable", {
                    provider: "Withings",
                  })}
                  hint={t("wellnessSettings.withingsHint")}
                  isChecked={values.withingsEnabled}
                  onChange={(isOn) => {
                    set("withingsEnabled", isOn);
                  }}
                />
                {values.withingsEnabled ? (
                  <Stack gap={4}>
                    <SyncRange device="withings" settings={settings} />
                    <SyncSchedule device="withings" settings={settings} />
                    <ProviderConnection
                      provider="withings"
                      name="Withings"
                      status={config.status.withings}
                      account={
                        config.status.withings.withingsUserId
                          ? t("wellnessSettings.withingsUser", {
                              id: config.status.withings.withingsUserId,
                            })
                          : t("wellnessSettings.accountLinked", {
                              provider: "Withings",
                            })
                      }
                      credentials={config.credentials.withings}
                      onChanged={reload}
                    />
                    <VisibleMetrics
                      ids={WITHINGS_VISIBILITY}
                      settings={settings}
                    />
                  </Stack>
                ) : null}
              </SectionCard>

              {/* Health Connect is a source of the Android app only: the web
                  shows what it already synced, and can turn it off. */}
              {values.healthConnectEnabled ? (
                <SectionCard title="Health Connect">
                  <ToggleRow
                    label={t("wellnessSettings.enable", {
                      provider: "Health Connect",
                    })}
                    hint={t("wellnessSettings.healthConnectHint")}
                    isChecked={values.healthConnectEnabled}
                    onChange={(isOn) => {
                      set("healthConnectEnabled", isOn);
                    }}
                  />
                  <VisibleMetrics
                    ids={HEALTH_CONNECT_VISIBILITY}
                    settings={settings}
                  />
                </SectionCard>
              ) : null}

              {hasWearable && config.hasLiftTrace ? (
                <SectionCard title="LiftTrace">
                  <ToggleRow
                    label={t("wellnessSettings.liftTraceOverlap")}
                    hint={t("wellnessSettings.liftTraceOverlapHint")}
                    isChecked={values.lifttraceOverlapFill}
                    onChange={(isOn) => {
                      set("lifttraceOverlapFill", isOn);
                    }}
                  />
                </SectionCard>
              ) : null}

              <Row justify="end">
                <Button
                  size="sm"
                  variant="secondary"
                  text={t("wellnessSettings.resetMetrics")}
                  onClick={() => {
                    set("wellnessMetrics", null);
                  }}
                />
              </Row>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
