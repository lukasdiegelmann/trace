import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useBlocker } from "react-router";

import { AppDialog } from "./AppDialog";
import { BackStackContext, type BackStack } from "./backStack";
import { ConfirmContext, type ConfirmOptions } from "./confirm";

/** One blocker for all layers: React Router allows only one at a time */
function BackStackProvider({ children }: { children: ReactNode }) {
  const layers = useRef<(() => void)[]>([]);
  const [count, setCount] = useState(0);

  const stack = useMemo<BackStack>(
    () => ({
      open(close) {
        layers.current.push(close);
        setCount(layers.current.length);
        return () => {
          layers.current = layers.current.filter((entry) => entry !== close);
          setCount(layers.current.length);
        };
      },
    }),
    [],
  );

  useBlocker(
    useCallback(
      ({ historyAction }: { historyAction: string }) => {
        if (count === 0 || historyAction !== "POP") return false;
        layers.current.at(-1)?.();
        return true;
      },
      [count],
    ),
  );

  return <BackStackContext value={stack}>{children}</BackStackContext>;
}

function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<
    (ConfirmOptions & { resolve: (isConfirmed: boolean) => void }) | null
  >(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    [],
  );

  const settle = (isConfirmed: boolean) => {
    pending?.resolve(isConfirmed);
    setPending(null);
  };

  return (
    <ConfirmContext value={confirm}>
      {children}
      {pending && (
        <AppDialog
          onClose={() => {
            settle(false);
          }}
          title={pending.title}
          description={pending.description}
          confirmText={pending.confirmText}
          variant={pending.isDangerous ? "danger" : "default"}
          onConfirm={() => {
            settle(true);
          }}
        />
      )}
    </ConfirmContext>
  );
}

/** What every nutrition screen's dialogs need */
export function UiProvider({ children }: { children: ReactNode }) {
  return (
    <BackStackProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </BackStackProvider>
  );
}
