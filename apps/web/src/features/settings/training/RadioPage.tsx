import { Button, Row } from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { flushSettings, useShared } from "../common/binding";
import { ConnectionCheck } from "../common/ConnectionCheck";
import { SelectRow } from "../common/fields";
import {
  BoundSecret,
  BoundSelect,
  BoundSwitch,
  BoundText,
} from "../common/rows";
import { Section, SettingsScreen } from "../common/SettingsScreen";
import { useConnectionCheck } from "../common/useConnectionCheck";
import {
  pingRadio,
  RADIO_PLACEHOLDERS,
  RADIO_PROVIDERS,
  type RadioProvider,
} from "../lib/radio";

const CROSSFADE = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12];

function Server() {
  const { t } = useTranslation("settings");
  const [stored, setProvider] = useShared<string>(["lt", "radioProvider"]);
  const [url] = useShared<string>(["lt", "radioUrl"]);
  const [user] = useShared<string>(["lt", "radioUser"]);
  const [password] = useShared<string>(["lt", "radioPassword"]);
  const provider: RadioProvider =
    RADIO_PROVIDERS.find((p) => p === stored) ?? "subsonic";
  const check = useConnectionCheck(async () => {
    // The proxy reads the saved address and credentials.
    await flushSettings("lt");
    await pingRadio(provider, user, password);
  });
  const reset = () => {
    check.reset();
  };

  return (
    <>
      <SelectRow<RadioProvider>
        label={t("radio.provider")}
        value={provider}
        options={RADIO_PROVIDERS.map((value) => ({
          value,
          label: t(`radio.providers.${value}`),
        }))}
        onChange={(value) => {
          setProvider(value);
          check.reset();
        }}
      />
      <BoundText
        type="url"
        refs={[["lt", "radioUrl"]]}
        label={t("radio.url")}
        placeholder={RADIO_PLACEHOLDERS[provider]}
        onCommitted={reset}
      />
      {provider !== "plex" ? (
        <BoundText
          refs={[["lt", "radioUser"]]}
          label={t("radio.user")}
          onCommitted={reset}
        />
      ) : null}
      {/* LiftTrace's proxy reads the Plex token from the password: the old
          settings saved it as the user name, where it never arrived. */}
      <BoundSecret
        refs={[["lt", "radioPassword"]]}
        label={t(
          provider === "plex"
            ? "radio.plexToken"
            : provider === "emby"
              ? "radio.apiKey"
              : "radio.password",
        )}
        onCommitted={reset}
      />
      <ConnectionCheck check={check} isConfigured={Boolean(url)} />
      <BoundSelect<number>
        refs={[["lt", "radioCrossfade"]]}
        label={t("radio.crossfade")}
        options={CROSSFADE.map((value) => ({
          value,
          label: value ? t("radio.seconds", { count: value }) : t("radio.off"),
        }))}
      />
      <BoundSwitch
        refs={[["lt", "radioOriginalFormat"]]}
        label={t("radio.originalFormat")}
      />
    </>
  );
}

export function RadioPage() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const [isOn] = useShared<boolean>(["lt", "radioEnabled"]);
  return (
    <SettingsScreen
      title={t("topics.radio.title")}
      description={t("topics.radio.description")}
      backends={["lt"]}
    >
      <Section title={t("radio.selfHosted")}>
        <BoundSwitch
          refs={[["lt", "radioEnabled"]]}
          label={t("radio.enabled")}
        />
        {isOn ? <Server /> : null}
      </Section>
      <Section title={t("radio.stations")} hint={t("radio.stationsHint")}>
        <BoundSwitch
          refs={[["lt", "radioStationsEnabled"]]}
          label={t("radio.stationsEnabled")}
        />
        <Row>
          <Button
            variant="secondary"
            size="md"
            text={t("radio.openRadio")}
            onClick={() => void navigate("/training/radio")}
          />
        </Row>
      </Section>
    </SettingsScreen>
  );
}
