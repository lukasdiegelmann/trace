/* eslint-disable @typescript-eslint/naming-convention -- the backend's fields */
/** OpenID Connect providers (SettingsAuth.svelte) */
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  KeyValue,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type BackendId } from "@/api";

import { AdminPerApp } from "../common/AdminOnly";
import { LoadState, Section, SettingsScreen } from "../common/SettingsScreen";
import { errorText, useAction } from "../common/useAction";
import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";
import { backendAssetUrl } from "../lib/assets";
import {
  draftFromProvider,
  type OidcProvider,
  type ProviderDraft,
} from "../lib/oidcDraft";
import { ProviderDialog } from "./ProviderDialog";

interface ProviderList {
  providers: OidcProvider[];
  enable_email_password_login: boolean;
  env_locked_provider_ids?: number[];
}

interface Discovery {
  ok: boolean;
  error?: string;
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  end_session_endpoint?: string;
}

function TestResult({ result }: { result: Discovery }) {
  const { t } = useTranslation("settings");
  if (!result.ok) {
    return (
      <Text variant="small" tone="danger" role="alert">
        {result.error ?? t("connection.failed")}
      </Text>
    );
  }
  return (
    <Stack gap={1} role="status">
      <Text variant="small" tone="success">
        {t("oidc.discoveryOk")}
      </Text>
      {(
        [
          "issuer",
          "authorization_endpoint",
          "token_endpoint",
          "end_session_endpoint",
        ] as const
      ).map((key) =>
        result[key] ? (
          <KeyValue
            key={key}
            layout="stacked"
            label={key}
            value={result[key]}
          />
        ) : null,
      )}
    </Stack>
  );
}

function Providers({ backend }: { backend: BackendId }) {
  const { t } = useTranslation("settings");
  const list = useLoad(
    () => api[backend].get<ProviderList>("/admin/oidc/providers"),
    [backend],
  );
  const { isBusy, run } = useAction();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<{
    draft: ProviderDraft | null;
  } | null>(null);
  const [tests, setTests] = useState<Partial<Record<number, Discovery>>>({});
  const data = list.data;
  const locked = new Set(data?.env_locked_provider_ids ?? []);

  const test = async (id: number) => {
    let result: Discovery;
    try {
      result = await api[backend].post<Discovery>(
        `/admin/oidc/providers/${id}/test`,
        {},
      );
    } catch (caught) {
      result = { ok: false, error: errorText(caught) };
    }
    setTests((old) => ({ ...old, [id]: result }));
  };

  const save = (draft: ProviderDraft) =>
    void run(
      async () => {
        const { id, ...body } = draft;
        if (id) {
          await api[backend].put(`/admin/oidc/providers/${id}`, body);
        } else {
          await api[backend].post("/admin/oidc/providers", body);
        }
        setEditing(null);
        await list.reload();
      },
      { success: t("actions.saved") },
    );

  return (
    <LoadState
      isLoading={list.isLoading}
      error={list.error}
      onRetry={() => void list.reload()}
      hasData={data !== null}
    >
      {data ? (
        <>
          {data.providers.length === 0 ? (
            <EmptyState text={t("oidc.none")} />
          ) : null}
          {data.providers.map((provider) => {
            const isLocked = provider.env_locked || locked.has(provider.id);
            const name = provider.display_name || provider.issuer_url;
            const result = tests[provider.id];
            return (
              <Section
                key={provider.id}
                title={name}
                hint={provider.issuer_url}
              >
                <Row gap={2} align="center" shouldWrap>
                  <Avatar
                    name={name}
                    src={
                      provider.logo_url
                        ? backendAssetUrl(backend, provider.logo_url)
                        : null
                    }
                    size={28}
                  />
                  {isLocked ? <Chip text={t("backup.envLocked")} /> : null}
                  {!provider.is_active ? (
                    <Chip tone="muted" text={t("oidc.disabled")} />
                  ) : null}
                  <Chip
                    text={t(
                      provider.auto_link_verified_email
                        ? "oidc.autoLinkOn"
                        : "oidc.autoLinkOff",
                    )}
                  />
                  <Chip
                    text={t(
                      provider.auto_register_new_users
                        ? "oidc.autoRegisterOn"
                        : "oidc.autoRegisterOff",
                    )}
                  />
                </Row>
                <Row gap={2} shouldWrap>
                  <Button
                    variant="secondary"
                    size="sm"
                    text={t("actions.test")}
                    aria-label={`${t("actions.test")}: ${name}`}
                    onClick={() => void test(provider.id)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    text={t("actions.edit")}
                    isDisabled={isLocked}
                    onClick={() => {
                      setEditing({ draft: draftFromProvider(provider) });
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    text={t("actions.delete")}
                    isDisabled={isLocked}
                    onClick={() =>
                      void confirm({
                        title: t("oidc.deleteTitle", { name }),
                        message: t("oidc.deleteText"),
                        confirmText: t("actions.delete"),
                        isDangerous: true,
                      }).then((isConfirmed) => {
                        if (!isConfirmed) return;
                        void run(async () => {
                          await api[backend].delete(
                            `/admin/oidc/providers/${provider.id}`,
                          );
                          await list.reload();
                        });
                      })
                    }
                  />
                </Row>
                {result ? <TestResult result={result} /> : null}
              </Section>
            );
          })}
          <Row>
            <Button
              variant="secondary"
              size="md"
              text={t("oidc.add")}
              onClick={() => {
                setEditing({ draft: null });
              }}
            />
          </Row>
          <KeyValue
            label={t("oidc.passwordLogin")}
            value={t(data.enable_email_password_login ? "oidc.on" : "oidc.off")}
            hint={t("oidc.passwordLoginHint")}
          />
          {editing ? (
            <ProviderDialog
              backend={backend}
              provider={editing.draft}
              isBusy={isBusy}
              onClose={() => {
                setEditing(null);
              }}
              onSave={save}
            />
          ) : null}
        </>
      ) : null}
      {dialog}
    </LoadState>
  );
}

export function AuthPage() {
  const { t } = useTranslation("settings");
  return (
    <SettingsScreen
      title={t("topics.authentication.title")}
      description={t("oidc.description")}
    >
      <AdminPerApp>{(backend) => <Providers backend={backend} />}</AdminPerApp>
    </SettingsScreen>
  );
}
