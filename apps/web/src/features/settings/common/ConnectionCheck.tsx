import {
  Button,
  Chip,
  Row,
  Spinner,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useTranslation } from "react-i18next";

import type { ConnectionCheckApi } from "./useConnectionCheck";

// TODO(monolithium): a connection status block (state, detail, test button).
export function ConnectionCheck({
  check,
  isConfigured,
  verifiedText,
}: {
  check: ConnectionCheckApi;
  isConfigured: boolean;
  /** Set while an earlier test still counts: shown until the next one */
  verifiedText?: string;
}) {
  const { t } = useTranslation("settings");
  const state: ConnectionCheckApi["state"] =
    check.state.status === "idle" && verifiedText
      ? { status: "ok", detail: verifiedText }
      : check.state;
  return (
    <Stack gap={2}>
      <Row gap={2} align="center" shouldWrap>
        {state.status === "testing" ? (
          <Spinner size="sm" label={t("connection.testing")} />
        ) : state.status === "ok" ? (
          <Chip tone="accent" text={t("connection.connected")} />
        ) : state.status === "failed" ? (
          <Chip tone="danger" text={t("connection.failed")} />
        ) : isConfigured ? (
          <Chip text={t("connection.configured")} />
        ) : (
          <Chip text={t("connection.missing")} />
        )}
        <Button
          variant="secondary"
          size="sm"
          text={t("actions.test")}
          isDisabled={!isConfigured || state.status === "testing"}
          onClick={() => void check.run()}
        />
      </Row>
      {state.status === "failed" ? (
        <Text variant="small" tone="danger" role="alert">
          {state.message}
        </Text>
      ) : null}
      {state.status === "ok" && state.detail ? (
        <Text variant="small" tone="success" role="status">
          {state.detail}
        </Text>
      ) : null}
    </Stack>
  );
}
