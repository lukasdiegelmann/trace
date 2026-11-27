import { useCallback, useEffect, useRef, useState } from "react";

import { createDraftStore, overlayDraft } from "../lib/editorDraft";

export interface DraftForm<T> {
  form: T | null;
  error: Error | null;
  /** Changes the loaded form; nothing happens before it is there */
  change: (next: (form: T) => T) => void;
  /** A draft of an earlier visit was laid over the loaded form */
  isRestored: boolean;
  /** Back to what was loaded */
  discard: () => void;
  /** After a save: no draft is left behind */
  forget: () => void;
}

/**
 * An editor's form: loaded once, then kept as a draft while typing (#157
 * upstream), so a reload (e.g. after the phone's camera killed the page)
 * loses nothing. Mount the editor with its draft key as React key.
 */
export function useDraftForm<T extends { imgUrl: string }>(
  draftKey: string,
  load: () => Promise<T>,
  prefillBarcode: string | null = null,
): DraftForm<T> {
  const [store] = useState(() => createDraftStore());
  const [form, setForm] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const baseline = useRef<T | null>(null);
  const isDirty = useRef(false);
  const [save] = useState(() => store.debounced<T>(draftKey));
  const latestLoad = useRef(load);

  useEffect(() => {
    const visit = new AbortController();
    store.sweep();
    latestLoad.current().then(
      async (loaded) => {
        if (visit.signal.aborted) return;
        baseline.current = loaded;
        const restored = overlayDraft(
          loaded,
          store.load<T>(draftKey),
          prefillBarcode,
        );
        setForm(restored.state);
        setIsRestored(restored.isRestored);
        const photo = await store.loadImage(draftKey);
        if (!photo) return;
        setForm((current) =>
          current && !current.imgUrl ? { ...current, imgUrl: photo } : current,
        );
        setIsRestored(true);
      },
      (caught: unknown) => {
        if (visit.signal.aborted) return;
        setError(caught instanceof Error ? caught : new Error(String(caught)));
      },
    );
    return () => {
      visit.abort();
    };
  }, [draftKey, prefillBarcode, store]);

  useEffect(() => {
    if (form && isDirty.current) save(form);
  }, [form, save]);

  const change = useCallback((next: (current: T) => T) => {
    isDirty.current = true;
    setForm((current) => (current ? next(current) : current));
  }, []);
  const forget = useCallback(() => {
    isDirty.current = false;
    save.cancel();
    store.clear(draftKey);
  }, [draftKey, save, store]);
  const discard = useCallback(() => {
    forget();
    setForm(baseline.current);
    setIsRestored(false);
  }, [forget]);

  return { form, error, change, isRestored, discard, forget };
}
