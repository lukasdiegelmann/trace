import { useToast } from "@monocircuit/monolithium/components";
import { useMemo } from "react";

import { SessionExpiredError } from "@/api";

/** Toasts for results and failures */
export function useNotify() {
  const toast = useToast();
  return useMemo(
    () => ({
      success: (text: string) => {
        toast.info(text);
      },
      info: (text: string) => {
        toast.info(text);
      },
      /** The backend's message, else `fallback` */
      failure: (caught: unknown, fallback: string) => {
        if (caught instanceof SessionExpiredError) return;
        toast.error(
          caught instanceof Error && caught.message ? caught.message : fallback,
        );
      },
      error: (text: string) => {
        toast.error(text);
      },
      show: toast.show,
    }),
    [toast],
  );
}
