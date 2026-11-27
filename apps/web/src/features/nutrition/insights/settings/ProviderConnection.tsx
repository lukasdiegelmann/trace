import {
  Button,
  Chip,
  Row,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { Pencil } from "lucide-react";
import { useState } from "react";

import { localDateStr } from "../../lib/insights/dates";
import {
  authorizeUrl,
  disconnect,
  saveConfig,
  syncProvider,
  type Provider,
  type ProviderStatus,
} from "../api";
import { useInsightsT } from "../useInsightsT";
import { CredentialsForm } from "./CredentialsForm";
import { toConfig, type ConfigProvider, type Credentials } from "./credentials";

export interface ProviderConnectionProps {
  provider: ConfigProvider;
  /** Shown in messages: the data source's name */
  name: string;
  status: ProviderStatus;
  /** The account line of the linked banner */
  account: string;
  credentials: Credentials;
  /** The disconnect also drops these (the legacy Fitbit link) */
  alsoDisconnect?: Provider[];
  onChanged: () => void;
}

/**
 * Linked: sync today or disconnect. Configured: connect, or change the
 * credentials. Neither: enter the credentials.
 */
export function ProviderConnection(props: ProviderConnectionProps) {
  const { provider, name, status } = props;
  const { t, locale } = useInsightsT();
  const toast = useToast();
  const [isEditing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect">();
  const [result, setResult] = useState<string>();

  const fail = (error: unknown) => toast.error((error as Error).message);

  async function connect() {
    setBusy("connect");
    try {
      window.location.assign(await authorizeUrl(provider));
    } catch (error) {
      fail(error);
      setBusy(undefined);
    }
  }

  async function drop() {
    setBusy("disconnect");
    try {
      // Either link may not exist: what counts is that none is left.
      const others = props.alsoDisconnect ?? [];
      await Promise.all(others.map((p) => disconnect(p).catch(() => {})));
      await disconnect(provider);
      toast.info(t("wellnessSettings.disconnected", { provider: name }));
      props.onChanged();
    } catch (error) {
      fail(error);
    }
    setBusy(undefined);
  }

  async function syncToday() {
    setBusy("sync");
    setResult(undefined);
    const date = localDateStr();
    let message: string;
    try {
      const response = await syncProvider(
        provider,
        provider === "google-health" ? { date } : { from: date, to: date },
      );
      const day = response.results?.[date];
      if (provider === "google-health" && !day?.ok) {
        throw new Error(day?.error ?? t("wellness.oauth.unknownError"));
      }
      message =
        provider === "google-health"
          ? t("wellnessSettings.syncedMetrics", {
              count: day?.count ?? 0,
              date,
            })
          : t("wellnessSettings.syncedToday", { provider: name, date });
      toast.info(message);
    } catch (error) {
      message = t("wellness.sync.failed", {
        provider: name,
        message: (error as Error).message,
      });
      toast.error(message);
    }
    setResult(message);
    setBusy(undefined);
  }

  async function save(credentials: Credentials) {
    try {
      await saveConfig(provider, toConfig(provider, credentials));
      toast.info(t("wellnessSettings.credentialsSaved", { provider: name }));
      setEditing(false);
      props.onChanged();
    } catch (error) {
      toast.error(
        t("wellnessSettings.saveFailed", {
          message: (error as Error).message,
        }),
      );
    }
  }

  if (status.connected) {
    return (
      <Stack gap={2}>
        <Row gap={2} align="center" shouldWrap>
          <Chip tone="accent" text={t("wellnessSettings.linked")} />
          <Text variant="small">
            {status.lastSyncedAt
              ? `${props.account} · ${t("wellnessSettings.lastSynced", {
                  time: new Date(
                    // SQLite's "YYYY-MM-DD HH:MM:SS" is UTC
                    `${status.lastSyncedAt.replace(" ", "T")}Z`,
                  ).toLocaleString(locale),
                })}`
              : props.account}
          </Text>
        </Row>
        <Row gap={2}>
          <Button
            size="sm"
            variant="secondary"
            text={t("wellnessSettings.syncNow")}
            isLoading={busy === "sync"}
            onClick={() => void syncToday()}
          />
          <Button
            size="sm"
            variant="danger"
            text={t("wellnessSettings.disconnect")}
            isLoading={busy === "disconnect"}
            onClick={() => void drop()}
          />
        </Row>
        {result ? <Text variant="caption">{result}</Text> : null}
      </Stack>
    );
  }

  if (status.configured && !isEditing) {
    return (
      <Stack gap={2}>
        <Text variant="label">{t("wellnessSettings.notConnected")}</Text>
        <Text variant="caption">{t("wellnessSettings.authorizeHint")}</Text>
        <Row gap={2}>
          <Button
            size="sm"
            variant="primary"
            text={t("wellnessSettings.connect")}
            isLoading={busy === "connect"}
            onClick={() => void connect()}
          />
          <Button
            size="sm"
            aria-label={t("wellnessSettings.editCredentials")}
            onClick={() => {
              setEditing(true);
            }}
          >
            <Pencil aria-hidden size={16} />
          </Button>
        </Row>
      </Stack>
    );
  }

  return (
    <CredentialsForm
      provider={provider}
      initial={props.credentials}
      onSave={save}
      onCancel={
        isEditing
          ? () => {
              setEditing(false);
            }
          : undefined
      }
    />
  );
}
