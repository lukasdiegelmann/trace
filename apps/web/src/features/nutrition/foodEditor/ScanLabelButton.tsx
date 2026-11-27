import { FileInput } from "@monocircuit/monolithium/components";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  aiErrorText,
  askAi,
  parseJsonReply,
  useAiSetup,
} from "@/features/shared/ai";

import { useNotify } from "../components/useNotify";
import { fitImageDataUrl, readFileAsDataUrl } from "../editor/imageData";
import { LABEL_PROMPT, LABEL_SYSTEM_PROMPT } from "../lib/labelScan";
import { acquireScreenWakeLock } from "../lib/wakeLock";

/** The longest edge sent to the model, as the old app's camera gave it */
const MAX_EDGE = 1600;

/**
 * A photo of the nutrition table, read by the Trace assistant's model; shown
 * only while the assistant is on
 */
export function ScanLabelButton({
  onRead,
}: {
  onRead: (label: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation("nutrition");
  const setup = useAiSetup();
  const notify = useNotify();
  const [isScanning, setIsScanning] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );

  if (!setup.isEnabled) return null;

  const scan = async (file: File) => {
    const current = new AbortController();
    request.current = current;
    setIsScanning(true);
    const release = await acquireScreenWakeLock();
    try {
      const original = await readFileAsDataUrl(file);
      // A format the browser can't draw goes to the model as it is
      const dataUrl = await fitImageDataUrl(original, MAX_EDGE, 0.8).catch(
        () => original,
      );
      const reply = await askAi(
        setup.config,
        {
          systemPrompt: LABEL_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", dataUrl },
                { type: "text", text: LABEL_PROMPT },
              ],
            },
          ],
          signal: current.signal,
        },
        setup.shouldUseProxy,
      );
      if (current.signal.aborted) return;
      const label = parseJsonReply(reply);
      if (!label) {
        notify.error(t("assistant.scanLabel.unreadable"));
        return;
      }
      onRead(label);
      notify.success(t("assistant.scanLabel.done"));
    } catch (caught) {
      if (current.signal.aborted) return;
      notify.error(
        t("assistant.scanLabel.failed", { message: aiErrorText(caught) }),
      );
    } finally {
      await release();
      if (!current.signal.aborted) setIsScanning(false);
    }
  };

  return (
    <FileInput
      accept="image/*"
      capture="environment"
      file={null}
      // TODO(monolithium): translatable built-in strings
      placeholder=" "
      text={t(
        isScanning
          ? "assistant.scanLabel.scanning"
          : "assistant.scanLabel.scan",
      )}
      captureText={t("assistant.scanLabel.camera")}
      disabled={isScanning}
      size="sm"
      variant="secondary"
      onChange={(file) => {
        if (file) void scan(file);
      }}
    />
  );
}
