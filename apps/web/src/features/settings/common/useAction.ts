import { useToast } from "@monocircuit/monolithium/components";
import { useCallback, useState } from "react";

import { SessionExpiredError } from "@/api";

export function errorText(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

/**
 * Runs a server action: busy while it runs, the error as a toast (an
 * expired session is left to the sign-in page), `success` as a toast.
 */
export function useAction(): {
  isBusy: boolean;
  run: (
    action: () => Promise<unknown>,
    options?: { success?: string },
  ) => Promise<boolean>;
} {
  const toast = useToast();
  const [running, setRunning] = useState(0);

  const run = useCallback(
    async (
      action: () => Promise<unknown>,
      options: { success?: string } = {},
    ) => {
      setRunning((count) => count + 1);
      try {
        await action();
        if (options.success) toast.show({ text: options.success });
        return true;
      } catch (caught) {
        if (!(caught instanceof SessionExpiredError)) {
          toast.error(errorText(caught));
        }
        return false;
      } finally {
        setRunning((count) => count - 1);
      }
    },
    [toast],
  );

  return { isBusy: running > 0, run };
}
