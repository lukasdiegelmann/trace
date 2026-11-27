import {
  Button,
  CodeBlock,
  Row,
  Sheet,
  Text,
  useToast,
} from "@monocircuit/monolithium/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "@/api";
import {
  clearLog,
  isVerboseLogging,
  logText,
  setVerboseLogging,
} from "@/features/shared/logCapture";

import { useAdminBackends } from "../common/admin";
import { SwitchRow, TextRow } from "../common/fields";
import { Section, SettingsScreen } from "../common/SettingsScreen";
import { useAction } from "../common/useAction";
import {
  calibrationDays,
  calibrationRange,
  type WellnessRows,
} from "../lib/calibration";
import { downloadText } from "../lib/download";
import { APP_VERSIONS } from "../lib/versions";

function Logs() {
  const { t } = useTranslation("settings");
  const toast = useToast();
  const [isVerbose, setIsVerbose] = useState(isVerboseLogging);
  const [text, setText] = useState<string | null>(null);

  const share = async (content: string) => {
    try {
      if (!("share" in navigator)) throw new Error("no share");
      await navigator.share({ title: t("diagnostics.logs"), text: content });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        return;
      }
      await navigator.clipboard.writeText(content);
      toast.show({ text: t("actions.copied") });
    }
  };

  return (
    <Section title={t("diagnostics.logs")} hint={t("diagnostics.logsHint")}>
      <SwitchRow
        label={t("diagnostics.verbose")}
        isChecked={isVerbose}
        onChange={(isOn) => {
          setIsVerbose(isOn);
          setVerboseLogging(isOn);
        }}
      />
      <Row>
        <Button
          variant="secondary"
          size="md"
          text={t("diagnostics.view")}
          onClick={() => {
            setText(logText());
          }}
        />
      </Row>
      {text !== null ? (
        <Sheet
          isOpen
          title={t("diagnostics.logs")}
          onOpenChange={(isOpen) => {
            if (!isOpen) setText(null);
          }}
          footer={
            <Row gap={2} shouldWrap>
              <Button
                variant="secondary"
                size="md"
                text={t("diagnostics.share")}
                onClick={() => void share(text)}
              />
              <Button
                variant="secondary"
                size="md"
                text={t("actions.download")}
                onClick={() => {
                  downloadText(text, "trace-web.log");
                }}
              />
              <Button
                variant="ghost"
                size="md"
                text={t("diagnostics.clear")}
                onClick={() => {
                  clearLog();
                  setText(logText());
                }}
              />
            </Row>
          }
        >
          <CodeBlock code={text} copyable shouldWrap />
        </Sheet>
      ) : null}
    </Section>
  );
}

function Calibration() {
  const { t } = useTranslation("settings");
  const [device, setDevice] = useState("");
  const [result, setResult] = useState<{
    json: string;
    days: number;
  } | null>(null);
  const { isBusy, run } = useAction();
  const isAdmin = useAdminBackends().includes("nt");

  const generate = () =>
    run(async () => {
      const { from, to, dates } = calibrationRange();
      const load = (provider: string) =>
        api.nt
          .get<WellnessRows>(`/wellness/${provider}/data`, {
            query: { from, to },
          })
          .catch((): WellnessRows => ({}));
      const [fitbit, garmin, status] = await Promise.all([
        load("fitbit"),
        load("garmin"),
        // Admins only; everyone else gets the version Trace was built for.
        isAdmin
          ? api.nt
              .get<{ current?: string }>("/updates/server-status")
              .catch(() => null)
          : null,
      ]);
      const days = calibrationDays(dates, fitbit, garmin);
      setResult({
        days: days.length,
        json: JSON.stringify(
          {
            version: 1,
            exportedAt: to,
            device: device.trim() || "(unspecified)",
            appVersion: status?.current ?? APP_VERSIONS.nt,
            days,
          },
          null,
          2,
        ),
      });
    });

  return (
    <Section
      title={t("diagnostics.calibration")}
      hint={t("diagnostics.calibrationHint")}
    >
      <TextRow
        label={t("diagnostics.device")}
        placeholder="Pixel Watch 4"
        value={device}
        onCommit={setDevice}
      />
      <Row>
        <Button
          variant="secondary"
          size="md"
          text={t("diagnostics.generate")}
          isLoading={isBusy}
          onClick={() => void generate()}
        />
      </Row>
      {result ? (
        <>
          <Text variant="small" role="status">
            {t("diagnostics.review", { count: result.days })}
          </Text>
          <CodeBlock code={result.json} copyable />
        </>
      ) : null}
    </Section>
  );
}

export function DiagnosticsPage() {
  const { t } = useTranslation("settings");
  return (
    <SettingsScreen
      title={t("topics.diagnostics.title")}
      description={t("topics.diagnostics.description")}
    >
      <Logs />
      <Calibration />
    </SettingsScreen>
  );
}
