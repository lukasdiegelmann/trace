import { useToast } from "@monocircuit/monolithium/components";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/**
 * Runs an action with its success toast; a failure is shown as a toast and
 * answers false.
 */
export function useRun() {
  const { t } = useTranslation("training");
  const toast = useToast();
  return useCallback(
    async (action: () => Promise<unknown>, success?: string) => {
      try {
        await action();
        if (success) toast.info(success);
        return true;
      } catch (error) {
        toast.error(t("common.error", { message: (error as Error).message }));
        return false;
      }
    },
    [t, toast],
  );
}
