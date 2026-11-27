import { useCallback, useEffect, useRef, useState } from "react";

import { errorText } from "./useAction";

export type CheckState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; detail?: string }
  | { status: "failed"; message: string };

export interface ConnectionCheckApi {
  state: CheckState;
  /** Runs the test; its text, if any, shows beside "Connected" */
  run: () => Promise<boolean>;
  /** After an edit: the last result no longer counts */
  reset: () => void;
}

export function useConnectionCheck(
  test: () => Promise<unknown>,
): ConnectionCheckApi {
  const [state, setState] = useState<CheckState>({ status: "idle" });
  const latest = useRef(test);
  useEffect(() => {
    latest.current = test;
  });
  const generation = useRef(0);

  const run = useCallback(async () => {
    const mine = ++generation.current;
    setState({ status: "testing" });
    try {
      const result = await latest.current();
      const detail = typeof result === "string" ? result : undefined;
      if (mine === generation.current) setState({ status: "ok", detail });
      return true;
    } catch (caught) {
      if (mine === generation.current) {
        setState({ status: "failed", message: errorText(caught) });
      }
      return false;
    }
  }, []);
  const reset = useCallback(() => {
    generation.current++;
    setState({ status: "idle" });
  }, []);

  return { state, run, reset };
}
