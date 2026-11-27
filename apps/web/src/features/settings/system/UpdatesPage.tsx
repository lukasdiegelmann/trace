/* eslint-disable @typescript-eslint/naming-convention -- the backend's fields */
import {
  Button,
  Chip,
  ExternalLink,
  KeyValue,
  Markdown,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, BACKEND_IDS, type BackendId } from "@/api";

import { useAdminBackends } from "../common/admin";
import { SegmentRow, SwitchRow } from "../common/fields";
import { BoundSelect } from "../common/rows";
import { LoadState, Section, SettingsScreen } from "../common/SettingsScreen";
import { useAction } from "../common/useAction";
import { useLoad } from "../common/useLoad";
import { formatDateTime } from "../lib/format";
import { APP_VERSIONS } from "../lib/versions";

type Channel = "stable" | "dev";
const CHANNEL_KEY = "trace.updates.channel";

interface ServerStatus {
  current: string;
  latest?: string;
  available?: boolean;
  notes?: string;
  notes_url?: string;
  checked_at?: string;
  disabled?: boolean;
  envLocked?: boolean;
}

interface UpdateConfig {
  enabled: boolean;
  answered?: boolean;
  envLocked?: boolean;
}

function readChannel(): Channel {
  try {
    return window.localStorage.getItem(CHANNEL_KEY) === "dev"
      ? "dev"
      : "stable";
  } catch {
    return "stable";
  }
}

function AppUpdates({
  backend,
  channel,
}: {
  backend: BackendId;
  channel: Channel;
}) {
  const { t, i18n } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const [force, setForce] = useState(0);
  const status = useLoad(
    () =>
      api[backend].get<ServerStatus>("/updates/server-status", {
        query: { channel, force: force ? 1 : undefined },
      }),
    [backend, channel, force],
  );
  const config = useLoad(
    () => api[backend].get<UpdateConfig>("/updates/config"),
    [backend],
  );
  const { run } = useAction();
  const data = status.data;

  return (
    <Section title={tCommon(`backends.${backend}`)}>
      <LoadState
        isLoading={status.isLoading}
        error={status.error}
        onRetry={() => void status.reload()}
        hasData={data !== null}
      >
        {data ? (
          <Stack gap={2}>
            <KeyValue label={t("updates.current")} value={data.current} />
            {data.disabled ? (
              <Text variant="small" tone="muted">
                {t(data.envLocked ? "updates.envOff" : "updates.off")}
              </Text>
            ) : data.available && data.latest ? (
              <>
                <Row>
                  <Chip
                    tone="accent"
                    text={t("updates.available", { version: data.latest })}
                  />
                </Row>
                {data.notes ? <Markdown source={data.notes} /> : null}
                {data.notes_url ? (
                  <ExternalLink
                    href={data.notes_url}
                    text={t("updates.releaseNotes")}
                  />
                ) : null}
                <Text variant="small" tone="muted">
                  {t("updates.how")}
                </Text>
              </>
            ) : (
              <Text variant="small">{t("updates.upToDate")}</Text>
            )}
            {data.checked_at ? (
              <Text variant="caption" tone="muted">
                {t("updates.checked", {
                  when: formatDateTime(data.checked_at, i18n.language),
                })}
              </Text>
            ) : null}
          </Stack>
        ) : null}
      </LoadState>
      {config.data ? (
        <SwitchRow
          label={t("updates.autoCheck", {
            app: tCommon(`backends.${backend}`),
          })}
          hint={config.data.envLocked ? t("updates.envOff") : undefined}
          isChecked={config.data.enabled}
          isDisabled={config.data.envLocked}
          onChange={(isOn) =>
            void run(async () => {
              await api[backend].put("/updates/config", { enabled: isOn });
              await Promise.all([config.reload(), status.reload()]);
            })
          }
        />
      ) : null}
      {data && !data.disabled ? (
        <Row>
          <Button
            variant="secondary"
            size="sm"
            text={t("updates.checkNow")}
            aria-label={`${t("updates.checkNow")}: ${tCommon(`backends.${backend}`)}`}
            isLoading={status.isLoading}
            onClick={() => {
              setForce((count) => count + 1);
            }}
          />
        </Row>
      ) : null}
    </Section>
  );
}

/** The server's update routes answer admins only */
function InstalledVersion({ backend }: { backend: BackendId }) {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  return (
    <Section title={tCommon(`backends.${backend}`)}>
      <KeyValue label={t("updates.current")} value={APP_VERSIONS[backend]} />
      <Text variant="small" tone="muted">
        {t("updates.adminChecks")}
      </Text>
    </Section>
  );
}

export function UpdatesPage() {
  const { t } = useTranslation("settings");
  const [channel, setChannel] = useState(readChannel);
  const admin = useAdminBackends();
  return (
    <SettingsScreen
      title={t("topics.updates.title")}
      description={t("updates.description")}
      backends={["nt", "ct", "lt"]}
    >
      <Section>
        <SegmentRow<Channel>
          label={t("updates.channel")}
          value={channel}
          options={[
            { value: "stable", label: t("updates.channels.stable") },
            { value: "dev", label: t("updates.channels.dev") },
          ]}
          onChange={(next) => {
            setChannel(next);
            try {
              window.localStorage.setItem(CHANNEL_KEY, next);
            } catch {
              // Private mode: for this page only.
            }
          }}
        />
        <BoundSelect<number>
          refs={[
            ["nt", "updateCheckInterval"],
            ["ct", "updateCheckInterval"],
            ["lt", "updateCheckInterval"],
          ]}
          label={t("updates.interval")}
          hint={t("updates.intervalHint")}
          options={[1, 4, 12, 24, 0].map((value) => ({
            value,
            label: value
              ? t("units.hours", { count: value })
              : t("updates.manual"),
          }))}
        />
      </Section>
      {BACKEND_IDS.map((backend) =>
        admin.includes(backend) ? (
          <AppUpdates key={backend} backend={backend} channel={channel} />
        ) : (
          <InstalledVersion key={backend} backend={backend} />
        ),
      )}
    </SettingsScreen>
  );
}
