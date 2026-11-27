import {
  Button,
  Chip,
  Dialog,
  Row,
  Stack,
  Text,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type BackendId } from "@/api";

import { useBackendUser } from "../common/admin";
import { useEnvLocks } from "../common/envLocks";
import { SecretRow, SwitchRow, TextRow } from "../common/fields";
import { LoadState } from "../common/SettingsScreen";
import { useAction } from "../common/useAction";
import { useLoad } from "../common/useLoad";
import {
  isEmail,
  SECRET_MASK,
  SMTP_KEYS,
  smtpWrites,
  type SmtpForm,
} from "../lib/admin";

function Fields({
  backend,
  initial,
  isLocked,
}: {
  backend: BackendId;
  initial: SmtpForm;
  isLocked: boolean;
}) {
  const { t } = useTranslation("settings");
  const user = useBackendUser(backend);
  const [form, setForm] = useState(initial);
  const [recipient, setRecipient] = useState<string | null>(null);
  const [tested, setTested] = useState<{ to: string; isSent: boolean } | null>(
    null,
  );
  const { isBusy, run } = useAction();
  const set = (key: keyof SmtpForm) => (value: string) => {
    setForm((old) => ({ ...old, [key]: value }));
  };
  const isMasked = form.smtp_pass === SECRET_MASK;

  const sendTest = (to: string) => {
    setRecipient(null);
    // An earlier result says nothing about this try.
    setTested(null);
    void run(async () => {
      // Tests what is in the form, saved or not.
      const { smtp_pass, ...rest } = form;
      try {
        await api[backend].post("/app-config/test-email", {
          ...rest,
          ...(smtp_pass && !isMasked ? { smtp_pass } : {}),
          to,
        });
      } catch (caught) {
        setTested({ to, isSent: false });
        throw caught;
      }
      setTested({ to, isSent: true });
    });
  };

  return (
    <Stack gap={3}>
      {isLocked ? (
        <Row>
          <Chip text={t("backup.envLocked")} />
        </Row>
      ) : (
        <Row gap={2} shouldWrap>
          {form.smtp_host && form.smtp_from ? (
            <Chip text={t("connection.configured")} />
          ) : (
            <Chip text={t("connection.missing")} />
          )}
          {tested ? (
            <Chip
              tone={tested.isSent ? "accent" : "danger"}
              text={t(tested.isSent ? "email.sentTo" : "email.failedTo", {
                to: tested.to,
              })}
            />
          ) : null}
        </Row>
      )}
      <TextRow
        label={t("email.host")}
        value={form.smtp_host}
        isDisabled={isLocked}
        onCommit={set("smtp_host")}
      />
      <TextRow
        label={t("email.port")}
        inputMode="numeric"
        value={form.smtp_port}
        placeholder="587"
        isDisabled={isLocked}
        onCommit={set("smtp_port")}
      />
      <SwitchRow
        label={t("email.tls")}
        isChecked={form.smtp_secure === "true"}
        isDisabled={isLocked}
        onChange={(isOn) => {
          set("smtp_secure")(String(isOn));
        }}
      />
      <TextRow
        label={t("email.user")}
        value={form.smtp_user}
        isDisabled={isLocked}
        onCommit={set("smtp_user")}
      />
      {isMasked ? (
        <Row gap={2} align="center">
          <Text variant="small">{t("email.passwordStored")}</Text>
          <Button
            variant="ghost"
            size="sm"
            text={t("email.changePassword")}
            isDisabled={isLocked}
            onClick={() => {
              set("smtp_pass")("");
            }}
          />
        </Row>
      ) : (
        <SecretRow
          label={t("email.password")}
          value={form.smtp_pass}
          isDisabled={isLocked}
          onCommit={set("smtp_pass")}
        />
      )}
      <TextRow
        type="email"
        label={t("email.from")}
        value={form.smtp_from}
        isDisabled={isLocked}
        onCommit={set("smtp_from")}
      />
      <Row gap={2}>
        <Button
          variant="primary"
          size="md"
          text={t("actions.save")}
          isDisabled={isLocked || isBusy}
          onClick={() =>
            void run(
              async () => {
                for (const write of smtpWrites(form)) {
                  await api[backend].put("/app-config", write);
                }
              },
              { success: t("actions.saved") },
            )
          }
        />
        <Button
          variant="secondary"
          size="md"
          text={t("email.test")}
          isDisabled={!form.smtp_host || isBusy}
          onClick={() => {
            setRecipient(typeof user?.email === "string" ? user.email : "");
          }}
        />
      </Row>
      {recipient !== null ? (
        <Dialog
          open
          title={t("email.test")}
          onOpenChange={(isOpen) => {
            if (!isOpen) setRecipient(null);
          }}
          cancelText={t("actions.cancel")}
          confirmText={t("email.send")}
          isConfirmDisabled={!isEmail(recipient)}
          onConfirm={() => {
            sendTest(recipient.trim());
          }}
        >
          <TextRow
            type="email"
            label={t("email.recipient")}
            value={recipient}
            isLive
            onCommit={setRecipient}
          />
        </Dialog>
      ) : null}
    </Stack>
  );
}

export function EmailForm({ backend }: { backend: BackendId }) {
  const locks = useEnvLocks(backend);
  const config = useLoad(
    () => api[backend].get<Record<string, string>>("/app-config"),
    [backend],
  );
  return (
    <LoadState
      isLoading={config.isLoading || locks.isLoading}
      error={config.error}
      onRetry={() => void config.reload()}
      hasData={config.data !== null && !locks.isLoading}
    >
      {config.data ? (
        <Fields
          backend={backend}
          isLocked={Boolean(locks.data?.smtp)}
          initial={
            Object.fromEntries(
              SMTP_KEYS.map((key) => [key, config.data?.[key] ?? ""]),
            ) as SmtpForm
          }
        />
      ) : null}
    </LoadState>
  );
}
