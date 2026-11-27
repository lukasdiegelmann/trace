import { useToast } from "@monocircuit/monolithium/components";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { SessionExpiredError } from "@/api";

export interface Notify {
  success: (text: string) => void;
  info: (text: string) => void;
  error: (text: string) => void;
  /** A failed write: the backend's message, if it sent one */
  failure: (caught: unknown) => void;
}

export function useNotify(): Notify {
  const toast = useToast();
  const { t } = useTranslation("nutrition");
  return useMemo(
    () => ({
      success: (text: string) =>
        void toast.show({ text, tone: "info", durationMs: 3000 }),
      info: (text: string) => void toast.info(text),
      error: (text: string) => void toast.error(text),
      failure: (caught: unknown) => {
        // AuthProvider shows the sign-in page for this one
        if (caught instanceof SessionExpiredError) return;
        const message =
          caught instanceof Error ? caught.message : String(caught);
        toast.error(t("common.saveError", { message }));
      },
    }),
    [toast, t],
  );
}
