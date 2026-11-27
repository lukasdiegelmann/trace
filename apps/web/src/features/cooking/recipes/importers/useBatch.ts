import { useCallback, useEffect, useRef, useState } from "react";

import { cancelBatch, type Batch } from "./importApi";

/**
 * A scanned batch and its selection. A batch that was neither saved nor
 * explicitly dropped is cancelled when the dialog goes.
 */
export function useBatch() {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const open = useRef<string | null>(null);

  const start = useCallback((next: Batch, preselected: string[]) => {
    open.current = next.cacheUuid;
    setBatch(next);
    setSelected(new Set(preselected));
  }, []);
  const settle = useCallback(() => {
    open.current = null;
  }, []);
  const drop = useCallback(() => {
    if (open.current) void cancelBatch(open.current);
    open.current = null;
    setBatch(null);
  }, []);

  useEffect(
    () => () => {
      if (open.current) void cancelBatch(open.current);
      open.current = null;
    },
    [],
  );

  return { batch, selected, setSelected, start, settle, drop };
}
