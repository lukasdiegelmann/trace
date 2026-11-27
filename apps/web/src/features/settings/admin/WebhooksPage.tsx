/* eslint-disable @typescript-eslint/naming-convention -- the backend's fields */
import {
  Banner,
  Button,
  Chip,
  EmptyState,
  Row,
  Stack,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type BackendId } from "@/api";

import { AdminPerApp } from "../common/AdminOnly";
import { CheckList, SecretRow, SwitchRow, TextRow } from "../common/fields";
import { LoadState, Section, SettingsScreen } from "../common/SettingsScreen";
import { useAction } from "../common/useAction";
import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";
import { relativeTime } from "../lib/format";
import { SecretOnce } from "./SecretOnce";

interface Webhook {
  id: number;
  url: string;
  events: string[];
  enabled: boolean;
  last_delivery_at?: string | null;
  last_delivery_status?: "success" | "failed" | null;
  last_delivery_error?: string | null;
}

interface WebhookList {
  webhooks: Webhook[];
  known_events: string[];
  event_descriptions?: Record<string, string>;
  webhooks_enabled: boolean;
}

/** LiftTrace mounts them elsewhere */
const BASE: Record<BackendId, string> = {
  nt: "/admin/webhooks",
  ct: "/admin/webhooks",
  lt: "/webhooks",
};

function Webhooks({ backend }: { backend: BackendId }) {
  const { t, i18n } = useTranslation("settings");
  const base = BASE[backend];
  const list = useLoad(() => api[backend].get<WebhookList>(base), [backend]);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<string[] | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const { isBusy, run } = useAction();
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  const data = list.data;
  const picked = events ?? data?.known_events.slice(0, 1) ?? [];

  const change = (action: () => Promise<unknown>) =>
    run(async () => {
      await action();
      await list.reload();
    });

  return (
    <LoadState
      isLoading={list.isLoading}
      error={list.error}
      onRetry={() => void list.reload()}
      hasData={data !== null}
    >
      {data ? (
        <>
          {!data.webhooks_enabled ? (
            <Banner text={t("webhooks.disabled")} />
          ) : null}
          {data.webhooks.length === 0 ? (
            <EmptyState text={t("webhooks.none")} />
          ) : null}
          {data.webhooks.map((hook) => (
            <Stack key={hook.id} gap={2}>
              <Text variant="label">{hook.url}</Text>
              <Text variant="small" tone="muted">
                {hook.events.join(", ")}
              </Text>
              {hook.last_delivery_at ? (
                <Row gap={2} align="center">
                  <Text variant="small">
                    {t("webhooks.lastDelivery", {
                      when: relativeTime(hook.last_delivery_at, i18n.language),
                    })}
                  </Text>
                  {hook.last_delivery_status === "failed" ? (
                    <Chip tone="danger" text={t("webhooks.failed")} />
                  ) : (
                    <Chip tone="accent" text={t("webhooks.succeeded")} />
                  )}
                </Row>
              ) : null}
              {hook.last_delivery_status === "failed" &&
              hook.last_delivery_error ? (
                <Text variant="small" tone="danger">
                  {hook.last_delivery_error}
                </Text>
              ) : null}
              <SwitchRow
                label={t("webhooks.enabled")}
                isChecked={hook.enabled}
                onChange={(isOn) =>
                  void change(() =>
                    api[backend].put(`${base}/${hook.id}`, { enabled: isOn }),
                  )
                }
              />
              <Row gap={2}>
                <Button
                  variant="secondary"
                  size="sm"
                  text={t("actions.test")}
                  isDisabled={isBusy}
                  onClick={() =>
                    void change(async () => {
                      const answer = await api[backend].post<{
                        last_delivery_status?: string;
                        last_delivery_error?: string | null;
                      }>(`${base}/${hook.id}/test`, {});
                      if (answer.last_delivery_status === "failed") {
                        toast.error(
                          answer.last_delivery_error ?? t("webhooks.failed"),
                        );
                      } else {
                        toast.show({ text: t("webhooks.delivered") });
                      }
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  text={t("actions.delete")}
                  onClick={() =>
                    void confirm({
                      title: t("webhooks.deleteTitle"),
                      message: hook.url,
                      confirmText: t("actions.delete"),
                      isDangerous: true,
                    }).then((isConfirmed) => {
                      if (isConfirmed) {
                        void change(() =>
                          api[backend].delete(`${base}/${hook.id}`),
                        );
                      }
                    })
                  }
                />
              </Row>
            </Stack>
          ))}
          {newSecret ? (
            <SecretOnce
              title={t("webhooks.newSecret")}
              secret={newSecret}
              onDone={() => {
                setNewSecret(null);
              }}
            />
          ) : null}
          <Section title={t("webhooks.new")}>
            <TextRow
              type="url"
              label={t("webhooks.url")}
              value={url}
              isLive
              onCommit={setUrl}
            />
            <CheckList<string>
              label={t("webhooks.events")}
              options={data.known_events.map((event) => ({
                value: event,
                label: data.event_descriptions?.[event]
                  ? `${event} · ${data.event_descriptions[event]}`
                  : event,
              }))}
              values={picked}
              onChange={setEvents}
            />
            <SecretRow
              label={t("webhooks.secret")}
              hint={t("optional")}
              value={secret}
              isLive
              onCommit={setSecret}
            />
            <Row>
              <Button
                variant="secondary"
                size="md"
                text={t("webhooks.create")}
                isDisabled={!url.trim() || picked.length === 0}
                isLoading={isBusy}
                onClick={() =>
                  void change(async () => {
                    const answer = await api[backend].post<{
                      secret?: string;
                    }>(base, {
                      url: url.trim(),
                      events: picked,
                      ...(secret ? { secret } : {}),
                    });
                    setNewSecret(answer.secret ?? null);
                    setUrl("");
                    setSecret("");
                    setEvents(null);
                  })
                }
              />
            </Row>
          </Section>
        </>
      ) : null}
      {dialog}
    </LoadState>
  );
}

export function WebhooksPage() {
  const { t } = useTranslation("settings");
  return (
    <SettingsScreen
      title={t("topics.webhooks.title")}
      description={t("topics.webhooks.description")}
    >
      <AdminPerApp>{(backend) => <Webhooks backend={backend} />}</AdminPerApp>
    </SettingsScreen>
  );
}
