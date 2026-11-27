/** CookTrace's and LiftTrace's connection to NutriTrace (they differ only in text) */
import { Button, Row } from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "@/api";

import { flushSettings, useShared, writeRef } from "../common/binding";
import { ConnectionCheck } from "../common/ConnectionCheck";
import { SecretRow, TextRow } from "../common/fields";
import { errorText } from "../common/useAction";
import { useConnectionCheck } from "../common/useConnectionCheck";
import { CHECK_QUERY, connectionName, type NtTestAnswer } from "../lib/ntLink";

export function NutriTraceLink({ backend }: { backend: "ct" | "lt" }) {
  const { t } = useTranslation("settings");
  const [savedUrl] = useShared<string>([backend, "ntInstanceUrl"]);
  const [savedToken] = useShared<string>([backend, "ntInstanceToken"]);
  const [isVerified] = useShared<boolean>([backend, "ntConnectionVerified"]);
  const [isEnabled] = useShared<boolean>([backend, "ntFederationEnabled"]);
  const [urlDraft, setUrlDraft] = useState<string | null>(null);
  const [tokenDraft, setTokenDraft] = useState<string | null>(null);
  const url = urlDraft ?? savedUrl;
  const token = tokenDraft ?? savedToken;

  const setFlags = (isOk: boolean) => {
    writeRef([backend, "ntConnectionVerified"], isOk);
    // As in both old apps, a passed test turns the link on.
    writeRef([backend, "ntFederationEnabled"], isOk);
  };

  const check = useConnectionCheck(async () => {
    try {
      const answer = await api[backend].post<NtTestAnswer>("/nt/test", {
        url,
        token,
      });
      if (!answer.ok) {
        throw new Error(answer.error ?? t("connections.unverified"));
      }
      setFlags(true);
      if (backend === "ct") {
        // The search reads the saved connection and only runs while it is on.
        await flushSettings("ct");
        await api.ct
          .get("/nt/foods", { query: { q: CHECK_QUERY } })
          .catch((caught: unknown) => {
            throw new Error(
              `${t("connections.unverified")} ${errorText(caught)}`,
              { cause: caught },
            );
          });
      }
      return t("connections.connectedAs", {
        name: connectionName(answer, url),
      });
    } catch (caught) {
      setFlags(false);
      throw caught;
    }
  });

  const edit = (apply: () => void) => {
    apply();
    check.reset();
    setFlags(false);
  };

  const save = async () => {
    const trimmed = url.trim().replace(/\/+$/, "");
    writeRef([backend, "ntInstanceUrl"], trimmed);
    writeRef([backend, "ntInstanceToken"], token.trim());
    setUrlDraft(null);
    setTokenDraft(null);
    await flushSettings(backend);
    await check.run();
    // A failed check turns the link off again; that has to reach the server.
    await flushSettings(backend);
  };

  return (
    <>
      <TextRow
        type="url"
        label={t("connections.ntUrl")}
        hint={t("connections.ntUrlHint", {
          url: `${window.location.origin}/nt`,
        })}
        value={url}
        isLive
        onCommit={(value) => {
          edit(() => {
            setUrlDraft(value);
          });
        }}
      />
      <SecretRow
        label={t("connections.ntToken")}
        hint={t(`connections.scopes.${backend}`)}
        value={token}
        isLive
        onCommit={(value) => {
          edit(() => {
            setTokenDraft(value);
          });
        }}
      />
      <Row>
        <Button
          variant="secondary"
          size="md"
          text={t("connections.saveAndTest")}
          isDisabled={!url.trim() || !token.trim()}
          onClick={() => void save()}
        />
      </Row>
      <ConnectionCheck
        check={check}
        isConfigured={Boolean(url && token)}
        verifiedText={
          isVerified && isEnabled
            ? t("connections.connectedAs", {
                name: connectionName({ ok: true }, savedUrl),
              })
            : undefined
        }
      />
    </>
  );
}
