/* eslint-disable @typescript-eslint/naming-convention -- the backend's fields */
import {
  Button,
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
import { CheckList, TextRow } from "../common/fields";
import { LoadState, Section, SettingsScreen } from "../common/SettingsScreen";
import { useAction } from "../common/useAction";
import { useConfirm } from "../common/useConfirm";
import { useLoad } from "../common/useLoad";
import { defaultScopes, tokenExpiry } from "../lib/admin";
import { relativeTime } from "../lib/format";
import { parseNumberInput } from "../lib/numbers";
import { SecretOnce } from "./SecretOnce";

interface ApiToken {
  id: number;
  name: string;
  scopes: string[];
  expires_at?: string | null;
  last_used_at?: string | null;
}

interface TokenList {
  tokens: ApiToken[];
  known_scopes: string[];
  scope_descriptions?: Record<string, string>;
  mcp_state?: { enabled?: boolean; write?: boolean; destroy?: boolean } | null;
}

function CreateToken({
  backend,
  list,
  onCreated,
}: {
  backend: BackendId;
  list: TokenList;
  onCreated: (raw: string) => Promise<void>;
}) {
  const { t } = useTranslation("settings");
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState(() => defaultScopes(list.known_scopes));
  const [days, setDays] = useState("");
  const { isBusy, run } = useAction();

  return (
    <Section title={t("tokens.new")}>
      <TextRow
        label={t("tokens.name")}
        value={name}
        isLive
        onCommit={setName}
      />
      <CheckList<string>
        label={t("tokens.scopes")}
        options={list.known_scopes.map((scope) => ({
          value: scope,
          label: list.scope_descriptions?.[scope]
            ? `${scope} · ${list.scope_descriptions[scope]}`
            : scope,
        }))}
        values={scopes}
        onChange={setScopes}
      />
      <TextRow
        label={t("tokens.expiresIn")}
        hint={t("tokens.expiresHint")}
        inputMode="numeric"
        value={days}
        isLive
        onCommit={setDays}
      />
      <Row>
        <Button
          variant="secondary"
          size="md"
          text={t("tokens.create")}
          isLoading={isBusy}
          isDisabled={!name.trim() || scopes.length === 0}
          onClick={() =>
            void run(async () => {
              const answer = await api[backend].post<{ raw: string }>(
                "/admin/api-tokens",
                {
                  name: name.trim(),
                  scopes,
                  expires_at: tokenExpiry(
                    parseNumberInput(days, { isInteger: true }),
                  ),
                },
              );
              setName("");
              setDays("");
              await onCreated(answer.raw);
            })
          }
        />
      </Row>
    </Section>
  );
}

function Tokens({ backend }: { backend: BackendId }) {
  const { t, i18n } = useTranslation("settings");
  const list = useLoad(
    () => api[backend].get<TokenList>("/admin/api-tokens"),
    [backend],
  );
  const [raw, setRaw] = useState<string | null>(null);
  const { run } = useAction();
  const { confirm, dialog } = useConfirm();
  const data = list.data;
  const mcp = data?.mcp_state;
  const on = [
    mcp?.enabled ? "read" : null,
    mcp?.write ? "write" : null,
    mcp?.destroy ? "destroy" : null,
  ].filter(Boolean);
  const when = (value: string | null | undefined, empty: string) =>
    value ? relativeTime(value, i18n.language) : empty;

  return (
    <LoadState
      isLoading={list.isLoading}
      error={list.error}
      onRetry={() => void list.reload()}
      hasData={data !== null}
    >
      {data ? (
        <>
          <Text variant="small" tone="muted">
            {t(`tokens.intro.${backend}`)}
          </Text>
          {on.length ? (
            <Text variant="small">
              {t("tokens.mcp", { modes: on.join(", ") })}
            </Text>
          ) : null}
          {raw ? (
            <SecretOnce
              title={t("tokens.newToken")}
              secret={raw}
              onDone={() => {
                setRaw(null);
              }}
            />
          ) : null}
          <Stack gap={3}>
            {data.tokens.length === 0 ? (
              <EmptyState text={t("tokens.none")} />
            ) : null}
            {data.tokens.map((token) => (
              <KeyValue
                key={token.id}
                label={token.name}
                hint={`${token.scopes.join(", ")} · ${t("tokens.lastUsed", { when: when(token.last_used_at, t("tokens.never")) })} · ${t("tokens.expires", { when: when(token.expires_at, t("tokens.never")) })}`}
                value={
                  <Button
                    variant="ghost"
                    size="sm"
                    text={t("tokens.revoke")}
                    aria-label={`${t("tokens.revoke")}: ${token.name}`}
                    onClick={() =>
                      void confirm({
                        title: t("tokens.revokeTitle", { name: token.name }),
                        message: t("tokens.revokeText"),
                        confirmText: t("tokens.revoke"),
                        isDangerous: true,
                      }).then((isConfirmed) => {
                        if (!isConfirmed) return;
                        void run(async () => {
                          await api[backend].delete(
                            `/admin/api-tokens/${token.id}`,
                          );
                          await list.reload();
                        });
                      })
                    }
                  />
                }
              />
            ))}
          </Stack>
          <CreateToken
            backend={backend}
            list={data}
            onCreated={async (secret) => {
              setRaw(secret);
              await list.reload();
            }}
          />
        </>
      ) : null}
      {dialog}
    </LoadState>
  );
}

export function TokensPage() {
  const { t } = useTranslation("settings");
  return (
    <SettingsScreen
      title={t("topics.apiTokens.title")}
      description={t("topics.apiTokens.description")}
    >
      <AdminPerApp>{(backend) => <Tokens backend={backend} />}</AdminPerApp>
    </SettingsScreen>
  );
}
